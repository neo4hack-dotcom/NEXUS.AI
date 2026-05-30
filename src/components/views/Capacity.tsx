/**
 * Capacity (#1) — team load & capacity overview.
 *
 * Admin / manager only. Aggregates, per contributor:
 *  - active projects (manager-of OR member-of, not archived/done)
 *  - open tasks assigned (not Done)
 *  - blocked tasks assigned
 *  - total weight of open assigned tasks (the workload proxy)
 *
 * Produces a per-person RAG load signal so overloads surface before they
 * become delivery risks. Read-only over the full (unfiltered) app state.
 */

import React, { useMemo, useState } from 'react';
import { Gauge, Search, AlertTriangle, Layers, ListChecks } from 'lucide-react';
import { AppState, User, Project, Task, TaskStatus, ProjectStatus } from '../../types';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

interface Load {
  user: User;
  activeProjects: number;
  openTasks: number;
  blockedTasks: number;
  weight: number;
}

type Tone = 'green' | 'amber' | 'red';
const toneStyle: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const barColor: Record<Tone, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500',
};

const loadTone = (l: Load): Tone => {
  if (l.blockedTasks >= 3 || l.weight >= 40) return 'red';
  if (l.blockedTasks >= 1 || l.weight >= 20 || l.activeProjects >= 5) return 'amber';
  return 'green';
};

const isActiveProject = (p: Project): boolean =>
  !p.isArchived && p.status !== ProjectStatus.DONE;

export const Capacity: React.FC<Props> = ({ state }) => {
  const [search, setSearch] = useState('');

  const loads = useMemo<Load[]>(() => {
    return state.users.map((user) => {
      const myProjects = state.projects.filter(
        (p) => isActiveProject(p) && (p.managerId === user.id || p.members.some((m) => m.userId === user.id))
      );
      let openTasks = 0, blockedTasks = 0, weight = 0;
      state.projects.forEach((p) => {
        (p.tasks || []).forEach((t: Task) => {
          if (t.assigneeId !== user.id) return;
          if (t.status === TaskStatus.DONE) return;
          openTasks++;
          weight += t.weight || 1;
          if (t.status === TaskStatus.BLOCKED) blockedTasks++;
        });
      });
      return { user, activeProjects: myProjects.length, openTasks, blockedTasks, weight };
    });
  }, [state]);

  const maxWeight = Math.max(...loads.map((l) => l.weight), 1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? loads.filter((l) =>
          `${l.user.firstName} ${l.user.lastName}`.toLowerCase().includes(q) ||
          (l.user.team || '').toLowerCase().includes(q))
      : loads;
    return [...list].sort((a, b) => b.weight - a.weight);
  }, [loads, search]);

  const totals = useMemo(() => ({
    people: loads.filter((l) => l.openTasks > 0).length,
    open: loads.reduce((n, l) => n + l.openTasks, 0),
    blocked: loads.reduce((n, l) => n + l.blockedTasks, 0),
    overloaded: loads.filter((l) => loadTone(l) === 'red').length,
  }), [loads]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <p className="label-xs">Admin · Manager</p>
        <h1 className="display-xl flex items-center gap-3"><Gauge className="w-7 h-7 text-brand" /> Team Capacity</h1>
        <p className="text-sm text-muted mt-1">Who's carrying what — spot overloads before they become risks.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'People with load', value: totals.people },
          { label: 'Open tasks', value: totals.open },
          { label: 'Blocked tasks', value: totals.blocked, accent: 'text-red-600' },
          { label: 'Overloaded', value: totals.overloaded, accent: 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="surface border p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-1">{k.label}</p>
            <p className={`text-2xl font-black tracking-tight ${k.accent || ''}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name or team…"
          className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
      </div>

      <div className="surface border divide-y divide-neutral-100 dark:divide-ink-700">
        {filtered.map((l) => {
          const tone = loadTone(l);
          const pct = Math.round((l.weight / maxWeight) * 100);
          return (
            <div key={l.user.id} className="p-4 flex items-center gap-4">
              <div className="w-9 h-9 bg-brand text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                {l.user.firstName.charAt(0)}{l.user.lastName.charAt(0)}
              </div>
              <div className="w-44 min-w-0">
                <p className="text-[12px] font-bold truncate">{l.user.firstName} {l.user.lastName}</p>
                <p className="text-[9px] uppercase tracking-[0.14em] text-muted truncate">{l.user.role} · {l.user.team || '—'}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-3 bg-neutral-100 dark:bg-ink-700 overflow-hidden">
                  <div className={`h-full ${barColor[tone]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-[11px]">
                <span className="flex items-center gap-1 text-muted" title="Active projects"><Layers className="w-3.5 h-3.5" />{l.activeProjects}</span>
                <span className="flex items-center gap-1 text-muted" title="Open tasks"><ListChecks className="w-3.5 h-3.5" />{l.openTasks}</span>
                <span className="flex items-center gap-1 text-red-500" title="Blocked tasks"><AlertTriangle className="w-3.5 h-3.5" />{l.blockedTasks}</span>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] w-20 text-center ${toneStyle[tone]}`}>
                  {tone === 'red' ? 'Overloaded' : tone === 'amber' ? 'Busy' : 'Healthy'}
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="p-10 text-center text-sm text-muted">No team members match.</p>}
      </div>
    </div>
  );
};
