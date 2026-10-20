'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GitCompare,
  Plus,
  Play,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  FileCode,
  DollarSign,
  Zap,
  Activity,
  Layers,
  Search,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import {
  fetchDatasets,
  createDataset,
  triggerEvaluationRun,
  fetchEvaluationRuns,
  fetchPrompts,
} from '../../lib/api';
import { Dataset, EvaluationRun, Prompt } from '../../lib/types';

export default function EvaluationsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Run Eval Execution State
  const [runPromptId, setRunPromptId] = useState('');
  const [runVersionId, setRunVersionId] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalSuccess, setEvalSuccess] = useState<string | null>(null);

  // New Dataset Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dsName, setDsName] = useState('');
  const [dsAppId, setDsAppId] = useState('customer-support-agent');
  const [dsVersion, setDsVersion] = useState('1.0.0');
  const [dsDesc, setDsDesc] = useState('');
  const [dsCasesJson, setDsCasesJson] = useState(`[
  {
    "caseId": "tc_1",
    "inputVariables": {
      "customer_name": "Jordan Bell",
      "product_name": "Cloud Storage Enterprise",
      "issue_summary": "Storage quota limit exceeded after sync"
    },
    "referenceOutput": "We have temporarily increased your quota while investigating."
  }
]`);
  const [creatingDs, setCreatingDs] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dList, rList, pList] = await Promise.all([
        fetchDatasets(),
        fetchEvaluationRuns(),
        fetchPrompts(),
      ]);
      setDatasets(dList);
      setRuns(rList);
      setPrompts(pList);

      if (dList.length > 0) {
        setSelectedDataset(dList[0]);
      }
      if (rList.length > 0) {
        setSelectedRun(rList[0]);
      }
      if (pList.length > 0) {
        setRunPromptId(pList[0].id);
        if (pList[0].versions && pList[0].versions.length > 0) {
          setRunVersionId(pList[0].versions[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load evaluation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePromptChange = (pId: string) => {
    setRunPromptId(pId);
    const p = prompts.find((x) => x.id === pId);
    if (p && p.versions && p.versions.length > 0) {
      setRunVersionId(p.versions[0].id);
    }
  };

  const handleTriggerRun = async () => {
    if (!selectedDataset || !runPromptId || !runVersionId) return;
    try {
      setEvaluating(true);
      setEvalError(null);
      setEvalSuccess(null);

      const run = await triggerEvaluationRun({
        datasetId: selectedDataset.id,
        promptId: runPromptId,
        promptVersionId: runVersionId,
      });

      setSelectedRun(run);
      setEvalSuccess(`Offline evaluation run ${run.id} completed! (${run.passedCases}/${run.totalCases} cases passed)`);
      await loadData();
    } catch (err: any) {
      setEvalError(err.message || 'Evaluation run failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingDs(true);
      setModalError(null);

      let parsedCases = [];
      try {
        parsedCases = JSON.parse(dsCasesJson);
      } catch {
        throw new Error('Test cases must be valid JSON array of objects.');
      }

      await createDataset({
        name: dsName,
        applicationId: dsAppId,
        version: dsVersion,
        description: dsDesc,
        testCases: parsedCases,
      });

      setIsModalOpen(false);
      setDsName('');
      setDsDesc('');
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create dataset');
    } finally {
      setCreatingDs(false);
    }
  };

  const currentPrompt = prompts.find((p) => p.id === runPromptId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Page Header with Logo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="shrink-0 mt-1 sm:mt-0">
            <Logo size="md" showText={false} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Offline Evaluation Benchmarks
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Run prompt versions through versioned golden datasets, verify outputs against reference benchmarks, and measure latency & token economics.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Benchmark Dataset</span>
        </button>
      </div>

      {evalSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{evalSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Evaluation Runner Launcher Panel */}
      <div className="glass-panel rounded-2xl p-6 space-y-4 border border-indigo-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">
              Execute Offline Evaluation Run
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Recorded model metadata & latency statistics
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Select Dataset Benchmark
            </label>
            <select
              value={selectedDataset?.id || ''}
              onChange={(e) => {
                const found = datasets.find((d) => d.id === e.target.value);
                if (found) setSelectedDataset(found);
              }}
              className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (v{d.version} - {d.testCases.length} cases)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Prompt Catalog
            </label>
            <select
              value={runPromptId}
              onChange={(e) => handlePromptChange(e.target.value)}
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
              Prompt Version to Test
            </label>
            <select
              value={runVersionId}
              onChange={(e) => setRunVersionId(e.target.value)}
              className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white"
            >
              {currentPrompt?.versions?.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} ({v.lifecycleState})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {evalError && (
            <div className="text-rose-400 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{evalError}</span>
            </div>
          )}
          <div className="ml-auto">
            <button
              onClick={handleTriggerRun}
              disabled={evaluating || !selectedDataset || !runVersionId}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{evaluating ? 'Running Test Cases...' : 'Execute Evaluation Runner'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Datasets and Run Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Versioned Datasets & Test Cases */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Benchmark Datasets ({datasets.length})
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {datasets.map((d) => {
                const isSelected = selectedDataset?.id === d.id;

                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDataset(d)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition space-y-1 ${
                      isSelected
                        ? 'bg-surface-100 border-indigo-500/50 ring-1 ring-indigo-500/50'
                        : 'bg-surface-200 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{d.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono font-bold">
                        v{d.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {d.description || 'No description'}
                    </p>
                    <div className="text-[10px] text-slate-500">
                      {d.testCases.length} test cases configured
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test Cases in Selected Dataset */}
          {selectedDataset && (
            <div className="glass-panel rounded-2xl p-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Test Cases in {selectedDataset.name}</span>
                <span className="font-mono text-white">{selectedDataset.testCases.length}</span>
              </h4>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {selectedDataset.testCases.map((tc, idx) => (
                  <div
                    key={tc.caseId || idx}
                    className="p-3 rounded-xl bg-surface-100 border border-white/5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-300">
                        {tc.caseId}
                      </span>
                      {tc.tags && tc.tags.length > 0 && (
                        <div className="flex gap-1">
                          {tc.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.2 rounded bg-surface-50 text-slate-400 border border-white/5">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div>
                        <strong className="text-slate-300">Inputs:</strong>{' '}
                        <code className="text-violet-300 font-mono text-[10px]">
                          {JSON.stringify(tc.inputVariables)}
                        </code>
                      </div>
                      {tc.referenceOutput && (
                        <div className="truncate">
                          <strong className="text-slate-300">Ref:</strong> {tc.referenceOutput}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 2 Cols: Evaluation Run Inspection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Runs List */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white">
                  Historical Evaluation Runs ({runs.length})
                </h3>
              </div>
            </div>

            {runs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No evaluation runs recorded. Execute a run above.
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((r) => {
                  const isSelected = selectedRun?.id === r.id;

                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRun(r)}
                      className={`w-full text-left p-4 rounded-xl border transition space-y-2 ${
                        isSelected
                          ? 'bg-surface-100 border-violet-500/50 ring-1 ring-violet-500/50'
                          : 'bg-surface-200 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            Run: {r.id}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
                            v{r.promptVersionId.replace('ver_', '').slice(0, 8)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.isSimulated
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {r.isSimulated ? 'SIMULATED RUN' : 'LIVE API EXECUTION'}
                          </span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {new Date(r.executedAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Summary Metrics Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="p-2 rounded-lg bg-surface-300">
                          <span className="text-[10px] text-slate-400 block">Passed Cases</span>
                          <span className="font-bold text-white font-mono">
                            {r.passedCases} / {r.totalCases}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-300">
                          <span className="text-[10px] text-slate-400 block">Avg Quality</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {(r.summary.avgQualityScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-300">
                          <span className="text-[10px] text-slate-400 block">p95 Latency</span>
                          <span className="font-bold text-cyan-400 font-mono">
                            {r.summary.p95LatencyMs}ms
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-300">
                          <span className="text-[10px] text-slate-400 block">Est. Cost</span>
                          <span className="font-bold text-slate-200 font-mono">
                            ${r.summary.totalCostUsd.toFixed(5)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Run Per-Case Breakdown Table */}
          {selectedRun && (
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-bold text-white">
                  Per-Case Execution Output & Tokens ({selectedRun.results.length})
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  Model: {selectedRun.modelMetadata.model} (t={selectedRun.modelMetadata.temperature})
                </span>
              </div>

              <div className="space-y-3">
                {selectedRun.results.map((res, i) => (
                  <div
                    key={res.caseId || i}
                    className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{res.caseId}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            res.passed
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {res.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                        <span>Quality: {(res.qualityScore * 100).toFixed(0)}%</span>
                        <span>{res.latencyMs}ms</span>
                        <span>{res.tokensUsed?.totalTokens} tokens</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        Model Output:
                      </span>
                      <p className="p-2.5 rounded-lg bg-surface-300 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                        {res.outputAnswer}
                      </p>
                    </div>

                    {res.referenceOutput && (
                      <div className="text-[11px] text-slate-400">
                        <strong className="text-slate-300">Reference:</strong> {res.referenceOutput}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Benchmark Dataset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                Create New Benchmark Dataset
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateDataset} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">
                    Dataset Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={dsName}
                    onChange={(e) => setDsName(e.target.value)}
                    placeholder="e.g. support-golden-v2"
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">
                    Application ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={dsAppId}
                    onChange={(e) => setDsAppId(e.target.value)}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Dataset Version
                </label>
                <input
                  type="text"
                  required
                  value={dsVersion}
                  onChange={(e) => setDsVersion(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Description
                </label>
                <input
                  type="text"
                  value={dsDesc}
                  onChange={(e) => setDsDesc(e.target.value)}
                  placeholder="Benchmark cases description"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Test Cases JSON (Array of objects with inputVariables) *
                </label>
                <textarea
                  rows={6}
                  required
                  value={dsCasesJson}
                  onChange={(e) => setDsCasesJson(e.target.value)}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 font-mono text-[11px] text-white"
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
                  disabled={creatingDs}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 transition"
                >
                  {creatingDs ? 'Creating...' : 'Create Dataset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
