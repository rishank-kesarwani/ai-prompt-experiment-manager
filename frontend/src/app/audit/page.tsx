'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  Search,
  Filter,
  Shield,
  Clock,
  Layers,
  FlaskConical,
  CheckCircle2,
  GitCompare,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { fetchAuditLogs } from '../../lib/api';
import { AuditEvent } from '../../lib/types';

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditLogs(
        selectedResourceType === 'all' ? undefined : selectedResourceType,
      );
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [selectedResourceType]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredEvents = events.filter((e) => {
    const q = searchQuery.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      e.actor.toLowerCase().includes(q) ||
      e.resourceId.toLowerCase().includes(q) ||
      JSON.stringify(e.details).toLowerCase().includes(q)
    );
  });

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
              Immutable Governance Audit Trail
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Cryptographically timestamped record of prompt version commits, lifecycle state transitions, gate checks, and rollbacks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs font-mono font-medium">
            {events.length} Events Logged
          </span>
        </div>
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
            placeholder="Search action, actor, or resource ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-100 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedResourceType}
            onChange={(e) => setSelectedResourceType(e.target.value)}
            className="bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Resource Types</option>
            <option value="prompt">Prompt Catalogs</option>
            <option value="version">Prompt Versions</option>
            <option value="experiment">A/B Experiments</option>
            <option value="release">Releases & Gates</option>
            <option value="dataset">Datasets</option>
            <option value="evaluation">Evaluation Runs</option>
          </select>
        </div>
      </div>

      {/* Audit Events Feed */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
          Loading audit events...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl p-8 space-y-2">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No matching audit events</p>
          <p className="text-slate-500 text-xs">Mutations, approvals, and transitions will be permanently recorded here.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-5 hover:bg-white/5 transition space-y-3 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {evt.action}
                  </span>
                  <span className="text-slate-300 font-semibold">
                    {evt.resourceType}: <code className="text-white font-mono">{evt.resourceId}</code>
                  </span>
                  <span className="text-slate-400">
                    by <strong className="text-white">{evt.actor}</strong>
                  </span>
                </div>

                <span className="text-slate-500 font-mono text-[11px]">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>

              {/* Formatted Audit Details Payload */}
              {evt.details && Object.keys(evt.details).length > 0 && (
                <div className="p-3 rounded-xl bg-surface-300 border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(evt.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
