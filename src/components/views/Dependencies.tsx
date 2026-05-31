/**
 * Dependencies (#2) — inter-project dependency manager.
 *
 * For each active project, declare which other projects it depends on (is
 * blocked by). The view computes:
 *   - blocked-by list (direct upstream dependencies)
 *   - blocks list (direct downstream dependents, reverse edges)
 *   - a risk flag when an upstream dependency is itself off-track/overdue
 *
 * Editing is gated to admin/manager. Pure over filtered state otherwise.
 */

import React, { useMemo, useState } from 'react';
import { Workflow, AlertTriangle, ArrowRight, Plus, X, Search } from 'lucide-react';
import { AppState, User, Project, ProjectStatus, TaskStatus } from '../../types';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const isRisky = (p: Project): boolean => {
  if (p.isArchived || p.status === ProjectStatus.DONE) return false;
  const overdue = new Date(p.deadline).getTime() < Date.now();
  const blocked = (p.tasks || []).filter((t) => t.status === TaskStatus.BLOCKED).length;
  return overdue || p.status === ProjectStatus.PAUSED || blocked > 0;
};

export const Dependencies: React.FC<Props> = ({ state, currentUser, update }) => {
  const [search, setSearch] = useState('');
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';

  const projects = useMemo(
    () => state.projects.filter((p) => !p.isArchived),
    [state.projects]
  );
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // reverse edges: who depends on X
  const dependents = useMemo(() => {
    const m = new Map<string, string[]>();
    projects.forEach((p) => {
      (p.dependsOnProjectIds || []).forEach((dep) => {
        m.set(dep, [...(m.get(dep) || []), p.id]);
      });
    });
    return m;
  }, [projects]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
  }, [projects, search]);

  const addDep = (pid: string, depId: string) => {
    if (!depId || depId === pid) return;
    update((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === pid && !(p.dependsOnProjectIds || []).includes(depId)
          ? { ...p, dependsOnProjectIds: [...(p.dependsOnProjectIds || []), depId], updatedAt: new Date().toISOString() }
          : p),
    }));
  };
  const removeDep = (pid: string, depId: string) => {
    update((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === pid
          ? { ...p, dependsOnProjectIds: (p.dependsOnProjectIds || []).filter((d) => d !== depId), updatedAt: new Date().toISOString() }
          : p),
    }));
  };

  const totalEdges = projects.reduce((n, p) => n + (p.dependsOnProjectIds?.length || 0), 0);
  const atRiskChains = projects.filter((p) =>
    (p.dependsOnProjectIds || []).some((d) => { const dp = byId.get(d); return dp && isRisky(dp); })
  ).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div>
        <p className="label-xs">Project Management</p>
        <h1 className="display-xl flex items-center gap-3"><Workflow className="w-7 h-7 text-brand" /> Dependencies</h1>
        <p className="text-sm text-muted mt-1">Map which projects block which. Upstream risk propagates downstream.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Projects', value: projects.length },
          { label: 'Dependencies', value: totalEdges },
          { label: 'At-risk chains', value: atRiskChains, accent: 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="surface border p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-1">{k.label}</p>
            <p className={`text-2xl font-black ${k.accent || ''}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter projects…"
          className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
      </div>

      <div className="space-y-3">
        {visible.map((p) => {
          const deps = (p.dependsOnProjectIds || []).map((d) => byId.get(d)).filter(Boolean) as Project[];
          const dents = (dependents.get(p.id) || []).map((d) => byId.get(d)).filter(Boolean) as Project[];
          const riskyDeps = deps.filter(isRisky);
          const candidates = projects.filter((c) => c.id !== p.id && !(p.dependsOnProjectIds || []).includes(c.id));
          return (
            <div key={p.id} className="surface border p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold truncate flex-1">{p.name}</h3>
                {riskyDeps.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle className="w-2.5 h-2.5" /> Blocked by {riskyDeps.length} at-risk
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* depends on */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Depends on (blocked by)</p>
                  <div className="space-y-1.5">
                    {deps.map((d) => (
                      <div key={d.id} className={`flex items-center gap-2 px-2 py-1.5 border text-[11px] ${isRisky(d) ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-neutral-200 dark:border-ink-600'}`}>
                        {isRisky(d) && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                        <span className="flex-1 truncate">{d.name}</span>
                        {canEdit && <button onClick={() => removeDep(p.id, d.id)} className="text-muted hover:text-red-500"><X className="w-3 h-3" /></button>}
                      </div>
                    ))}
                    {deps.length === 0 && <p className="text-[10px] text-muted italic">No dependencies.</p>}
                    {canEdit && candidates.length > 0 && (
                      <select value="" onChange={(e) => addDep(p.id, e.target.value)}
                        className="w-full h-8 px-2 text-[10px] border border-dashed border-neutral-300 dark:border-ink-600 bg-transparent focus:outline-none focus:border-brand text-muted">
                        <option value="">+ Add dependency…</option>
                        {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                {/* blocks */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Blocks (downstream)</p>
                  <div className="space-y-1.5">
                    {dents.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 border border-neutral-200 dark:border-ink-600 text-[11px]">
                        <ArrowRight className="w-3 h-3 text-muted shrink-0" />
                        <span className="flex-1 truncate">{d.name}</span>
                      </div>
                    ))}
                    {dents.length === 0 && <p className="text-[10px] text-muted italic">Nothing depends on this.</p>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="surface border border-dashed p-16 text-center">
            <Workflow className="w-10 h-10 mx-auto mb-4 opacity-20" />
            <p className="text-sm text-muted">No projects to map.</p>
          </div>
        )}
      </div>
    </div>
  );
};
