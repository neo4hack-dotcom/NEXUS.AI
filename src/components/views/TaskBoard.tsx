/**
 * TaskBoard (#10) — unified multi-project Kanban.
 *
 * Flattens tasks across every visible project into four columns
 * (To Do / In Progress / Blocked / Done). Drag a card between columns to
 * change its status; the change is persisted back into the owning project.
 *
 * Filters: by assignee ("only mine" toggle), by project, by free text.
 * Respects permissions via the filtered state passed from App.
 */

import React, { useMemo, useState } from 'react';
import { KanbanSquare, Search, User as UserIcon, GripVertical } from 'lucide-react';
import { AppState, User, Task, TaskStatus, TaskPriority } from '../../types';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

interface BoardCard {
  task: Task;
  projectId: string;
  projectName: string;
}

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: TaskStatus.TODO,    label: 'To Do',       accent: 'border-neutral-300 dark:border-ink-600' },
  { status: TaskStatus.ONGOING, label: 'In Progress', accent: 'border-blue-400' },
  { status: TaskStatus.BLOCKED, label: 'Blocked',     accent: 'border-red-400' },
  { status: TaskStatus.DONE,    label: 'Done',        accent: 'border-emerald-500' },
];

const PRIO_COLOR: Record<TaskPriority, string> = {
  [TaskPriority.LOW]:    'text-neutral-400',
  [TaskPriority.MEDIUM]: 'text-blue-500',
  [TaskPriority.HIGH]:   'text-amber-500',
  [TaskPriority.URGENT]: 'text-red-500',
};

export const TaskBoard: React.FC<Props> = ({ state, currentUser, update }) => {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const userName = (id?: string) => {
    if (!id) return null;
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : null;
  };

  const cards = useMemo<BoardCard[]>(() => {
    const out: BoardCard[] = [];
    state.projects.forEach((p) => {
      if (p.isArchived) return;
      if (projectFilter && p.id !== projectFilter) return;
      (p.tasks || []).forEach((t) => {
        if (mineOnly && t.assigneeId !== currentUser.id) return;
        if (search) {
          const q = search.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return;
        }
        out.push({ task: t, projectId: p.id, projectName: p.name });
      });
    });
    return out;
  }, [state.projects, projectFilter, mineOnly, search, currentUser.id]);

  const byCol = (status: TaskStatus) => cards.filter((c) => c.task.status === status);

  const moveTask = (taskId: string, projectId: string, status: TaskStatus) => {
    update((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id !== projectId ? p
          : { ...p, updatedAt: new Date().toISOString(),
              tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }),
    }));
  };

  const projectsWithTasks = state.projects.filter((p) => !p.isArchived && (p.tasks || []).length > 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">All projects</p>
          <h1 className="display-xl flex items-center gap-3"><KanbanSquare className="w-7 h-7 text-brand" /> Task Board</h1>
          <p className="text-sm text-muted mt-1">Every task across your portfolio, in one board. Drag to update status.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…"
            className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
        </div>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand">
          <option value="">All projects</option>
          {projectsWithTasks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setMineOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${
            mineOnly ? 'bg-brand text-white border-brand'
            : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'}`}>
          <UserIcon className="w-3.5 h-3.5" /> My tasks
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colCards = byCol(col.status);
          return (
            <div key={col.status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
              onDragLeave={() => setDragOver((d) => (d === col.status ? null : d))}
              onDrop={() => {
                if (dragId) {
                  const card = cards.find((c) => c.task.id === dragId);
                  if (card) moveTask(card.task.id, card.projectId, col.status);
                }
                setDragId(null); setDragOver(null);
              }}
              className={`surface border-t-2 ${col.accent} bg-neutral-50/50 dark:bg-ink-800/30 p-2 min-h-[200px] transition-colors ${
                dragOver === col.status ? 'ring-2 ring-brand/40' : ''}`}>
              <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{col.label}</span>
                <span className="text-[10px] font-mono text-muted">{colCards.length}</span>
              </div>
              <div className="space-y-2">
                {colCards.map((c) => (
                  <div key={c.task.id} draggable
                    onDragStart={() => setDragId(c.task.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    className={`surface border p-2.5 cursor-grab active:cursor-grabbing group ${dragId === c.task.id ? 'opacity-40' : ''}`}>
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="w-3 h-3 text-muted mt-0.5 shrink-0 opacity-0 group-hover:opacity-100" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold leading-snug">{c.task.title}</p>
                        <p className="text-[9px] text-brand font-mono uppercase tracking-[0.1em] truncate mt-1">{c.projectName}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-[8px] font-bold uppercase tracking-[0.12em] ${PRIO_COLOR[c.task.priority]}`}>{c.task.priority}</span>
                          {c.task.assigneeId && (
                            <span className="text-[8px] text-muted truncate max-w-[90px]">{userName(c.task.assigneeId)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {colCards.length === 0 && <p className="text-[10px] text-muted text-center py-6">Drop tasks here</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
