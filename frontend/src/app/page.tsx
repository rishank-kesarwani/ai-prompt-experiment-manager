'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  FlaskConical,
  CheckCircle2,
  GitCompare,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  TrendingUp,
  History,
  Activity,
  Plus,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import {
  fetchPrompts,
  fetchExperiments,
  fetchReleases,
  fetchEvaluationRuns,
  fetchAuditLogs,
  rollbackReleaseProposal,
} from '../lib/api';
import {
  Prompt,
  Experiment,
  ReleaseDecision,
  EvaluationRun,
  AuditEvent,
} from '../lib/types';

export default function OverviewDashboard() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [releases, setReleases] = useState<ReleaseDecision[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rollback action state
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, e, r, ev, a] = await Promise.all([
        fetchPrompts().catch(() => []),
        fetchExperiments().catch(() => []),
        fetchReleases().catch(() => []),
        fetchEvaluationRuns().catch(() => []),
        fetchAuditLogs().catch(() => []),
      ]);
      setPrompts(p);
      setExperiments(e);
      setReleases(r);
      setRuns(ev);
      setAuditEvents(a);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickRollback = async (release: ReleaseDecision) => {
    if (!confirm(`Are you sure you want to trigger an emergency rollback for release ${release.id}?`)) {
      return;
    }
    try {
      setRollbackLoading(true);
      await rollbackReleaseProposal(release.id, 'Triggered 1-click rollback from overview dashboard');
      setRollbackSuccess(`Emergency rollback executed for release ${release.id}. Traffic restored to baseline.`);
      await loadData();
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    } finally {
      setRollbackLoading(false);
    }
  };

  const activeReleases = releases.filter(
    (r) => r.status === 'active' || r.status === 'partially_rolled_out',
  );
  const runningExperiments = experiments.filter((e) => e.status === 'running');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Page Title with Brand Logo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="shrink-0 mt-1 sm:mt-0">
            <Logo size="md" showText={false} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Prompt Release & Experimentation Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Audit immutable prompt versions, enforce fail-closed quality gates, and conduct controlled A/B rollouts.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Link
            href="/prompts"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-hover border border-white/10 text-xs font-medium text-slate-200 transition"
          >
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>Manage Prompts</span>
          </Link>
          <Link
            href="/experiments"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-hover border border-white/10 text-xs font-medium text-slate-200 transition"
          >
            <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
            <span>New Experiment</span>
          </Link>
          <Link
            href="/evaluations"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-hover border border-white/10 text-xs font-medium text-slate-200 transition"
          >
            <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Evals</span>
          </Link>
          <Link
            href="/releases"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Release Decisions</span>
          </Link>
        </div>
      </div>

      {rollbackSuccess && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>{rollbackSuccess}</span>
          </div>
          <button
            onClick={() => setRollbackSuccess(null)}
            className="text-xs text-amber-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Prompts */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Prompt Catalogs
            </span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {loading ? '...' : prompts.length}
            </span>
            <span className="text-xs text-emerald-400 font-medium flex items-center">
              Active versions locked
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Immutable SHA-256 integrity checks
          </div>
        </div>

        {/* Running Experiments */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Controlled A/B Tests
            </span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {loading ? '...' : runningExperiments.length}
            </span>
            <span className="text-xs text-cyan-300 font-medium">
              Deterministic Bucketing
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Welch t-test hypothesis verification
          </div>
        </div>

        {/* Staged Rollouts */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Active Staged Releases
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {loading ? '...' : activeReleases.length}
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              Automated Gates Passed
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            1-click auditable rollback enabled
          </div>
        </div>

        {/* Offline Evals */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Evaluation Runs
            </span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <GitCompare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {loading ? '...' : runs.length}
            </span>
            <span className="text-xs text-indigo-300 font-medium">
              Golden Benchmarks
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Recorded model metadata & tokens
          </div>
        </div>
      </div>

      {/* Main Grid: Active Releases & Running Experiments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Staged Releases Section */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Active Staged Releases & Rollouts
              </h2>
            </div>
            <Link
              href="/releases"
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Loading active release gates...
            </div>
          ) : activeReleases.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-xl">
              No releases currently deployed. Propose a new release candidate in Releases.
            </div>
          ) : (
            <div className="space-y-3">
              {activeReleases.map((rel) => (
                <div
                  key={rel.id}
                  className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          Prompt: {rel.promptId}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {rel.rolloutPercentage}% TRAFFIC
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Target Version: <span className="font-mono text-slate-300">{rel.targetVersionId}</span> | Baseline:{' '}
                        <span className="font-mono text-slate-300">{rel.currentActiveVersionId || 'None'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuickRollback(rel)}
                        disabled={rollbackLoading}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3 text-rose-400" />
                        <span>Emergency Rollback</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Rollout Progression</span>
                      <span className="font-semibold text-white">{rel.rolloutPercentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${rel.rolloutPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Gate Evidence Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    {rel.gateChecks.map((g) => (
                      <span
                        key={g.ruleId}
                        className={`px-2 py-0.5 rounded border ${
                          g.status === 'PASS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : g.status === 'WARN'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {g.ruleName}: {g.status}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Running A/B Experiments Section */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">
                Live A/B Experiments
              </h2>
            </div>
            <Link
              href="/experiments"
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>Explore Experiments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Loading experiment cohorts...
            </div>
          ) : runningExperiments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-xl">
              No active experiments running. Create an A/B test with candidate versions.
            </div>
          ) : (
            <div className="space-y-3">
              {runningExperiments.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {exp.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        App: <span className="text-slate-300">{exp.applicationId}</span> | Total Cohort Assignments:{' '}
                        <span className="font-semibold text-white">{exp.totalAssignments}</span>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      RUNNING
                    </span>
                  </div>

                  {/* Variant Splits */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {exp.variants.map((v) => (
                      <div
                        key={v.variantName}
                        className="p-2.5 rounded-lg bg-surface-200 border border-white/5 flex items-center justify-between"
                      >
                        <span className="text-slate-300 font-medium capitalize">
                          {v.variantName}
                        </span>
                        <span className="font-bold text-cyan-400">
                          {v.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-400 text-[11px]">
                      Deterministic Seed: <code className="text-slate-300 font-mono">{exp.seed.slice(0, 10)}...</code>
                    </span>
                    <Link
                      href={`/experiments/${exp.id}`}
                      className="text-cyan-400 hover:underline text-xs font-semibold flex items-center gap-1"
                    >
                      <span>Analyze Significance</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Immutable Audit Trail Feed */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-bold text-white">
              Immutable Audit Events Feed
            </h2>
          </div>
          <Link
            href="/audit"
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
          >
            <span>Full Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
            Loading recent audit events...
          </div>
        ) : auditEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-xl">
            No audit records found.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {auditEvents.slice(0, 5).map((evt) => (
              <div
                key={evt.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {evt.action}
                  </span>
                  <div>
                    <span className="text-slate-200 font-medium">
                      Resource: {evt.resourceType} ({evt.resourceId})
                    </span>
                    <span className="text-slate-400 text-[11px] block sm:inline sm:ml-2">
                      by <strong className="text-slate-300">{evt.actor}</strong>
                    </span>
                  </div>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
