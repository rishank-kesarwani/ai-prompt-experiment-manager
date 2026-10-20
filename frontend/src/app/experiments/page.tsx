'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  Plus,
  ArrowRight,
  Activity,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import {
  fetchExperiments,
  fetchPrompts,
  createExperiment,
  updateExperimentStatus,
} from '../../lib/api';
import { Experiment, Prompt, ExperimentStatus } from '../../lib/types';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [applicationId, setApplicationId] = useState('customer-support-agent');
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [description, setDescription] = useState('');
  const [controlVersionId, setControlVersionId] = useState('');
  const [candidateVersionId, setCandidateVersionId] = useState('');
  const [splitControl, setSplitControl] = useState(50);
  const [splitCandidate, setSplitCandidate] = useState(50);
  const [primaryMetric, setPrimaryMetric] = useState<'quality_score' | 'latency_ms' | 'cost_usd'>('quality_score');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [exps, pList] = await Promise.all([
        fetchExperiments(),
        fetchPrompts(),
      ]);
      setExperiments(exps);
      setPrompts(pList);
      if (pList.length > 0) {
        setSelectedPromptId(pList[0].id);
        if (pList[0].versions && pList[0].versions.length > 0) {
          setControlVersionId(pList[0].activeVersionId || pList[0].versions[0].id);
          setCandidateVersionId(
            pList[0].versions.length > 1
              ? pList[0].versions[1].id
              : pList[0].versions[0].id,
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePromptSelectionChange = (promptId: string) => {
    setSelectedPromptId(promptId);
    const p = prompts.find((x) => x.id === promptId);
    if (p && p.versions && p.versions.length > 0) {
      setControlVersionId(p.activeVersionId || p.versions[0].id);
      setCandidateVersionId(
        p.versions.length > 1 ? p.versions[1].id : p.versions[0].id,
      );
    }
  };

  const handleControlSplitChange = (val: number) => {
    setSplitControl(val);
    setSplitCandidate(100 - val);
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);

      if (splitControl + splitCandidate !== 100) {
        throw new Error('Traffic split percentages must sum exactly to 100%');
      }

      await createExperiment({
        name,
        applicationId,
        promptId: selectedPromptId,
        description,
        controlVersionId,
        candidateVersionIds: [candidateVersionId],
        variants: [
          { versionId: controlVersionId, variantName: 'control', percentage: splitControl },
          { versionId: candidateVersionId, variantName: 'candidate', percentage: splitCandidate },
        ],
        objectives: [
          {
            metric: primaryMetric,
            direction: primaryMetric === 'quality_score' ? 'higher' : 'lower',
            targetDeltaPct: 10,
          },
        ],
      });

      setIsModalOpen(false);
      setName('');
      setDescription('');
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create experiment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (exp: Experiment) => {
    const nextStatus: ExperimentStatus = exp.status === 'running' ? 'paused' : 'running';
    try {
      await updateExperimentStatus(exp.id, nextStatus, `Operator toggled status to ${nextStatus}`);
      await loadData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const currentSelectedPrompt = prompts.find((p) => p.id === selectedPromptId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Header with Logo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="shrink-0 mt-1 sm:mt-0">
            <Logo size="md" showText={false} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Controlled A/B Experiments
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Run randomized, deterministic bucketing experiments to evaluate candidate prompts against control baselines.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Experiment</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Experiments List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
          Loading experiments...
        </div>
      ) : experiments.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl p-8 space-y-3">
          <FlaskConical className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-medium text-slate-300">No active experiments</p>
          <p className="text-slate-500">Configure a control versus candidate A/B test with deterministic traffic allocation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {experiments.map((exp) => {
            const isRunning = exp.status === 'running';

            return (
              <div
                key={exp.id}
                className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {exp.applicationId}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isRunning
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {exp.status}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(exp)}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        {isRunning ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">
                    {exp.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {exp.description || 'No description provided.'}
                  </p>

                  {/* Traffic Split Representation */}
                  <div className="p-3 rounded-xl bg-surface-100 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Traffic Allocation</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Total Subjects: <strong>{exp.totalAssignments}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {exp.variants.map((v) => (
                        <div
                          key={v.variantName}
                          className="p-2 rounded-lg bg-surface-200 border border-white/5 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-white capitalize block text-[11px]">
                              {v.variantName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {v.versionId.replace('ver_', '').slice(0, 8)}
                            </span>
                          </div>
                          <span className="text-cyan-400 font-bold text-sm">
                            {v.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">
                    Seed: {exp.seed.slice(0, 8)}...
                  </span>
                  <Link
                    href={`/experiments/${exp.id}`}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 group"
                  >
                    <span>Inspect Assignment & Metrics</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Experiment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 space-y-5 my-8 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-cyan-400" />
                Configure Controlled A/B Experiment
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateExperiment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Experiment Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Concierge v1.1 Few-Shot A/B Test"
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Application ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Target Prompt Catalog *
                </label>
                <select
                  value={selectedPromptId}
                  onChange={(e) => handlePromptSelectionChange(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Version Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Control Baseline Version *
                  </label>
                  <select
                    value={controlVersionId}
                    onChange={(e) => setControlVersionId(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  >
                    {currentSelectedPrompt?.versions?.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.lifecycleState})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Candidate Test Version *
                  </label>
                  <select
                    value={candidateVersionId}
                    onChange={(e) => setCandidateVersionId(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  >
                    {currentSelectedPrompt?.versions?.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.lifecycleState})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Traffic Split Slider */}
              <div className="space-y-2 p-3 rounded-xl bg-surface-100 border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Deterministic Traffic Split</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    Control: {splitControl}% | Candidate: {splitCandidate}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="5"
                  value={splitControl}
                  onChange={(e) => handleControlSplitChange(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Primary Evaluation Objective
                </label>
                <select
                  value={primaryMetric}
                  onChange={(e) => setPrimaryMetric(e.target.value as any)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                >
                  <option value="quality_score">Higher AI Quality / Helpfulness Score</option>
                  <option value="latency_ms">Lower Latency (ms)</option>
                  <option value="cost_usd">Lower Inference Cost (USD)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Description & Context
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Hypothesis or goal for this test"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 transition"
                >
                  {submitting ? 'Creating...' : 'Launch Experiment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
