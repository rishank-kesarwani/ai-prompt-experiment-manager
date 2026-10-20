'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Layers,
  ArrowLeft,
  CheckCircle2,
  Clock,
  GitCommit,
  GitCompare,
  Plus,
  Play,
  Shield,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Code2,
  Terminal,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Logo } from '../../../components/Logo';
import {
  fetchPrompt,
  createVersion,
  transitionVersionState,
  renderPromptTest,
  fetchPromptDiff,
  ApiError,
} from '../../../lib/api';
import { Prompt, PromptVersion, LifecycleState } from '../../../lib/types';

export default function PromptDetailPage() {
  const params = useParams();
  const promptId = params?.id as string;

  const [prompt, setPrompt] = useState<(Prompt & { versions: PromptVersion[] }) | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Test Render Sandbox State
  const [sandboxInputs, setSandboxInputs] = useState<Record<string, string>>({});
  const [renderedOutput, setRenderedOutput] = useState<{
    renderedPrompt: string;
    renderedSystemInstruction?: string;
  } | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Transition State Modal
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [targetState, setTargetState] = useState<LifecycleState>('candidate');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Commit New Version Modal
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [newSystemInstruction, setNewSystemInstruction] = useState('');
  const [newModel, setNewModel] = useState('gemini-1.5-flash');
  const [newTemp, setNewTemp] = useState(0.7);
  const [newChangelog, setNewChangelog] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Diff Viewer State
  const [diffV1Id, setDiffV1Id] = useState<string>('');
  const [diffV2Id, setDiffV2Id] = useState<string>('');
  const [diffData, setDiffData] = useState<any | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const loadPrompt = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPrompt(promptId);
      setPrompt(data);
      if (data.versions && data.versions.length > 0) {
        // Default to active version if set, else most recent
        const active = data.versions.find((v) => v.id === data.activeVersionId);
        const initial = active || data.versions[0];
        setSelectedVersion(initial);

        // Prep sandbox inputs with defaults
        const initialInputs: Record<string, string> = {};
        for (const v of initial.variables) {
          initialInputs[v.name] = v.defaultValue || `sample_${v.name}`;
        }
        setSandboxInputs(initialInputs);

        // Default diff pair
        if (data.versions.length >= 2) {
          setDiffV1Id(data.versions[1].id);
          setDiffV2Id(data.versions[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load prompt details');
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    if (promptId) loadPrompt();
  }, [promptId, loadPrompt]);

  // When selected version changes, update sandbox inputs
  const handleSelectVersion = (ver: PromptVersion) => {
    setSelectedVersion(ver);
    setRenderedOutput(null);
    setRenderError(null);
    const inputs: Record<string, string> = {};
    for (const v of ver.variables) {
      inputs[v.name] = sandboxInputs[v.name] || v.defaultValue || `sample_${v.name}`;
    }
    setSandboxInputs(inputs);
  };

  const handleTestRender = async () => {
    if (!selectedVersion) return;
    try {
      setRenderLoading(true);
      setRenderError(null);
      const res = await renderPromptTest(
        promptId,
        selectedVersion.id,
        sandboxInputs,
      );
      setRenderedOutput(res);
    } catch (err: any) {
      setRenderError(err.message || 'Failed to render prompt with test inputs');
    } finally {
      setRenderLoading(false);
    }
  };

  const handleStateTransition = async () => {
    if (!selectedVersion) return;
    try {
      setTransitioning(true);
      setTransitionError(null);

      await transitionVersionState(
        promptId,
        selectedVersion.id,
        targetState,
        transitionNotes,
        selectedVersion.revision, // Pass expected revision for optimistic concurrency!
      );

      setIsTransitionModalOpen(false);
      setTransitionNotes('');
      await loadPrompt();
    } catch (err: any) {
      if (err.statusCode === 409) {
        setTransitionError(
          'Optimistic Concurrency Conflict: This version was modified by another operator concurrently. Refresh the page to load the latest revision.',
        );
      } else {
        setTransitionError(err.message || 'Transition failed');
      }
    } finally {
      setTransitioning(false);
    }
  };

  const handleCommitNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCommitting(true);
      setCommitError(null);

      const ver = await createVersion(promptId, {
        version: newVersionLabel,
        template: newTemplate,
        systemInstruction: newSystemInstruction || undefined,
        parameters: {
          model: newModel,
          provider: 'google-vertex',
          temperature: Number(newTemp),
        },
        changelog: newChangelog,
      });

      setIsCommitModalOpen(false);
      await loadPrompt();
      setSelectedVersion(ver);
    } catch (err: any) {
      setCommitError(err.message || 'Failed to commit new version');
    } finally {
      setCommitting(false);
    }
  };

  const handleComputeDiff = async () => {
    if (!diffV1Id || !diffV2Id) return;
    try {
      setDiffLoading(true);
      setDiffError(null);
      const data = await fetchPromptDiff(promptId, diffV1Id, diffV2Id);
      setDiffData(data);
    } catch (err: any) {
      setDiffError(err.message || 'Failed to compute version diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const openCommitModalFromCurrent = () => {
    if (selectedVersion) {
      const parts = selectedVersion.version.split('.');
      const nextPatch = parts.length === 3 ? `${parts[0]}.${parts[1]}.${parseInt(parts[2], 10) + 1}` : '1.1.0';
      setNewVersionLabel(nextPatch);
      setNewTemplate(selectedVersion.template);
      setNewSystemInstruction(selectedVersion.systemInstruction || '');
      setNewModel(selectedVersion.parameters.model);
      setNewTemp(selectedVersion.parameters.temperature);
      setNewChangelog(`Iterated from version ${selectedVersion.version}`);
    }
    setIsCommitModalOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 text-center text-xs text-slate-400 animate-pulse">
        Loading prompt catalog and version history...
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-3">
          <p className="font-semibold text-sm">Error Loading Prompt Catalog</p>
          <p className="text-xs">{error || 'Prompt not found'}</p>
          <Link
            href="/prompts"
            className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Prompts</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Navigation Breadcrumb and Title with Logo */}
      <div className="space-y-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/prompts" className="hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Prompts Catalog</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-mono">{prompt.applicationId}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-violet-400 font-medium">{prompt.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="md" showText={false} />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {prompt.name}
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  {prompt.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {prompt.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openCommitModalFromCurrent}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Commit New Version</span>
            </button>
          </div>
        </div>
      </div>

      {/* Version Timeline Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Immutable Version History & State Graph</span>
          </span>
          <span className="text-xs text-slate-500">
            {prompt.versions.length} versions committed
          </span>
        </div>

        {/* Horizontal scrollable version chips */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {prompt.versions.map((ver) => {
            const isSelected = selectedVersion?.id === ver.id;
            const isActive = prompt.activeVersionId === ver.id;

            const stateColors: Record<LifecycleState, string> = {
              draft: 'bg-slate-800 text-slate-300 border-slate-700',
              candidate: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
              approved: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
              active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20',
              archived: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
            };

            return (
              <button
                key={ver.id}
                onClick={() => handleSelectVersion(ver)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl border text-xs font-medium transition text-left space-y-1 ${
                  isSelected
                    ? 'ring-2 ring-violet-500 border-violet-400 bg-surface-100'
                    : 'bg-surface-200 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">v{ver.version}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${stateColors[ver.lifecycleState]}`}
                  >
                    {ver.lifecycleState}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-black">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  {ver.changelog}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedVersion && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Version Inspector & Live Render Sandbox */}
          <div className="lg:col-span-2 space-y-6">
            {/* Version Metadata & Parameters Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      Version {selectedVersion.version} Specification
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">
                      (Rev #{selectedVersion.revision})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Author: <span className="text-slate-300 font-medium">{selectedVersion.author}</span> | Committed:{' '}
                    <span className="text-slate-300">{new Date(selectedVersion.createdAt).toLocaleString()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTargetState(
                        selectedVersion.lifecycleState === 'draft'
                          ? 'candidate'
                          : selectedVersion.lifecycleState === 'candidate'
                          ? 'approved'
                          : selectedVersion.lifecycleState === 'approved'
                          ? 'active'
                          : 'archived',
                      );
                      setIsTransitionModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition"
                  >
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Transition State</span>
                  </button>
                </div>
              </div>

              {/* SHA-256 Checksum Pill */}
              <div className="p-2.5 rounded-xl bg-surface-300 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SHA-256 Content Checksum:</span>
                </span>
                <code className="text-slate-300 font-mono text-[11px] truncate max-w-[280px]">
                  {selectedVersion.checksum}
                </code>
              </div>

              {/* Model Execution Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Model</span>
                  <span className="font-semibold text-white font-mono mt-0.5 block">
                    {selectedVersion.parameters.model}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Provider</span>
                  <span className="font-semibold text-white capitalize mt-0.5 block">
                    {selectedVersion.parameters.provider}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Temperature</span>
                  <span className="font-semibold text-cyan-400 font-mono mt-0.5 block">
                    {selectedVersion.parameters.temperature}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Max Tokens</span>
                  <span className="font-semibold text-slate-200 font-mono mt-0.5 block">
                    {selectedVersion.parameters.maxTokens || 'Default'}
                  </span>
                </div>
              </div>

              {/* Template Content Box */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Template Content
                </label>
                <pre className="p-4 rounded-xl bg-surface-300 border border-white/5 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {selectedVersion.template}
                </pre>
              </div>

              {/* System Instruction if present */}
              {selectedVersion.systemInstruction && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">
                    System Instruction
                  </label>
                  <p className="p-3 rounded-xl bg-surface-100 border border-white/5 text-xs text-slate-300 font-mono">
                    {selectedVersion.systemInstruction}
                  </p>
                </div>
              )}
            </div>

            {/* Test Render Sandbox */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Live Variable Interpolation Sandbox
                  </h3>
                </div>
                <button
                  onClick={handleTestRender}
                  disabled={renderLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{renderLoading ? 'Rendering...' : 'Render Prompt'}</span>
                </button>
              </div>

              {renderError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>{renderError}</span>
                </div>
              )}

              {/* Variable Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedVersion.variables.map((v) => (
                  <div key={v.name}>
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between mb-1">
                      <span>{v.name}</span>
                      {v.required && (
                        <span className="text-rose-400 text-[10px]">required</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={sandboxInputs[v.name] || ''}
                      onChange={(e) =>
                        setSandboxInputs({
                          ...sandboxInputs,
                          [v.name]: e.target.value,
                        })
                      }
                      placeholder={v.description || `Value for {{${v.name}}}`}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>

              {/* Rendered Output Preview */}
              {renderedOutput && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Rendered Execution Output
                  </span>
                  <pre className="p-4 rounded-xl bg-surface-300 border border-emerald-500/30 text-emerald-100 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {renderedOutput.renderedPrompt}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Declared Variables Schema & Diff Inspector Trigger */}
          <div className="space-y-6">
            {/* Variables Schema Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-violet-400" />
                Variable Schema ({selectedVersion.variables.length})
              </h3>

              <div className="space-y-2">
                {selectedVersion.variables.map((v) => (
                  <div
                    key={v.name}
                    className="p-3 rounded-xl bg-surface-100 border border-white/5 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-violet-300 font-bold">
                        {`{{${v.name}}}`}
                      </code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-50 text-slate-400 border border-white/5 font-mono">
                        {v.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {v.description || 'Auto-extracted template token'}
                    </p>
                    {v.defaultValue && (
                      <div className="text-[10px] text-slate-500">
                        Default: <span className="font-mono text-slate-300">{v.defaultValue}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Version Diff Launcher Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-cyan-400" />
                Compare Versions & Diff
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Baseline Version (v1)</label>
                  <select
                    value={diffV1Id}
                    onChange={(e) => setDiffV1Id(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  >
                    {prompt.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.lifecycleState})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Comparison Version (v2)</label>
                  <select
                    value={diffV2Id}
                    onChange={(e) => setDiffV2Id(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  >
                    {prompt.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.lifecycleState})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleComputeDiff}
                  disabled={diffLoading || !diffV1Id || !diffV2Id}
                  className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 transition text-xs"
                >
                  {diffLoading ? 'Computing Unified Diff...' : 'Compute Visual Diff'}
                </button>
              </div>

              {diffError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {diffError}
                </div>
              )}

              {/* Render Diff Output Modal / Card */}
              {diffData && (
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Unified Patch</span>
                    <span className="text-[10px] text-slate-400">
                      v{diffData.version1?.version} ➔ v{diffData.version2?.version}
                    </span>
                  </div>

                  {/* Parameter Diffs */}
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(diffData.parameterDiffs || {}).map(([param, val]: [string, any]) => {
                      if (!val.changed) return null;
                      return (
                        <div
                          key={param}
                          className="p-2 rounded bg-surface-100 border border-amber-500/30 text-amber-300 flex items-center justify-between"
                        >
                          <span className="capitalize font-semibold">{param}:</span>
                          <span>
                            {String(val.v1)} ➔ <strong className="text-white">{String(val.v2)}</strong>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unified Text Diff Box */}
                  <pre className="p-3 rounded-xl bg-surface-300 border border-white/5 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72 overflow-y-auto">
                    {diffData.lineChanges?.map((change: any, idx: number) => (
                      <div
                        key={idx}
                        className={
                          change.added
                            ? 'bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded'
                            : change.removed
                            ? 'bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded'
                            : 'text-slate-400'
                        }
                      >
                        {change.added ? '+ ' : change.removed ? '- ' : '  '}
                        {change.value}
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* State Transition Modal */}
      {isTransitionModalOpen && selectedVersion && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" />
              Transition Version Lifecycle
            </h3>
            <p className="text-xs text-slate-400">
              Moving version <strong className="text-white">v{selectedVersion.version}</strong> from current state{' '}
              <strong className="text-violet-300 uppercase">{selectedVersion.lifecycleState}</strong>.
            </p>

            {transitionError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {transitionError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Target Lifecycle State</label>
                <select
                  value={targetState}
                  onChange={(e) => setTargetState(e.target.value as LifecycleState)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value="draft">draft</option>
                  <option value="candidate">candidate</option>
                  <option value="approved">approved (Requires Approver Role)</option>
                  <option value="active">active (Promotes & Demotes Previous Active)</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Audit / Approval Note</label>
                <textarea
                  rows={3}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder="e.g. Offline benchmarks passed; moving to candidate for A/B testing."
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsTransitionModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleStateTransition}
                disabled={transitioning}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-600/30 transition"
              >
                {transitioning ? 'Executing...' : 'Confirm Transition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commit New Version Modal */}
      {isCommitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                Commit New Immutable Prompt Version
              </h3>
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {commitError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {commitError}
              </div>
            )}

            <form onSubmit={handleCommitNewVersion} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Version Label *</label>
                  <input
                    type="text"
                    required
                    value={newVersionLabel}
                    onChange={(e) => setNewVersionLabel(e.target.value)}
                    placeholder="e.g. 1.2.0"
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Model *</label>
                  <input
                    type="text"
                    required
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Temperature</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={newTemp}
                    onChange={(e) => setNewTemp(parseFloat(e.target.value))}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Prompt Template (Use <code className="text-violet-400">{`{{var_name}}`}</code>) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  System Instruction (Optional)
                </label>
                <input
                  type="text"
                  value={newSystemInstruction}
                  onChange={(e) => setNewSystemInstruction(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Commit Changelog *
                </label>
                <input
                  type="text"
                  required
                  value={newChangelog}
                  onChange={(e) => setNewChangelog(e.target.value)}
                  placeholder="Summary of changes in this version"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={committing}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md shadow-violet-600/30 transition"
                >
                  {committing ? 'Committing...' : 'Commit Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
