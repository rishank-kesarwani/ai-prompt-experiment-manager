'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  ArrowRight,
  Tag,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { fetchPrompts, createPrompt } from '../../lib/api';
import { Prompt } from '../../lib/types';

export default function PromptsCatalogPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [applicationId, setApplicationId] = useState('customer-support-agent');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('support, production');
  const [version, setVersion] = useState('1.0.0');
  const [template, setTemplate] = useState('Hello {{customer_name}}, thank you for contacting {{company_name}} regarding {{issue_topic}}.');
  const [systemInstruction, setSystemInstruction] = useState('You are an expert AI customer support assistant.');
  const [model, setModel] = useState('gemini-1.5-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [changelog, setChangelog] = useState('Initial production baseline prompt template');

  const loadPrompts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPrompts();
      setPrompts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);

      const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);

      await createPrompt({
        name,
        applicationId,
        description,
        tags: parsedTags,
        initialVersion: {
          version,
          template,
          systemInstruction,
          parameters: {
            model,
            provider: 'google-vertex',
            temperature: Number(temperature),
          },
          changelog,
        },
      });

      setIsModalOpen(false);
      setName('');
      setDescription('');
      await loadPrompts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create prompt catalog');
    } finally {
      setSubmitting(false);
    }
  };

  const applications = Array.from(new Set(prompts.map((p) => p.applicationId)));

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesApp = selectedApp === 'all' || p.applicationId === selectedApp;

    return matchesSearch && matchesApp;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Page Title with Brand Logo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <Logo size="md" showText={false} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Prompt Version Catalog
            </h1>
            <p className="text-sm text-slate-400">
              Manage immutable prompt versions, template variables, and state transitions with cryptographic checksums.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Prompt Catalog</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search prompts or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-100 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Applications</option>
            {applications.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Prompts Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
          Loading prompt catalog...
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl p-8 space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-medium text-slate-300">No prompt templates found</p>
          <p className="text-slate-500">Create a prompt catalog to begin tracking immutable versions and variable schemas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {prompt.applicationId}
                  </span>
                  {prompt.activeVersionId ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Active: {prompt.activeVersionId.replace('ver_', '').slice(0, 8)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3 h-3" />
                      No Active Release
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition">
                  {prompt.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {prompt.description || 'No description provided.'}
                </p>

                {/* Tags */}
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {prompt.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded text-[10px] bg-surface-50 text-slate-400 border border-white/5"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Revision #{prompt.revision}
                </span>

                <Link
                  href={`/prompts/${prompt.id}`}
                  className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 group"
                >
                  <span>Inspect & Diff</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Prompt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 space-y-6 my-8 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                Create New Prompt Catalog
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePrompt} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Prompt Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Order Assistant Concierge"
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
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
                    placeholder="e.g. customer-support-agent"
                    className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary prompt for customer support interactions"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="support, orders, tier1"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-2 border-t border-white/10">
                <span className="text-violet-400 font-bold block mb-3 uppercase tracking-wider text-[11px]">
                  Initial Baseline Version Specification
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Version Label</label>
                    <input
                      type="text"
                      required
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Model</label>
                    <input
                      type="text"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Temperature</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="2"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Prompt Template (Use <code className="text-violet-400">{`{{var_name}}`}</code>) *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      System Instruction (Optional)
                    </label>
                    <input
                      type="text"
                      value={systemInstruction}
                      onChange={(e) => setSystemInstruction(e.target.value)}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Commit Changelog *
                    </label>
                    <input
                      type="text"
                      required
                      value={changelog}
                      onChange={(e) => setChangelog(e.target.value)}
                      className="w-full bg-surface-100 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-100 hover:bg-white/5 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition shadow-md shadow-violet-600/30"
                >
                  {submitting ? 'Creating Catalog...' : 'Create Prompt Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
