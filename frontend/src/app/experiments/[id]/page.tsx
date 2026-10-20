'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FlaskConical,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  Scale,
  Percent,
  Zap,
  DollarSign,
  Award,
  Layers,
} from 'lucide-react';
import { Logo } from '../../../components/Logo';
import {
  fetchExperiment,
  previewExperimentAssignment,
  fetchExperimentAnalysis,
} from '../../../lib/api';
import {
  Experiment,
  ExperimentAssignmentResult,
  ExperimentAnalysis,
} from '../../../lib/types';

export default function ExperimentDetailPage() {
  const params = useParams();
  const experimentId = params?.id as string;

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [analysis, setAnalysis] = useState<ExperimentAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment Preview State
  const [testSubjectId, setTestSubjectId] = useState('user_demo_1001');
  const [previewResult, setPreviewResult] = useState<ExperimentAssignmentResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [exp, an] = await Promise.all([
        fetchExperiment(experimentId),
        fetchExperimentAnalysis(experimentId),
      ]);
      setExperiment(exp);
      setAnalysis(an);
    } catch (err: any) {
      setError(err.message || 'Failed to load experiment analysis');
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    if (experimentId) loadData();
  }, [experimentId, loadData]);

  const handlePreviewAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSubjectId.trim()) return;
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const result = await previewExperimentAssignment(
        experimentId,
        testSubjectId.trim(),
      );
      setPreviewResult(result);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to calculate deterministic assignment');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 text-center text-xs text-slate-400 animate-pulse">
        Loading experiment telemetry and statistical analysis...
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-3">
          <p className="font-semibold text-sm">Error Loading Experiment</p>
          <p className="text-xs">{error || 'Experiment not found'}</p>
          <Link
            href="/experiments"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Experiments</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Navigation Breadcrumbs & Header with Logo */}
      <div className="space-y-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/experiments" className="hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Experiments</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-mono">{experiment.applicationId}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-cyan-400 font-medium">{experiment.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="md" showText={false} />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {experiment.name}
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {experiment.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {experiment.description || 'Controlled A/B test with deterministic traffic distribution.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/releases"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Release Candidate</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recommendation Banner */}
      {analysis && (
        <div
          className={`p-5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            analysis.recommendation === 'ready_for_release'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : analysis.recommendation === 'regressive'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : analysis.recommendation === 'promising'
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span className="font-bold text-sm uppercase tracking-wide">
                Recommendation: {analysis.recommendation.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              {analysis.recommendationReason}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider block opacity-75">
                Telemetry Source
              </span>
              <span className="font-semibold text-xs font-mono">
                {analysis.isOnlineTelemetry ? 'PRODUCTION TELEMETRY' : 'OFFLINE TEST RUNS'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis & Assignment Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Statistical Cohort Comparison */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sample Size & Statistical Power Guardrail Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">
                  Statistical Power & Minimum Sample Size Verification
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Threshold: N ≥ {analysis?.minimumSampleSizeRequired || 30}
              </span>
            </div>

            {analysis && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(analysis.variants).map(([varName, vData]) => {
                  const pctProgress = Math.min(
                    100,
                    (vData.sampleSize / analysis.minimumSampleSizeRequired) * 100,
                  );

                  return (
                    <div
                      key={varName}
                      className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white capitalize text-sm">
                          {varName} Cohort
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            vData.sampleSize >= analysis.minimumSampleSizeRequired
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {vData.sampleSize >= analysis.minimumSampleSizeRequired
                            ? 'POWER SATISFIED'
                            : 'ACCUMULATING SAMPLES'}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between text-xs text-slate-400">
                        <span>Sample Count</span>
                        <span className="text-sm font-bold text-white font-mono">
                          {vData.sampleSize} / {analysis.minimumSampleSizeRequired}
                        </span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                          style={{ width: `${pctProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Metric Comparisons Table with Welch's t-test */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-bold text-white">
                  Hypothesis Testing & Confidence Intervals (Welch t-Test)
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Confidence: 95% (α = 0.05)
              </span>
            </div>

            {analysis && Object.entries(analysis.comparisons).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No comparisons available yet.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(analysis?.comparisons || {}).map(([candName, comps]) => (
                  <div key={candName} className="space-y-3">
                    <span className="text-xs font-semibold text-cyan-300 block">
                      Candidate Variant: <span className="capitalize">{candName}</span> vs Control
                    </span>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-[11px] font-semibold text-slate-400 border-b border-white/10 bg-surface-200">
                          <tr>
                            <th className="py-2.5 px-3">Metric</th>
                            <th className="py-2.5 px-3">Control Mean</th>
                            <th className="py-2.5 px-3">Candidate Mean</th>
                            <th className="py-2.5 px-3">Delta (Δ)</th>
                            <th className="py-2.5 px-3">95% Confidence Interval</th>
                            <th className="py-2.5 px-3">p-Value</th>
                            <th className="py-2.5 px-3">Decision</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {comps.map((comp) => {
                            const isBetter = comp.status === 'better';
                            const isWorse = comp.status === 'worse';

                            return (
                              <tr key={comp.metric} className="hover:bg-white/5">
                                <td className="py-3 px-3 font-medium text-white capitalize">
                                  {comp.metric.replace(/([A-Z])/g, ' $1')}
                                </td>
                                <td className="py-3 px-3 font-mono">
                                  {comp.controlMean}
                                </td>
                                <td className="py-3 px-3 font-mono">
                                  {comp.candidateMean}
                                </td>
                                <td className="py-3 px-3 font-mono font-semibold">
                                  <span
                                    className={
                                      isBetter
                                        ? 'text-emerald-400'
                                        : isWorse
                                        ? 'text-rose-400'
                                        : 'text-slate-300'
                                    }
                                  >
                                    {comp.percentageDelta > 0 ? '+' : ''}
                                    {comp.percentageDelta}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 font-mono text-[11px]">
                                  {comp.confidenceInterval95 ? (
                                    <span>
                                      [{comp.confidenceInterval95[0]}, {comp.confidenceInterval95[1]}]
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 italic">
                                      Insufficient data
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-mono">
                                  {comp.pValue !== null ? (
                                    <span
                                      className={
                                        comp.isSignificant
                                          ? 'font-bold text-violet-300'
                                          : 'text-slate-400'
                                      }
                                    >
                                      p = {comp.pValue}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  {comp.isSignificant ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isBetter
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      }`}
                                    >
                                      {isBetter ? 'SIGNIFICANT WIN' : 'REGRESSION'}
                                    </span>
                                  ) : comp.hasSufficientSample ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                      NOT SIGNIFICANT
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      N &lt; 30 REQUIRED
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Deterministic Bucketing Tester Card */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                Deterministic Bucketing Tester
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify reproducible cohort assignment. The same subject identifier will always hash to the identical bucket across sessions.
            </p>

            <form onSubmit={handlePreviewAssignment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Test Subject Identifier
                </label>
                <input
                  type="text"
                  required
                  value={testSubjectId}
                  onChange={(e) => setTestSubjectId(e.target.value)}
                  placeholder="e.g. user_98214 or session_xyz"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={previewLoading}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-xs shadow-md shadow-cyan-600/30"
              >
                {previewLoading ? 'Resolving Bucket...' : 'Resolve Cohort Assignment'}
              </button>
            </form>

            {previewError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {previewError}
              </div>
            )}

            {previewResult && (
              <div className="p-4 rounded-xl bg-surface-100 border border-cyan-500/30 space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                  Deterministic Assignment Result
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assigned Cohort:</span>
                  <span className="font-bold text-sm text-white capitalize px-2 py-0.5 rounded bg-surface-200 border border-white/10">
                    {previewResult.assignedVariant}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Version:</span>
                  <span className="font-mono text-cyan-300">
                    {previewResult.assignedVersionId}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bucket Index (0-99):</span>
                  <span className="font-mono font-bold text-white">
                    #{previewResult.bucket}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">SHA-256 Hash Digest:</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {previewResult.hash}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5 text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Reproducibility confirmed for tenant {previewResult.tenantId}</span>
                </div>
              </div>
            )}
          </div>

          {/* Experiment Objectives & Details Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-violet-400" />
              Evaluation Objectives
            </h3>

            <div className="space-y-2">
              {experiment.objectives.map((obj, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-surface-100 border border-white/5 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white capitalize">
                      {obj.metric.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase font-bold">
                      {obj.direction} is better
                    </span>
                  </div>
                  {obj.description && (
                    <p className="text-[11px] text-slate-400">{obj.description}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-slate-500">
              Salt / Random Seed: <code className="text-slate-400 font-mono">{experiment.seed}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
