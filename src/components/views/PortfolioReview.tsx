/**
 * PortfolioReview / QBR (#6) — guided portfolio review mode.
 *
 * Walks the reviewer through every active project one card at a time, showing
 * the current RAG health, last audit activity and completion %, with quick
 * actions: confirm (logs a review note), flag at-risk, archive, or jump to the
 * project. A progress bar tracks how far through the review you are. At the end,
 * a summary recaps decisions taken in this session.
 *
 * Manager / admin oriented but available to anyone who can see projects
 * (actions that mutate respect the same update() path).
 */

import React, { useMemo, useState } from 'react';
import {
  ClipboardCheck, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
  Archive, RotateCcw, Calendar,
} from 'lucide-react';
import { AppState, User, Project, Task, TaskStatus, ProjectStatus } from '../../types';
import { generateId } from '../../services/storage';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type Tone = 'green' | 'amber' | 'red' | 'muted';
const RAG: Record<Tone, { label: string; style: string }> = {
  green: { label: 'On Track',  style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  amber: { label: 'At Risk',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  red:   { label: 'Off Track', style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  muted: { label: 'Done',      style: 'bg-neutral-100 text-neutral-500 dark:bg-ink-700 dark:text-neutral-400' },
};

const ragHealth = (p: Project): Tone => {
  if (p.isArchived || p.status === ProjectStatus.DONE) return 'muted';
  const tasks = p.tasks || [];
  const blocked = tasks.filter((t: Task) => t.status === TaskStatus.BLOCKED).length;
  const total = tasks.length;
  const overdue = new Date(p.deadline).getTime() < Date.now();
  const daysLeft = (new Date(p.deadline).getTime() - Date.now()) / 86400000;
  if (overdue || (total > 0 && blocked / total > 0.4)) return 'red';
  if (blocked > 0 || daysLeft < 14) return 'amber';
  return 'green';
};

const progressOf = (p: Project): number => {
  const tasks = p.tasks || [];
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === TaskStatus.DONE).length / tasks.length) * 100);
};

