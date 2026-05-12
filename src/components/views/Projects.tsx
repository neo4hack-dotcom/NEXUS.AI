import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Calendar,
  Star,
  Archive,
  Sparkles,
  Trash2,
  FileDown,
  X,
  History,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { MarkdownView } from '../ui/MarkdownView';
import {
  AppState,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  TaskPriority,
  User,
  ProjectRole,
  AuditEntry,
} from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { exportPDF } from '../../services/exports';
import {
  buildProjectBriefData,
  DEFAULT_PROMPTS,
  fillTemplate,
  runPrompt,
} from '../../services/llmService';

interface Props {
  state: AppState;
  currentUser: User;
  update: (mutator: (s: AppState) => AppState) => void;
}

const newProject = (managerId: string): Project => {
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 86400000).toISOString();
  return {
    id: generateId(),
    name: 'New project',
    description: '',
    status: ProjectStatus.PLANNING,
    managerId,
    startDate: now.toISOString(),
    deadline,
    initialDeadline: deadline,
    isImportant: false,
    isArchived: false,
    budget: 0,
    members: [{ userId: managerId, role: ProjectRole.OWNER }],
    tasks: [],
    milestones: [],
    technologyIds: [],
    repoIds: [],
    tags: [],
    auditLog: [
      {
        id: generateId(),
        date: now.toISOString(),
        userId: managerId,
        userName: 'system',
        action: 'Project created',
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

const addAudit = (p: Project, user: User, action: string, details?: string): Project => ({
  ...p,
  updatedAt: new Date().toISOString(),
  auditLog: [
    ...(p.auditLog || []),
    {
      id: generateId(),
      date: new Date().toISOString(),
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      action,
      details,
    },
  ],
});

const projectProgress = (p: Project): number => {
  if (!p.tasks?.length) return 0;
  const totalW = p.tasks.reduce((s, t) => s + (t.weight || 1), 0);
  const doneW = p.tasks
    .filter((t) => t.status === TaskStatus.DONE)
    .reduce((s, t) => s + (t.weight || 1), 0);
  return totalW ? Math.round((doneW / totalW) * 100) : 0;
};

export const Projects: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const canEdit = currentUser.role !== 'viewer';

  const filtered = useMemo(
    () =>
      state.projects
        .filter((p) => (showArchived ? true : !p.isArchived))
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.description.toLowerCase().includes(q.toLowerCase())
        )
        .sort((a, b) => Number(b.isImportant) - Number(a.isImportant)),
    [state.projects, q, showArchived]
  );

  const selected = state.projects.find((p) => p.id === selectedId) || null;

  const upsertProject = (p: Project) =>
    update((s) => ({
      ...s,
      projects: s.projects.some((x) => x.id === p.id)
        ? s.projects.map((x) => (x.id === p.id ? p : x))
        : [p, ...s.projects],
    }));

  const handleCreate = () => {
    const p = newProject(currentUser.id);
    upsertProject(p);
    setSelectedId(p.id);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <p className="label-xs">Portfolio</p>
          <h1 className="display-xl">Projects</h1>
          <p className="text-sm text-muted mt-2">
            {filtered.length} project{filtered.length !== 1 ? 's' : ''} visible to you.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search projects…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="md" onClick={() => setShowArchived((v) => !v)}>
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
          {canEdit && (
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const pct = projectProgress(p);
          const overdue = new Date(p.deadline).getTime() < Date.now() && p.status !== 'Done';
          const owner = state.users.find((u) => u.id === p.managerId);
          const hasSlipped =
            p.initialDeadline &&
            p.deadline &&
            new Date(p.deadline).getTime() > new Date(p.initialDeadline).getTime();
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="surface border text-left hover:border-brand transition-colors flex flex-col"
            >
              <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-black uppercase tracking-tight">{p.name}</h3>
                  {p.isImportant && (
                    <Star className="w-4 h-4 text-brand fill-brand shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted line-clamp-2 min-h-[2.5rem]">
                  {p.description || 'No description.'}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  <Badge tone={overdue ? 'red' : p.status === 'Done' ? 'muted' : 'green'}>
                    {p.status}
                  </Badge>
                  {p.tags?.slice(0, 2).map((t) => (
                    <Badge key={t} tone="muted">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="p-4 surface-flat border-t border-neutral-200 dark:border-ink-600">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                    {pct}% complete
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                    {p.tasks?.length || 0} tasks
                  </p>
                </div>
                <div className="w-full h-1 bg-neutral-200 dark:bg-ink-600 overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between items-center mt-3 text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(p.deadline).toLocaleDateString()}
                    {hasSlipped && (
                      <span className="ml-1 text-amber-500 font-bold" title={`Initial deadline: ${new Date(p.initialDeadline!).toLocaleDateString()}`}>⚠ slipped</span>
                    )}
                  </span>
                  <span>{owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}</span>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="lg:col-span-3 border border-dashed border-neutral-300 dark:border-ink-500 p-12 text-center text-muted">
            <p className="text-xs uppercase tracking-[0.18em]">No projects match.</p>
          </div>
        )}
      </div>

      {selected && (
        <ProjectDetailModal
          project={selected}
          state={state}
          currentUser={currentUser}
          onClose={() => setSelectedId(null)}
          onSave={(p) => upsertProject(addAudit(p, currentUser, 'Project updated'))}
          onDelete={() => {
            if (window.confirm('Delete this project?')) {
              update((s) => ({ ...s, projects: s.projects.filter((x) => x.id !== selected.id) }));
              setSelectedId(null);
            }
          }}
          onAudit={(action, details) =>
            upsertProject(addAudit(selected, currentUser, action, details))
          }
        />
      )}
    </div>
  );
};

/* === Project Detail (with Kanban + audit log) === */

const ProjectDetailModal: React.FC<{
  project: Project;
  state: AppState;
  currentUser: User;
  onClose: () => void;
  onSave: (p: Project) => void;
  onDelete: () => void;
  onAudit: (action: string, details?: string) => void;
}> = ({ project, state, currentUser, onClose, onSave, onDelete, onAudit }) => {
  const [tab, setTab] = useState<'overview' | 'kanban' | 'audit'>('overview');
  const [draft, setDraft] = useState<Project>(project);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const canEdit = currentUser.role !== 'viewer';

  React.useEffect(() => setDraft(project), [project.id]);

  // Escape key closes the modal
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const saveAndClose = () => { onSave(draft); onClose(); };

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    setDraft((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    }));
    onAudit('Task moved', `${taskId.slice(0, 6)} → ${newStatus}`);
  };

  const addTask = () => {
    const t: Task = {
      id: generateId(),
      title: 'New task',
      description: '',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      originalEta: new Date(Date.now() + 14 * 86400000).toISOString(),
      weight: 3,
      assigneeId: currentUser.id,
    };
    setDraft((d) => ({ ...d, tasks: [...d.tasks, t] }));
  };

  const generateBrief = async () => {
    setAiLoading(true);
    setAiOutput('');
    try {
      const data = buildProjectBriefData(draft, state.users);
      const tpl = state.prompts['project_brief'] || DEFAULT_PROMPTS.project_brief;
      const prompt = fillTemplate(tpl, { DATA: data });
      const out = await runPrompt(prompt, state.llmConfig);
      setAiOutput(out);
    } catch (e: any) {
      setAiOutput(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const toPDF = () => {
    exportPDF(`Project Brief — ${draft.name}`, [
      {
        heading: 'Overview',
        body:
          `**Status:** ${draft.status}\n\n` +
          `**Owner:** ${state.users.find((u) => u.id === draft.managerId)?.firstName || '—'}\n\n` +
          `**Deadline:** ${new Date(draft.deadline).toLocaleDateString()}\n\n` +
          (draft.description || ''),
      },
      ...(aiOutput ? [{ heading: 'AI Synthesis', body: aiOutput }] : []),
      {
        heading: 'Tasks',
        body: draft.tasks
          .map((t) => `- **${t.title}** — ${t.status} · ${t.priority}`)
          .join('\n'),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-5xl max-h-[92vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                disabled={!canEdit}
                className="text-2xl font-black uppercase tracking-tight h-12 border-0 px-0 focus:ring-0 bg-transparent"
              />
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                disabled={!canEdit}
                placeholder="Project description…"
                className="mt-2 border-0 px-0 focus:ring-0 bg-transparent text-sm text-muted"
              />
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center hover:text-brand transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 border-b border-neutral-200 dark:border-ink-600 -mb-5">
            {(['overview', 'kanban', 'audit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] -mb-px border-b-2 transition-colors ${
                  tab === t
                    ? 'text-brand border-brand'
                    : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Status">
                <Select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}
                  disabled={!canEdit}
                >
                  {Object.values(ProjectStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Manager">
                <Select
                  value={draft.managerId || ''}
                  onChange={(e) => setDraft({ ...draft, managerId: e.target.value })}
                  disabled={!canEdit}
                >
                  <option value="">— select —</option>
                  {state.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Start date">
                <Input
                  type="date"
                  value={draft.startDate.slice(0, 10)}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: new Date(e.target.value).toISOString() })
                  }
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Initial deadline">
                <Input
                  type="date"
                  value={(draft.initialDeadline || draft.deadline).slice(0, 10)}
                  onChange={(e) =>
                    setDraft({ ...draft, initialDeadline: new Date(e.target.value).toISOString() })
                  }
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Current deadline">
                <Input
                  type="date"
                  value={draft.deadline.slice(0, 10)}
                  onChange={(e) =>
                    setDraft({ ...draft, deadline: new Date(e.target.value).toISOString() })
                  }
                  disabled={!canEdit}
                />
                {draft.initialDeadline && new Date(draft.deadline).getTime() > new Date(draft.initialDeadline).getTime() && (
                  <p className="text-[10px] font-mono text-amber-500 mt-1">
                    ⚠ Slipped {Math.round((new Date(draft.deadline).getTime() - new Date(draft.initialDeadline).getTime()) / 86400000)}d from initial deadline ({draft.initialDeadline.slice(0, 10)})
                  </p>
                )}
              </Field>
              <Field label="Tags (comma-separated)">
                <Input
                  value={draft.tags.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Cost (MD — Man Days)">
                <Input
                  type="number"
                  min={0}
                  value={draft.budget || 0}
                  onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value) })}
                  disabled={!canEdit}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Technologies">
                  <div className="flex flex-wrap gap-2">
                    {state.technologies.map((t) => {
                      const on = draft.technologyIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          disabled={!canEdit}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              technologyIds: on
                                ? draft.technologyIds.filter((x) => x !== t.id)
                                : [...draft.technologyIds, t.id],
                            })
                          }
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] border transition-colors ${
                            on
                              ? 'bg-brand text-white border-brand'
                              : 'border-neutral-300 dark:border-ink-500 hover:border-brand'
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Members">
                  <div className="flex flex-wrap gap-2">
                    {state.users.map((u) => {
                      const on = draft.members.some((m) => m.userId === u.id);
                      return (
                        <button
                          key={u.id}
                          disabled={!canEdit}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              members: on
                                ? draft.members.filter((m) => m.userId !== u.id)
                                : [...draft.members, { userId: u.id, role: ProjectRole.CONTRIBUTOR }],
                            })
                          }
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] border transition-colors ${
                            on
                              ? 'bg-brand text-white border-brand'
                              : 'border-neutral-300 dark:border-ink-500 hover:border-brand'
                          }`}
                        >
                          {u.firstName} {u.lastName}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <div className="md:col-span-2 mt-2 surface-flat border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold uppercase tracking-tight">
                    AI Project Brief
                  </h4>
                  <Button variant="outline" size="sm" onClick={generateBrief} disabled={aiLoading}>
                    <Sparkles className="w-3 h-3 mr-2" />
                    {aiLoading ? 'Generating…' : 'Generate'}
                  </Button>
                </div>
                {aiOutput ? (
                  <MarkdownView content={aiOutput} />
                ) : (
                  <p className="text-xs text-muted">
                    Generate an executive brief from current project data.
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'kanban' && (
            <KanbanBoard
              draft={draft}
              state={state}
              canEdit={canEdit}
              onMoveTask={moveTask}
              onAddTask={addTask}
              onChangeTask={(id, patch) =>
                setDraft((d) => ({
                  ...d,
                  tasks: d.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
                }))
              }
              onDeleteTask={(id) =>
                setDraft((d) => ({
                  ...d,
                  tasks: d.tasks.filter((x) => x.id !== id),
                }))
              }
            />
          )}

          {tab === 'audit' && (
            <div className="space-y-2">
              {[...(draft.auditLog || [])].reverse().map((e) => (
                <div
                  key={e.id}
                  className="surface-flat border p-3 flex items-start gap-3 text-sm"
                >
                  <History className="w-4 h-4 text-brand mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">{e.action}</p>
                    {e.details && (
                      <p className="text-xs text-muted mt-0.5">{e.details}</p>
                    )}
                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted mt-1">
                      {e.userName} • {new Date(e.date).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!draft.auditLog || draft.auditLog.length === 0) && (
                <p className="text-xs text-muted text-center py-12">No audit entries.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex items-center justify-between gap-2">
          <Button variant="outline" size="md" onClick={toPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="danger" size="md" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" size="md" onClick={onClose}>
              Discard & close
            </Button>
            {canEdit && (
              <Button onClick={saveAndClose}>
                <Save className="w-4 h-4 mr-2" />
                Save & close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="label-xs">{label}</label>
    {children}
  </div>
);

/* ===== KanbanBoard with drag-and-drop ===== */

const KanbanBoard: React.FC<{
  draft: Project;
  state: AppState;
  canEdit: boolean;
  onMoveTask: (id: string, s: TaskStatus) => void;
  onAddTask: () => void;
  onChangeTask: (id: string, patch: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}> = ({ draft, state, canEdit, onMoveTask, onAddTask, onChangeTask, onDeleteTask }) => {
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) onMoveTask(id, status);
    setDragOver(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-muted">Drag tasks between columns or use the arrow button.</p>
        {canEdit && (
          <Button size="sm" onClick={onAddTask}>
            <Plus className="w-3 h-3 mr-2" />
            Add task
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {Object.values(TaskStatus).map((status) => {
          const tasks = draft.tasks.filter((t) => t.status === status);
          const colAccent =
            status === TaskStatus.BLOCKED
              ? 'border-red-500/50 bg-red-500/5'
              : status === TaskStatus.PAUSED
              ? 'border-orange-500/50 bg-orange-500/5'
              : '';
          const labelColor =
            status === TaskStatus.BLOCKED
              ? 'text-red-500'
              : status === TaskStatus.PAUSED
              ? 'text-orange-500'
              : '';
          return (
            <div
              key={status}
              className={`surface-flat border p-3 min-h-[300px] transition-colors ${colAccent} ${
                dragOver === status ? 'border-brand bg-brand/5' : ''
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between mb-3">
                <p className={`label-xs ${labelColor}`}>{status}</p>
                <span className="text-[10px] font-mono text-muted">{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.map((t) => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    users={state.users}
                    canEdit={canEdit}
                    onMove={(s) => onMoveTask(t.id, s)}
                    onChange={(patch) => onChangeTask(t.id, patch)}
                    onDelete={() => onDeleteTask(t.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KanbanCard: React.FC<{
  task: Task;
  users: User[];
  canEdit: boolean;
  onMove: (s: TaskStatus) => void;
  onChange: (patch: Partial<Task>) => void;
  onDelete: () => void;
}> = ({ task, users, canEdit, onMove, onChange, onDelete }) => {
  const [open, setOpen] = useState(false);
  const assignee = users.find((u) => u.id === task.assigneeId);
  const statuses = Object.values(TaskStatus);
  const nextStatus = statuses[(statuses.indexOf(task.status) + 1) % statuses.length];

  return (
    <div
      className="surface border p-3 text-xs cursor-grab active:cursor-grabbing"
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left font-bold leading-tight hover:text-brand"
        >
          {task.title}
        </button>
        <Badge
          tone={
            task.priority === 'Urgent'
              ? 'red'
              : task.priority === 'High'
              ? 'amber'
              : 'muted'
          }
        >
          {task.priority}
        </Badge>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
        <span>{assignee ? assignee.firstName : '—'}</span>
        <span>{new Date(task.originalEta).toLocaleDateString()}</span>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => onMove(nextStatus)}
            className="flex-1 h-7 text-[9px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-500 hover:border-brand hover:text-brand"
            title={`Move to ${nextStatus}`}
          >
            → {nextStatus}
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
      {open && (
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-ink-600 space-y-2">
          <Input
            value={task.title}
            onChange={(e) => onChange({ title: e.target.value })}
            disabled={!canEdit}
          />
          <Textarea
            value={task.description}
            onChange={(e) => onChange({ description: e.target.value })}
            disabled={!canEdit}
            placeholder="Description"
            className="min-h-[60px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={task.assigneeId || ''}
              onChange={(e) => onChange({ assigneeId: e.target.value })}
              disabled={!canEdit}
            >
              <option value="">— assignee —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName}
                </option>
              ))}
            </Select>
            <Select
              value={task.priority}
              onChange={(e) => onChange({ priority: e.target.value as TaskPriority })}
              disabled={!canEdit}
            >
              {Object.values(TaskPriority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <Input
            type="date"
            value={task.originalEta.slice(0, 10)}
            onChange={(e) =>
              onChange({ originalEta: new Date(e.target.value).toISOString() })
            }
            disabled={!canEdit}
          />
          <div className="space-y-1">
            <p className="label-xs">Checklist</p>
            {(task.checklist || []).map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!canEdit}
                  onChange={() =>
                    onChange({
                      checklist: (task.checklist || []).map((x) =>
                        x.id === c.id ? { ...x, done: !x.done } : x
                      ),
                    })
                  }
                />
                <span className={c.done ? 'line-through text-muted' : ''}>{c.text}</span>
                <CheckCircle2
                  className={`w-3 h-3 ml-auto ${c.done ? 'text-emerald-500' : 'text-muted'}`}
                />
              </label>
            ))}
            {canEdit && (
              <button
                onClick={() =>
                  onChange({
                    checklist: [
                      ...(task.checklist || []),
                      { id: generateId(), text: 'New item', done: false },
                    ],
                  })
                }
                className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand hover:underline"
              >
                + Add item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
