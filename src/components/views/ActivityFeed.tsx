/**
 * ActivityFeed (#9) — consolidated cross-entity activity stream.
 *
 * Aggregates events from every entity that carries a timeline:
 *  - project audit logs (rich: action + author + details)
 *  - entity creations/updates (projects, agents, mcp servers, working groups,
 *    wishes, hackathons, data feeds) derived from createdAt / updatedAt
 *
 * Read-only. Respects the filtered state passed in (so a contributor only sees
 * activity for entities they can access).
 */

import React, { useMemo, useState } from 'react';
import {
  Activity, Target, Bot, Plug, Network, Lightbulb, Zap, DatabaseZap,
  Search, Filter, Clock,
} from 'lucide-react';
import { AppState, User } from '../../types';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type EventKind =
  | 'project' | 'agent' | 'mcp' | 'workinggroup' | 'wish' | 'hackathon' | 'datafeed';

interface FeedEvent {
  id: string;
  kind: EventKind;
  title: string;        // entity name
  action: string;       // what happened
  details?: string;
  actorName?: string;
  ts: number;           // epoch ms
}

const KIND_META: Record<EventKind, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  project:      { label: 'Project',       icon: Target,      color: 'text-brand' },
  agent:        { label: 'AI Agent',      icon: Bot,         color: 'text-fuchsia-500' },
  mcp:          { label: 'MCP Server',    icon: Plug,        color: 'text-cyan-500' },
  workinggroup: { label: 'Working Group', icon: Network,     color: 'text-emerald-500' },
  wish:         { label: 'Wish',          icon: Lightbulb,   color: 'text-amber-500' },
  hackathon:    { label: 'Hackathon',     icon: Zap,         color: 'text-violet-500' },
  datafeed:     { label: 'Data Feed',     icon: DatabaseZap, color: 'text-teal-500' },
};

const rel = (ts: number): string => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

const tsOf = (iso?: string): number => (iso ? new Date(iso).getTime() : 0);

export const ActivityFeed: React.FC<Props> = ({ state }) => {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<EventKind | 'all'>('all');

  const events = useMemo<FeedEvent[]>(() => {
    const out: FeedEvent[] = [];

    // Project audit logs — the richest source.
    state.projects.forEach((p) => {
      (p.auditLog || []).forEach((a) => {
        out.push({
          id: `pa_${a.id}`,
          kind: 'project',
          title: p.name,
          action: a.action,
          details: a.details,
          actorName: a.userName,
          ts: tsOf(a.date),
        });
      });
      // Creation event as a fallback anchor.
      if (p.createdAt) {
        out.push({
          id: `pc_${p.id}`, kind: 'project', title: p.name,
          action: 'Project created', ts: tsOf(p.createdAt),
        });
      }
    });

    // Derived creation/update events for other entities.
    const derive = (
      kind: EventKind,
      items: { id: string; name?: string; title?: string; createdAt?: string; updatedAt?: string }[],
    ) => {
      items.forEach((it) => {
        const name = it.name || it.title || 'Untitled';
        if (it.createdAt) out.push({ id: `${kind}c_${it.id}`, kind, title: name, action: 'Created', ts: tsOf(it.createdAt) });
        if (it.updatedAt && it.updatedAt !== it.createdAt) {
          out.push({ id: `${kind}u_${it.id}`, kind, title: name, action: 'Updated', ts: tsOf(it.updatedAt) });
        }
      });
    };
    derive('agent', state.agents ?? []);
    derive('mcp', state.mcpServers ?? []);
    derive('workinggroup', state.workingGroups ?? []);
    derive('wish', state.wishes ?? []);
    derive('hackathon', state.hackathons ?? []);
    derive('datafeed', state.dataFeeds ?? []);

    return out.filter((e) => e.ts > 0).sort((a, b) => b.ts - a.ts);
  }, [state]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.details ?? '').toLowerCase().includes(q) ||
        (e.actorName ?? '').toLowerCase().includes(q)
      );
    }).slice(0, 400);
  }, [events, search, kindFilter]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div>
        <p className="label-xs">Cross-entity stream</p>
        <h1 className="display-xl flex items-center gap-3"><Activity className="w-7 h-7 text-brand" /> Activity Feed</h1>
        <p className="text-sm text-muted mt-1">Everything that changed across your portfolio, newest first.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity…"
            className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted" />
          {(['all', ...Object.keys(KIND_META)] as (EventKind | 'all')[]).map((k) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                kindFilter === k ? 'bg-brand text-white border-brand'
                : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'}`}>
              {k === 'all' ? 'All' : KIND_META[k].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface border border-dashed p-16 text-center">
          <Activity className="w-10 h-10 mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted">No activity matches your filters yet.</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* timeline rail */}
          <div className="absolute left-2 top-1 bottom-1 w-px bg-neutral-200 dark:bg-ink-700" />
          <div className="space-y-2">
            {filtered.map((e) => {
              const meta = KIND_META[e.kind];
              const Icon = meta.icon;
              return (
                <div key={e.id} className="relative surface border p-3 flex items-start gap-3">
                  <div className="absolute -left-[18px] top-4 w-2.5 h-2.5 rounded-full bg-brand ring-2 ring-white dark:ring-ink-900" />
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{meta.label}</span>
                      <span className="text-[12px] font-bold truncate">{e.title}</span>
                    </div>
                    <p className="text-[11px] mt-0.5">
                      <span className="font-semibold">{e.action}</span>
                      {e.actorName && <span className="text-muted"> · by {e.actorName}</span>}
                    </p>
                    {e.details && <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{e.details}</p>}
                  </div>
                  <span className="text-[9px] font-mono text-muted shrink-0 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{rel(e.ts)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
