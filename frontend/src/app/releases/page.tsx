'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Plus,
  Play,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  Sliders,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import {
  fetchReleases,
  fetchPrompts,
  createReleaseProposal,
  evaluateReleaseGates,
  approveReleaseProposal,
  updateReleaseRollout,
  rollbackReleaseProposal,
  getSessionRole,
} from '../../lib/api';
import { ReleaseDecision, Prompt, UserRole } from '../../lib/types';

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseDecision[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proposal Modal State
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [targetPromptId, setTargetPromptId] = useState('');
  const [targetVersionId, setTargetVersionId] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);

  // Approval Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rolloutPercentage, setRolloutPercentage] = useState(100);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Rollback Modal State
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  // Staged Rollout Adjustment State
  const [rolloutAdjustValue, setRolloutAdjustValue] = useState<number>(50);
  const [updatingRollout, setUpdatingRollout] = useState(false);

  const [activeRole, setActiveRole] = useState<UserRole>('approver');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rList, pList] = await Promise.all([
        fetchReleases(),
        fetchPrompts(),
      ]);
      setReleases(rList);
      setPrompts(pList);
      if (rList.length > 0) {
        setSelectedRelease(rList[0]);
        setRolloutAdjustValue(rList[0].rolloutPercentage);
      }
      if (pList.length > 0) {
        setTargetPromptId(pList[0].id);
        if (pList[0].versions && pList[0].versions.length > 0) {
          setTargetVersionId(
            pList[0].versions.length > 1 ? pList[0].versions[1].id : pList[0].versions[0].id,
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setActiveRole(getSessionRole());
  }, []);

  const handlePromptSelectChange = (pId: string) => {
    setTargetPromptId(pId);
    const p = prompts.find((x) => x.id === pId);
    if (p && p.versions && p.versions.length > 0) {
      setTargetVersionId(
        p.versions.length > 1 ? p.versions[1].id : p.versions[0].id,
      );
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProposing(true);
      setProposeError(null);

      const p = prompts.find((x) => x.id === targetPromptId);
      const rel = await createReleaseProposal({
        promptId: targetPromptId,
        targetVersionId,
        applicationId: p?.applicationId || 'customer-support-agent',
      });

      setIsProposeModalOpen(false);
      await loadData();
      setSelectedRelease(rel);
    } catch (err: any) {
      setProposeError(err.message || 'Failed to propose release');
    } finally {
      setProposing(false);
    }
  };

  const handleEvaluateGates = async (relId: string) => {
    try {
      setLoading(true);
      const updated = await evaluateReleaseGates(relId, {});
      setSelectedRelease(updated);
      await loadData();
    } catch (err: any) {
      alert(`Gate evaluation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelease) return;
    try {
      setApproving(true);
      setApproveError(null);

      const updated = await approveReleaseProposal(
        selectedRelease.id,
        approvalNotes,
        rolloutPercentage,
      );

      setIsApproveModalOpen(false);
      setSelectedRelease(updated);
      setApprovalNotes('');
      await loadData();
    } catch (err: any) {
      setApproveError(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelease) return;
    try {
      setRollingBack(true);
      setRollbackError(null);

      const updated = await rollbackReleaseProposal(
        selectedRelease.id,
        rollbackReason,
      );

      setIsRollbackModalOpen(false);
      setSelectedRelease(updated);
      setRollbackReason('');
      await loadData();
    } catch (err: any) {
      setRollbackError(err.message || 'Rollback execution failed');
    } finally {
      setRollingBack(false);
    }
  };

  const handleUpdateRollout = async () => {
    if (!selectedRelease) return;
    try {
      setUpdatingRollout(true);
      const updated = await updateReleaseRollout(
        selectedRelease.id,
        rolloutAdjustValue,
        `Adjusted rollout percentage to ${rolloutAdjustValue}%`,
      );
      setSelectedRelease(updated);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update rollout percentage: ${err.message}`);
    } finally {
      setUpdatingRollout(false);
    }
  };

  const selectedPrompt = prompts.find((p) => p.id === targetPromptId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Header with Logo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <Logo size="md" showText={false} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Release Gates & Staged Rollouts
            </h1>
            <p className="text-sm text-slate-400">
              Verify SLA criteria with fail-closed external quality gates, require human approvals, and control staged canary percentages.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsProposeModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Propose Release Candidate</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Release List & Gate Verification Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Releases List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Release Proposals ({releases.length})
            </span>
          </div>

          {releases.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl p-6">
              No release proposals configured.
            </div>
          ) : (
            <div className="space-y-3">
              {releases.map((rel) => {
                const isSelected = selectedRelease?.id === rel.id;
                const isRolledBack = rel.status === 'rolled_back';

                return (
                  <button
                    key={rel.id}
                    onClick={() => {
                      setSelectedRelease(rel);
                      setRolloutAdjustValue(rel.rolloutPercentage);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition space-y-2 ${
                      isSelected
                        ? 'bg-surface-100 border-violet-500/50 ring-1 ring-violet-500/50'
                        : 'bg-surface-200 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">
                        {rel.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isRolledBack
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : rel.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : rel.status === 'partially_rolled_out'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {rel.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Target Version:{' '}
                      <span className="font-mono text-cyan-400 font-semibold">
                        {rel.targetVersionId}
                      </span>
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span>Rollout: {rel.rolloutPercentage}%</span>
                      <span
                        className={`font-semibold ${
                          rel.overallGateStatus === 'PASS'
                            ? 'text-emerald-400'
                            : rel.overallGateStatus === 'WARN'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        Gate: {rel.overallGateStatus}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Cols: Selected Release Details & Quality Gates */}
        {selectedRelease && (
          <div className="lg:col-span-2 space-y-6">
            {/* Release Header & Actions */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      Release {selectedRelease.id}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      {selectedRelease.applicationId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target: <span className="font-mono text-white">{selectedRelease.targetVersionId}</span> | Baseline:{' '}
                    <span className="font-mono text-slate-300">{selectedRelease.currentActiveVersionId || 'None'}</span>
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEvaluateGates(selectedRelease.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition"
                  >
                    <Play className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Re-evaluate Gates</span>
                  </button>

                  {selectedRelease.status !== 'rolled_back' && (
                    <button
                      onClick={() => setIsRollbackModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>1-Click Rollback</span>
                    </button>
                  )}

                  {selectedRelease.status !== 'active' && selectedRelease.status !== 'rolled_back' && (
                    <button
                      onClick={() => setIsApproveModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Release</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Overall Gate Verification</span>
                  <span
                    className={`font-bold text-sm mt-0.5 block ${
                      selectedRelease.overallGateStatus === 'PASS'
                        ? 'text-emerald-400'
                        : selectedRelease.overallGateStatus === 'WARN'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    STATUS: {selectedRelease.overallGateStatus}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Rollout Traffic Level</span>
                  <span className="font-bold text-sm text-cyan-400 font-mono mt-0.5 block">
                    {selectedRelease.rolloutPercentage}% Live Cohort
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Manual Approval State</span>
                  <span className="font-semibold text-white mt-0.5 block truncate">
                    {selectedRelease.approvedBy || 'Pending Formal Approval'}
                  </span>
                </div>
              </div>

              {/* Rollout Percentage Slider for Live Staged Rollouts */}
              {selectedRelease.status !== 'rolled_back' && (
                <div className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Staged Canary Rollout Percentage</span>
                    </span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {rolloutAdjustValue}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={rolloutAdjustValue}
                    onChange={(e) => setRolloutAdjustValue(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      At 100%, version promotion is locked in the catalog.
                    </span>
                    <button
                      onClick={handleUpdateRollout}
                      disabled={updatingRollout || rolloutAdjustValue === selectedRelease.rolloutPercentage}
                      className="px-3 py-1.5 rounded-lg bg-surface-50 hover:bg-white/10 text-slate-200 text-xs font-semibold transition border border-white/10"
                    >
                      {updatingRollout ? 'Applying...' : 'Apply Rollout %'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Gates Evidence Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Quality Gate Rules & Verification Evidence
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Fail-Closed Policy Enforced
                </span>
              </div>

              <div className="space-y-3">
                {selectedRelease.gateChecks.map((gate) => {
                  const isPass = gate.status === 'PASS';
                  const isWarn = gate.status === 'WARN';

                  return (
                    <div
                      key={gate.ruleId}
                      className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          {gate.ruleName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPass
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : isWarn
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {gate.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        {gate.details}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                        <span>Threshold: {String(gate.thresholdValue)}</span>
                        <span>Evaluated: {new Date(gate.evaluatedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approval / Rollback History Card */}
            {(selectedRelease.approvalNotes || selectedRelease.rollbackReason) && (
              <div className="glass-panel rounded-2xl p-6 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-white">
                  Audit Notes & Incident History
                </h3>

                {selectedRelease.approvalNotes && (
                  <div className="p-3 rounded-xl bg-surface-100 border border-white/5 space-y-1">
                    <span className="text-emerald-400 font-semibold block text-[11px]">
                      Approval Justification by {selectedRelease.approvedBy}:
                    </span>
                    <p className="text-slate-300">{selectedRelease.approvalNotes}</p>
                  </div>
                )}

                {selectedRelease.rollbackReason && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                    <span className="text-rose-400 font-semibold block text-[11px]">
                      Emergency Rollback Reason (at {new Date(selectedRelease.rolledBackAt || '').toLocaleString()}):
                    </span>
                    <p className="text-rose-200">{selectedRelease.rollbackReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Propose Release Candidate Modal */}
      {isProposeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-400" />
              Propose New Release Candidate
            </h3>

            {proposeError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {proposeError}
              </div>
            )}

            <form onSubmit={handleCreateProposal} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Target Prompt Catalog *
                </label>
                <select
                  value={targetPromptId}
                  onChange={(e) => handlePromptSelectChange(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Candidate Version to Release *
                </label>
                <select
                  value={targetVersionId}
                  onChange={(e) => setTargetVersionId(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                >
                  {selectedPrompt?.versions?.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ({v.lifecycleState})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsProposeModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposing}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md shadow-violet-600/30 transition"
                >
                  {proposing ? 'Proposing...' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Release Modal */}
      {isApproveModalOpen && selectedRelease && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Approve Production Release
            </h3>
            <p className="text-xs text-slate-400">
              You are approving version <strong className="text-white font-mono">{selectedRelease.targetVersionId}</strong> for production routing.
            </p>

            {approveError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {approveError}
              </div>
            )}

            <form onSubmit={handleApprove} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Initial Rollout Percentage
                </label>
                <select
                  value={rolloutPercentage}
                  onChange={(e) => setRolloutPercentage(parseInt(e.target.value, 10))}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value={10}>10% Canary Staged Rollout</option>
                  <option value={25}>25% Cohort Rollout</option>
                  <option value={50}>50% Traffic Rollout</option>
                  <option value={100}>100% Full Production Promotion</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Approval Notes & Verification Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="e.g. Offline benchmarks passed with 0 regressions; approved for deployment."
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/30 transition"
                >
                  {approving ? 'Approving...' : 'Sign Off & Deploy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Rollback Modal */}
      {isRollbackModalOpen && selectedRelease && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-4 border border-rose-500/30 shadow-2xl">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-400" />
              Trigger Emergency 1-Click Rollback
            </h3>
            <p className="text-xs text-slate-300">
              This will immediately divert 100% of live traffic back to baseline version{' '}
              <strong className="text-white font-mono">{selectedRelease.currentActiveVersionId || 'Initial baseline'}</strong> and dispatch a high-priority incident alert.
            </p>

            {rollbackError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {rollbackError}
              </div>
            )}

            <form onSubmit={handleRollback} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Rollback Incident Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="e.g. Elevating customer confusion or latency spike detected in production."
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsRollbackModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rollingBack}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md shadow-rose-600/30 transition"
                >
                  {rollingBack ? 'Executing Rollback...' : 'Execute Rollback Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