export const PortfolioReview: React.FC<Props> = ({ state, currentUser, update }) => {
  const projects = useMemo(
    () => state.projects.filter((p) => !p.isArchived && p.status !== ProjectStatus.DONE)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [state.projects]
  );

  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  const current = projects[idx];

  const logAudit = (p: Project, action: string, details?: string): Project => ({
    ...p,
    updatedAt: new Date().toISOString(),
    auditLog: [...(p.auditLog || []), {
      id: generateId(), date: new Date().toISOString(),
      userId: currentUser.id, userName: `${currentUser.firstName} ${currentUser.lastName}`,
      action, details,
    }],
  });

  const record = (decision: string) => {
    if (current) setDecisions((d) => ({ ...d, [current.id]: decision }));
  };

  const next = () => {
    if (idx < projects.length - 1) { setIdx(idx + 1); setNote(''); }
    else setDone(true);
  };
  const prev = () => { if (idx > 0) { setIdx(idx - 1); setNote(''); } };

  const confirm = () => {
    if (!current) return;
    const details = note.trim() ? `Reviewed: ${note.trim()}` : 'Reviewed — on track';
    update((s) => ({ ...s, projects: s.projects.map((p) => p.id === current.id ? logAudit(p, 'QBR review', details) : p) }));
    record('confirmed'); next();
  };
  const flagRisk = () => {
    if (!current) return;
    update((s) => ({ ...s, projects: s.projects.map((p) => p.id === current.id
      ? logAudit({ ...p, status: ProjectStatus.PAUSED }, 'QBR flagged at-risk', note.trim() || undefined) : p) }));
    record('at-risk'); next();
  };
  const archive = () => {
    if (!current) return;
    update((s) => ({ ...s, projects: s.projects.map((p) => p.id === current.id
      ? logAudit({ ...p, isArchived: true }, 'QBR archived', note.trim() || undefined) : p) }));
    record('archived'); next();
  };

  if (projects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="display-xl flex items-center gap-3 mb-4"><ClipboardCheck className="w-7 h-7 text-brand" /> Portfolio Review</h1>
        <div className="surface border border-dashed p-16 text-center">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted">No active projects to review. Everything's archived or done.</p>
        </div>
      </div>
    );
  }

  if (done) {
    const counts = { confirmed: 0, 'at-risk': 0, archived: 0, skipped: 0 } as Record<string, number>;
    projects.forEach((p) => { counts[decisions[p.id] || 'skipped']++; });
    return (
      <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
        <h1 className="display-xl flex items-center gap-3"><ClipboardCheck className="w-7 h-7 text-brand" /> Review complete</h1>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Confirmed', value: counts.confirmed, accent: 'text-emerald-600' },
            { label: 'At risk', value: counts['at-risk'], accent: 'text-amber-600' },
            { label: 'Archived', value: counts.archived, accent: 'text-neutral-500' },
            { label: 'Skipped', value: counts.skipped, accent: 'text-muted' },
          ].map((k) => (
            <div key={k.label} className="surface border p-4 text-center">
              <p className={`text-2xl font-black ${k.accent}`}>{k.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mt-1">{k.label}</p>
            </div>
          ))}
        </div>
        <div className="surface border divide-y divide-neutral-100 dark:divide-ink-700">
          {projects.map((p) => (
            <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold truncate">{p.name}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{decisions[p.id] || 'skipped'}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setDone(false); setIdx(0); setDecisions({}); }}
          className="flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand">
          <RotateCcw className="w-3.5 h-3.5" /> Start a new review
        </button>
      </div>
    );
  }

  const tone = ragHealth(current);
  const pct = progressOf(current);
  const manager = state.users.find((u) => u.id === current.managerId);
  const lastAudit = current.auditLog?.[current.auditLog.length - 1];

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-xs">Guided QBR</p>
          <h1 className="display-xl flex items-center gap-3"><ClipboardCheck className="w-7 h-7 text-brand" /> Portfolio Review</h1>
        </div>
        <span className="text-[11px] font-mono text-muted">{idx + 1} / {projects.length}</span>
      </div>

      {/* progress rail */}
      <div className="h-1.5 bg-neutral-200 dark:bg-ink-700 overflow-hidden">
        <div className="h-full bg-brand transition-all" style={{ width: `${((idx) / projects.length) * 100}%` }} />
      </div>

      <div className="surface border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-tight truncate">{current.name}</h2>
            <p className="text-[11px] text-muted mt-1 line-clamp-2">{current.description || 'No description.'}</p>
          </div>
          <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] shrink-0 ${RAG[tone].style}`}>{RAG[tone].label}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-0.5">Progress</p>
            <p className="font-bold">{pct}%</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-0.5 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />Deadline</p>
            <p className="font-bold">{new Date(current.deadline).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-0.5">Manager</p>
            <p className="font-bold truncate">{manager ? `${manager.firstName} ${manager.lastName}` : '—'}</p>
          </div>
        </div>

        {lastAudit && (
          <p className="text-[10px] text-muted italic border-t border-neutral-100 dark:border-ink-700 pt-3">
            Last activity: {lastAudit.action} by {lastAudit.userName} · {new Date(lastAudit.date).toLocaleDateString()}
          </p>
        )}

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Optional review note (logged to the project audit trail)…"
          className="w-full px-3 py-2 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand resize-none" />

        <div className="flex flex-wrap gap-2">
          <button onClick={confirm} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-emerald-500 text-white hover:bg-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
          </button>
          <button onClick={flagRisk} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-amber-400/50 text-amber-600 hover:bg-amber-500 hover:text-white">
            <AlertTriangle className="w-3.5 h-3.5" /> Flag at-risk
          </button>
          <button onClick={archive} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-red-400 hover:text-red-500">
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>
          <button onClick={next} className="ml-auto flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-brand">
            Skip <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={prev} disabled={idx === 0}
          className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-brand disabled:opacity-30">
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
      </div>
    </div>
  );
};
