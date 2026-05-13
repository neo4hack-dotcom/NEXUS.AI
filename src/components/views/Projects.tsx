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
  Printer,
  Maximize2,
  Minimize2,
  RotateCcw,
  Bot,
  Clipboard,
  ChevronRight,
  Edit2,
  Loader2,
  LayoutGrid,
  Layers,
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
  ProjectPresentation,
  ProjectLinkedApp,
  ProjectFamily,
  DevStatus,
  InnovationStatus,
  ExternalMember,
} from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { buildProjectHTML, buildBookletHTML } from '../../services/exports';
import {
  buildProjectBriefData,
  DEFAULT_PROMPTS,
  fillTemplate,
  runPrompt,
  extractProjectFromText,
  ExtractedProject,
  ExtractedTask,
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
    confidentiality: 'internal',
    familyId: undefined,
    fteGain: undefined,
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
    presentations: [],
    linkedApps: [],
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

/* ── Confidentiality badge styles ── */
const CONF_STYLE: Record<string, string> = {
  public: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  internal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confidential: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  restricted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const DEV_STATUS_LABEL: Record<DevStatus, string> = {
  to_start: 'To Start',
  dev: 'Dev',
  uat: 'UAT',
  prod: 'Prod',
};
const DEV_STATUS_STYLE: Record<DevStatus, string> = {
  to_start: 'bg-neutral-100 text-neutral-600 dark:bg-ink-700 dark:text-neutral-300',
  dev:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  uat:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  prod:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const INNOVATION_LABEL: Record<InnovationStatus, string> = {
  poc:   'POC',
  pilot: 'Pilot',
  prod:  'Prod',
};
const INNOVATION_STYLE: Record<InnovationStatus, string> = {
  poc:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  pilot: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  prod:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

/* ── RAG health helper ── */
type RAGTone = 'green' | 'amber' | 'red' | 'muted';
const RAG_STYLE: Record<RAGTone, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  muted: 'bg-neutral-100 text-neutral-500 dark:bg-ink-700 dark:text-neutral-400',
};
const ragHealth = (p: Project): { label: string; tone: RAGTone } => {
  if (p.isArchived || p.status === ProjectStatus.DONE) return { label: 'Done', tone: 'muted' };
  const tasks = p.tasks || [];
  const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
  const total = tasks.length;
  const overdue = new Date(p.deadline).getTime() < Date.now();
  const daysLeft = (new Date(p.deadline).getTime() - Date.now()) / 86400000;
  if (overdue || (total > 0 && blocked / total > 0.4)) return { label: 'Off Track', tone: 'red' };
  if (blocked > 0 || daysLeft < 14 || (p.initialDeadline && new Date(p.deadline) > new Date(p.initialDeadline)))
    return { label: 'At Risk', tone: 'amber' };
  return { label: 'On Track', tone: 'green' };
};

const projectProgress = (p: Project): number => {
  if (!p.tasks?.length) return 0;
  const totalW = p.tasks.reduce((s, t) => s + (t.weight || 1), 0);
  const doneW = p.tasks
    .filter((t) => t.status === TaskStatus.DONE)
    .reduce((s, t) => s + (t.weight || 1), 0);
  return totalW ? Math.round((doneW / totalW) * 100) : 0;
};

/* ══════════════════════════════════════════════════
   AI PROJECT BOT — slide-in panel, 3-step flow
══════════════════════════════════════════════════ */

type AIBotStep = 'paste' | 'review' | 'saving';

const AIProjectBot: React.FC<{
  llmConfig: AppState['llmConfig'];
  currentUser: User;
  onClose: () => void;
  onCreate: (p: Project) => void;
}> = ({ llmConfig, currentUser, onClose, onCreate }) => {
  const [step, setStep] = useState<AIBotStep>('paste');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState<ExtractedProject | null>(null);
  // Editable review state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);

  const handleExtract = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await extractProjectFromText(rawText, llmConfig);
      setExtracted(result);
      setName(result.name);
      setDescription(result.description);
      setContext(result.context);
      setDeadline(result.deadline);
      setTasks(result.tasks);
      setStep('review');
    } catch (e: any) {
      setError(e.message || 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const updateTask = (i: number, patch: Partial<ExtractedTask>) =>
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const removeTask = (i: number) => setTasks((prev) => prev.filter((_, idx) => idx !== i));

  const addTask = () =>
    setTasks((prev) => [
      ...prev,
      {
        title: '',
        description: '',
        priority: TaskPriority.MEDIUM,
        originalEta: deadline || new Date().toISOString().slice(0, 10),
      },
    ]);

  const handleCreate = () => {
    const now = new Date().toISOString();
    const dl = deadline || new Date(Date.now() + 90 * 86400000).toISOString();
    const project: Project = {
      id: generateId(),
      name: name.trim() || 'New Project',
      description: description.trim(),
      context: context.trim(),
      status: ProjectStatus.PLANNING,
      managerId: currentUser.id,
      startDate: now,
      deadline: dl,
      initialDeadline: dl,
      isImportant: false,
      isArchived: false,
      budget: 0,
      members: [{ userId: currentUser.id, role: ProjectRole.OWNER }],
      tasks: tasks
        .filter((t) => t.title.trim())
        .map((t) => ({
          id: generateId(),
          title: t.title.trim(),
          description: t.description,
          status: TaskStatus.TODO,
          priority: t.priority,
          originalEta: t.originalEta,
          weight: 5,
          checklist: [],
          dependencies: [],
        })),
      milestones: [],
      technologyIds: [],
      repoIds: [],
      tags: [],
      auditLog: [],
      createdAt: now,
      updatedAt: now,
    };
    onCreate(project);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg bg-white dark:bg-ink-900 flex flex-col h-full shadow-2xl border-l border-neutral-200 dark:border-ink-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-ink-700 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]">AI Project Builder</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-neutral-900 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-neutral-100 dark:border-ink-800 shrink-0">
          {(['paste', 'review'] as const).map((s, i) => (
            <React.Fragment key={s}>
              <span className={`text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 ${step === s ? 'bg-brand text-white' : 'text-muted'}`}>
                {i + 1}. {s === 'paste' ? 'Paste Text' : 'Review & Edit'}
              </span>
              {i === 0 && <ChevronRight className="w-3 h-3 text-muted" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'paste' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold mb-1">Paste your project description</p>
                <p className="text-[10px] text-muted mb-3">
                  Paste emails, meeting notes, briefs, Confluence pages — anything describing the project. The AI will extract structure for you.
                </p>
                <textarea
                  className="w-full input-base resize-none text-[11px]"
                  rows={16}
                  placeholder="Paste project description, emails, requirements, meeting notes…"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  autoFocus
                />
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-[10px] text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              <button
                onClick={handleExtract}
                disabled={!rawText.trim() || loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Extract with AI</>
                )}
              </button>
            </div>
          )}

          {step === 'review' && extracted && (
            <div className="space-y-5">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Project Name *</label>
                <input className="w-full input-base" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Description</label>
                <textarea className="w-full input-base resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Context / Background</label>
                <textarea className="w-full input-base resize-none" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Deadline</label>
                <input type="date" className="w-full input-base" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Tasks ({tasks.length})</label>
                  <button onClick={addTask} className="text-[9px] text-brand font-bold uppercase tracking-[0.14em] flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-3">
                  {tasks.map((t, i) => (
                    <div key={i} className="border border-neutral-200 dark:border-ink-700 p-3 space-y-2 bg-neutral-50 dark:bg-ink-800">
                      <div className="flex items-start gap-2">
                        <input
                          className="flex-1 input-base text-[11px] font-medium"
                          placeholder="Task title"
                          value={t.title}
                          onChange={(e) => updateTask(i, { title: e.target.value })}
                        />
                        <button onClick={() => removeTask(i)} className="text-muted hover:text-red-500 shrink-0 mt-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        className="w-full input-base resize-none text-[10px]"
                        rows={2}
                        placeholder="Description…"
                        value={t.description}
                        onChange={(e) => updateTask(i, { description: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="input-base text-[10px]"
                          value={t.priority}
                          onChange={(e) => updateTask(i, { priority: e.target.value as TaskPriority })}
                        >
                          {Object.values(TaskPriority).map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input
                          type="date"
                          className="input-base text-[10px]"
                          value={t.originalEta}
                          onChange={(e) => updateTask(i, { originalEta: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-[10px] text-muted text-center py-3">No tasks extracted — add them manually above.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep('paste')} className="btn-secondary flex-1 text-[10px]">Back</button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className="btn-primary flex-1 text-[10px] flex items-center justify-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" /> Create Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Projects: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAiBot, setShowAiBot] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showBooklet, setShowBooklet] = useState(false);
  const [view, setView] = useState<'list' | 'portfolio'>('list');
  const [showFamilyManager, setShowFamilyManager] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const canEdit = currentUser.role !== 'viewer';
  const canUseAI = currentUser.role === 'admin' || currentUser.role === 'manager';
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const filtered = useMemo(
    () =>
      state.projects
        .filter((p) => (showArchived ? true : !p.isArchived))
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.description.toLowerCase().includes(q.toLowerCase())
        )
        .filter((p) => {
          if (familyFilter === null) return true;
          if (familyFilter === '__none__') return !p.familyId;
          return p.familyId === familyFilter;
        })
        .sort((a, b) => Number(b.isImportant) - Number(a.isImportant)),
    [state.projects, q, showArchived, familyFilter]
  );

  const selected = state.projects.find((p) => p.id === selectedId) || null;

  const upsertProject = (p: Project) =>
    update((s) => ({
      ...s,
      projects: s.projects.some((x) => x.id === p.id)
        ? s.projects.map((x) => (x.id === p.id ? p : x))
        : [p, ...s.projects],
    }));

  const handleCreate = (templateId?: string) => {
    const template = templateId ? (state.projectTemplates || []).find((t) => t.id === templateId) : null;
    const p = newProject(currentUser.id);
    if (template) {
      p.name = template.name + ' (copy)';
      p.description = template.description;
      p.tags = [...template.tags];
      p.tasks = template.tasks.map((t) => ({
        ...t,
        id: generateId(),
        assigneeId: undefined,
        checklist: [],
        dependencies: [],
      }));
      p.milestones = template.milestones.map((m) => ({ ...m, id: generateId(), done: false }));
    }
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
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* View toggle */}
          <div className="flex border border-neutral-300 dark:border-ink-500 overflow-hidden">
            <button
              onClick={() => { setView('list'); setFamilyFilter(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${view === 'list' ? 'bg-brand text-white' : 'text-muted hover:text-neutral-900 dark:hover:text-white'}`}
            >
              <LayoutGrid className="w-3 h-3" /> List
            </button>
            <button
              onClick={() => setView('portfolio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] border-l border-neutral-300 dark:border-ink-500 transition-colors ${view === 'portfolio' ? 'bg-brand text-white border-brand' : 'text-muted hover:text-neutral-900 dark:hover:text-white'}`}
            >
              <Layers className="w-3 h-3" /> Portfolio
            </button>
          </div>
          <div className="relative flex-1 md:w-64">
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
          {isAdmin && (
            <Button variant="outline" size="md" onClick={() => setShowFamilyManager(true)}>
              <Layers className="w-3 h-3 mr-2" />
              Families
            </Button>
          )}
          {canUseAI && (
            <Button variant="outline" size="md" onClick={() => setShowAiBot(true)}>
              <Bot className="w-4 h-4 mr-2" />
              AI PRJ
            </Button>
          )}
          <Button variant="outline" size="md" onClick={() => setShowBooklet(true)}>
            <Printer className="w-4 h-4 mr-2" />
            Booklet
          </Button>
          {canEdit && (
            <>
              {(state.projectTemplates || []).length > 0 && (
                <Button variant="outline" size="md" onClick={() => setShowTemplatePicker(true)}>
                  <Clipboard className="w-4 h-4 mr-2" />
                  From template
                </Button>
              )}
              <Button onClick={() => handleCreate()}>
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Portfolio / Family view */}
      {view === 'portfolio' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ungrouped card */}
            {(() => {
              const ungrouped = state.projects.filter((p) => !p.isArchived && !p.familyId);
              return (
                <button
                  onClick={() => { setFamilyFilter('__none__'); setView('list'); }}
                  className="surface border text-left p-5 hover:border-brand transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-neutral-400" />
                    <span className="text-[11px] font-black uppercase tracking-tight">Ungrouped</span>
                  </div>
                  <p className="text-xs text-muted mb-3">Projects without a family</p>
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] bg-neutral-100 dark:bg-ink-700 text-muted">
                    {ungrouped.length} project{ungrouped.length !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })()}
            {(state.projectFamilies || []).map((family) => {
              const count = state.projects.filter((p) => !p.isArchived && p.familyId === family.id).length;
              return (
                <button
                  key={family.id}
                  onClick={() => { setFamilyFilter(family.id); setView('list'); }}
                  className="surface border text-left p-5 hover:border-brand transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3" style={{ backgroundColor: family.color || '#FF3E00' }} />
                    <span className="text-[11px] font-black uppercase tracking-tight">{family.name}</span>
                  </div>
                  {family.description && (
                    <p className="text-xs text-muted mb-3 line-clamp-2">{family.description}</p>
                  )}
                  <span
                    className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white"
                    style={{ backgroundColor: family.color || '#FF3E00' }}
                  >
                    {count} project{count !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active family filter banner */}
      {familyFilter && view === 'list' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand/10 border border-brand/30">
          <Layers className="w-3.5 h-3.5 text-brand" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
            Filtered by: {familyFilter === '__none__' ? 'Ungrouped' : (state.projectFamilies || []).find((f) => f.id === familyFilter)?.name}
          </span>
          <button onClick={() => setFamilyFilter(null)} className="ml-auto text-brand hover:text-brand/70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {view === 'list' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const pct = projectProgress(p);
          const overdue = new Date(p.deadline).getTime() < Date.now() && p.status !== 'Done';
          const owner = state.users.find((u) => u.id === p.managerId);
          const hasSlipped =
            p.initialDeadline &&
            p.deadline &&
            new Date(p.deadline).getTime() > new Date(p.initialDeadline).getTime();
          const rag = ragHealth(p);
          const family = p.familyId ? (state.projectFamilies || []).find((f) => f.id === p.familyId) : null;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="surface border text-left hover:border-brand transition-colors flex flex-col"
            >
              <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    {family && (
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className="w-2 h-2 shrink-0"
                          style={{ backgroundColor: family.color || '#FF3E00' }}
                        />
                        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-muted truncate">{family.name}</span>
                      </div>
                    )}
                    <h3 className="text-lg font-black uppercase tracking-tight">{p.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${RAG_STYLE[rag.tone]}`}>{rag.label}</span>
                    {p.isImportant && <Star className="w-4 h-4 text-brand fill-brand" />}
                  </div>
                </div>
                <p className="text-xs text-muted line-clamp-2 min-h-[2.5rem]">
                  {p.description || 'No description.'}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  <Badge tone={overdue ? 'red' : p.status === 'Done' ? 'muted' : 'green'}>
                    {p.status}
                  </Badge>
                  {p.devStatus && (
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${DEV_STATUS_STYLE[p.devStatus]}`}>
                      {DEV_STATUS_LABEL[p.devStatus]}
                    </span>
                  )}
                  {p.innovationStatus && (
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${INNOVATION_STYLE[p.innovationStatus]}`}>
                      {INNOVATION_LABEL[p.innovationStatus]}
                    </span>
                  )}
                  {p.confidentiality && p.confidentiality !== 'internal' && (
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${CONF_STYLE[p.confidentiality] || ''}`}>
                      {p.confidentiality}
                    </span>
                  )}
                  {(p.fteGain ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                      {p.fteGain} FTE saved
                    </span>
                  )}
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
      </div>}

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

      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowTemplatePicker(false)}>
          <div className="bg-white dark:bg-ink-900 w-full max-w-lg border border-neutral-200 dark:border-ink-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-ink-700">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">Start from template</h2>
              <button onClick={() => setShowTemplatePicker(false)} className="text-muted hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {(state.projectTemplates || []).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => { handleCreate(tpl.id); setShowTemplatePicker(false); }}
                  className="w-full text-left border border-neutral-200 dark:border-ink-700 p-4 hover:border-brand transition-colors"
                >
                  <p className="text-[12px] font-bold">{tpl.name}</p>
                  <p className="text-[10px] text-muted mt-0.5">{tpl.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[9px] text-muted font-mono">
                    <span>{tpl.tasks.length} tasks</span>
                    <span>{tpl.milestones.length} milestones</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 dark:border-ink-700 flex justify-between items-center">
              <p className="text-[9px] text-muted">Templates are saved by admin from project "Save as template"</p>
              <button onClick={() => { handleCreate(); setShowTemplatePicker(false); }} className="text-[10px] text-brand font-bold">Blank project →</button>
            </div>
          </div>
        </div>
      )}

      {showAiBot && (
        <AIProjectBot
          llmConfig={state.llmConfig}
          currentUser={currentUser}
          onClose={() => setShowAiBot(false)}
          onCreate={(p) => {
            upsertProject(addAudit(p, currentUser, 'Project created via AI PRJ'));
            setSelectedId(p.id);
            setShowAiBot(false);
          }}
        />
      )}

      {showFamilyManager && (
        <FamilyManagerModal
          families={state.projectFamilies || []}
          onClose={() => setShowFamilyManager(false)}
          onSave={(families) => {
            update((s) => ({ ...s, projectFamilies: families }));
          }}
        />
      )}

      {showBooklet && (
        <BookletModal
          state={state}
          currentUser={currentUser}
          onClose={() => setShowBooklet(false)}
        />
      )}
    </div>
  );
};

/* === External Members Field === */

const ExternalMembersField: React.FC<{
  members: ExternalMember[];
  canEdit: boolean;
  onChange: (members: ExternalMember[]) => void;
}> = ({ members, canEdit, onChange }) => {
  const [form, setForm] = useState({ name: '', email: '', role: '', company: '' });
  const [open, setOpen] = useState(false);

  const add = () => {
    if (!form.name.trim()) return;
    onChange([...members, { id: generateId(), ...form }]);
    setForm({ name: '', email: '', role: '', company: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label-xs">External Members</label>
        {canEdit && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add external
          </button>
        )}
      </div>

      {open && canEdit && (
        <div className="border border-brand/30 bg-brand/5 p-3 grid grid-cols-2 gap-2">
          <Input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Role / function" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <Input placeholder="Company / org" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={add} disabled={!form.name.trim()}>Add</Button>
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-2 py-1 border border-neutral-300 dark:border-ink-500 bg-neutral-50 dark:bg-ink-800 text-xs">
              <div>
                <span className="font-bold">{m.name}</span>
                {m.role && <span className="text-muted ml-1">· {m.role}</span>}
                {m.company && <span className="text-muted ml-1">({m.company})</span>}
              </div>
              {canEdit && (
                <button onClick={() => onChange(members.filter((x) => x.id !== m.id))} className="text-muted hover:text-red-500 ml-1">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {members.length === 0 && !open && (
        <p className="text-xs text-muted">No external members yet.</p>
      )}
    </div>
  );
};

/* === Booklet Presentation Modal === */

const BookletModal: React.FC<{
  state: AppState;
  currentUser: User;
  onClose: () => void;
}> = ({ state, currentUser, onClose }) => {
  const activeProjects = state.projects.filter((p) => !p.isArchived);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [useAI, setUseAI] = useState(!!state.llmConfig?.provider);
  const canUseAI = (currentUser.role === 'admin' || currentUser.role === 'manager') && !!state.llmConfig?.provider;

  const toggle = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = () => setSelected(new Set(activeProjects.map((p) => p.id)));
  const clearAll = () => setSelected(new Set());

  const chosenProjects = activeProjects.filter((p) => selected.has(p.id));

  const generate = async () => {
    if (chosenProjects.length === 0) return;
    let summary = '';
    if (useAI && canUseAI) {
      setAiLoading(true);
      try {
        const names = chosenProjects.map((p) => p.name).join(', ');
        const statuses = chosenProjects.map((p) => `${p.name}: ${p.status}`).join('; ');
        const prompt = `You are a senior PMO analyst writing an executive summary for a SteerCo presentation.
Portfolio: ${chosenProjects.length} projects — ${statuses}.
Write a concise, impactful 3-4 sentence executive summary highlighting key achievements, risks, and strategic recommendations.
Be direct, professional, and action-oriented. No markdown, plain text only.`;
        const result = await runPrompt(prompt, state.llmConfig);
        summary = result || '';
        setAiSummary(summary);
      } catch (_) {
        summary = '';
      }
      setAiLoading(false);
    }
    buildBookletHTML(chosenProjects, state, summary || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <div>
            <p className="label-xs">SteerCo Presentation</p>
            <h2 className="text-lg font-black uppercase tracking-tight">Booklet Presentation</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-muted hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info banner */}
          <div className="border border-brand/30 bg-brand/5 p-3 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-brand mt-0.5 shrink-0" />
            <p className="text-xs text-muted">
              Generates a professional A4 landscape booklet: cover page, agenda, visual exec summary with KPI charts, and one detailed page per project — ready to print or export as PDF.
            </p>
          </div>

          {/* Project selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label-xs">Select projects ({selected.size} selected)</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand hover:underline">All</button>
                <span className="text-muted text-[10px]">·</span>
                <button onClick={clearAll} className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted hover:text-brand">None</button>
              </div>
            </div>
            <div className="border border-neutral-200 dark:border-ink-600 divide-y divide-neutral-200 dark:divide-ink-600 max-h-64 overflow-y-auto">
              {activeProjects.map((p) => {
                const tasks = p.tasks || [];
                const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
                const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
                const pct = totalW ? Math.round((doneW / totalW) * 100) : 0;
                const family = p.familyId ? (state.projectFamilies || []).find((f) => f.id === p.familyId) : null;
                const checked = selected.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? 'bg-brand/5' : 'hover:bg-neutral-50 dark:hover:bg-ink-700'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      className="w-4 h-4 accent-brand"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase tracking-tight text-sm truncate">{p.name}</span>
                        {family && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5" style={{ backgroundColor: (family.color || '#FF3E00') + '20', color: family.color || '#FF3E00' }}>{family.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted uppercase tracking-[0.1em]">{p.status}</span>
                        <span className="text-[10px] text-muted">{pct}% done</span>
                        <span className="text-[10px] text-muted">{tasks.length} tasks</span>
                      </div>
                    </div>
                  </label>
                );
              })}
              {activeProjects.length === 0 && (
                <p className="p-6 text-center text-sm text-muted">No active projects.</p>
              )}
            </div>
          </div>

          {/* AI toggle */}
          {canUseAI && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="w-4 h-4 accent-brand"
              />
              <div>
                <p className="text-sm font-bold">AI Executive Summary</p>
                <p className="text-xs text-muted">Generate a SteerCo-ready executive summary using the local LLM</p>
              </div>
              <Sparkles className="w-4 h-4 text-brand ml-auto" />
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <p className="text-xs text-muted">
            {chosenProjects.length === 0 ? 'Select at least 1 project' : `${chosenProjects.length + 3} pages: cover + agenda + exec summary + ${chosenProjects.length} project${chosenProjects.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={generate}
              disabled={chosenProjects.length === 0 || aiLoading}
            >
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating AI summary…</>
              ) : (
                <><Printer className="w-4 h-4 mr-2" /> Generate Booklet</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* === Family Manager Modal === */

const FamilyManagerModal: React.FC<{
  families: ProjectFamily[];
  onClose: () => void;
  onSave: (families: ProjectFamily[]) => void;
}> = ({ families, onClose, onSave }) => {
  const [draft, setDraft] = useState<ProjectFamily[]>(families);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#FF3E00');

  const addFamily = () => {
    if (!newName.trim()) return;
    const f: ProjectFamily = {
      id: generateId(),
      name: newName.trim(),
      color: newColor,
      createdAt: new Date().toISOString(),
    };
    setDraft((d) => [...d, f]);
    setNewName('');
    setNewColor('#FF3E00');
  };

  const removeFamily = (id: string) => setDraft((d) => d.filter((f) => f.id !== id));

  const updateFamily = (id: string, patch: Partial<ProjectFamily>) =>
    setDraft((d) => d.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-lg animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Manage Project Families</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {draft.map((f) => (
            <div key={f.id} className="flex items-center gap-2 border border-neutral-200 dark:border-ink-600 p-3">
              <input
                type="color"
                value={f.color || '#FF3E00'}
                onChange={(e) => updateFamily(f.id, { color: e.target.value })}
                className="w-8 h-8 border-0 cursor-pointer"
                title="Family color"
              />
              <Input
                value={f.name}
                onChange={(e) => updateFamily(f.id, { name: e.target.value })}
                className="flex-1"
                placeholder="Family name"
              />
              <button onClick={() => removeFamily(f.id)} className="text-muted hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {draft.length === 0 && (
            <p className="text-xs text-muted text-center py-4">No families yet. Add one below.</p>
          )}
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 border-0 cursor-pointer"
            />
            <Input
              placeholder="New family name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFamily(); }}
              className="flex-1"
            />
            <Button size="sm" onClick={addFamily} disabled={!newName.trim()}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { onSave(draft); onClose(); }}>Save</Button>
          </div>
        </div>
      </div>
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
  const [tab, setTab] = useState<'overview' | 'kanban' | 'notes' | 'audit' | 'presentations'>('overview');
  const [draft, setDraft] = useState<Project>(project);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [showPdf, setShowPdf] = useState(false);
  const [showInfographic, setShowInfographic] = useState(false);
  const [infographicHtml, setInfographicHtml] = useState('');
  const [infographicLoading, setInfographicLoading] = useState(false);
  // Linked Apps form state
  const [newAppName, setNewAppName] = useState('');
  const [newAppRole, setNewAppRole] = useState<'impacted' | 'contributor' | 'both'>('impacted');
  const [newAppDesc, setNewAppDesc] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  // Presentations form state
  const [newPptName, setNewPptName] = useState('');
  const [newPptUrl, setNewPptUrl] = useState('');
  const [viewingPresentation, setViewingPresentation] = useState<{ name: string; url: string } | null>(null);
  const canEdit = currentUser.role !== 'viewer';

  const generateInfographic = async () => {
    setInfographicLoading(true);
    setShowInfographic(true);
    setInfographicHtml('');
    const prompt = `You are creating a 5-section HTML committee brief for the project "${draft.name}".
Project description: ${draft.description || '(none)'}
Status: ${draft.status} | Budget: ${draft.budget ?? 'N/A'} | Deadline: ${draft.deadline?.slice(0, 10) ?? 'N/A'}
Tasks: ${draft.tasks.length} total, ${draft.tasks.filter(t => t.status === 'Done').length} done
Context: ${draft.context || '(none)'}

Produce a SINGLE self-contained HTML document (no external deps) with inline CSS only, using colors #FF3E00 (brand orange) and #0a0a0a (dark) on white.
5 sections: 1-Executive Summary, 2-Objectives & Scope, 3-Progress & Milestones, 4-Risks & Blockers, 5-Recommendations.
Each section should have a coloured header bar, concise bullet points, and professional layout.
Return ONLY valid HTML — no markdown fences, no commentary.`;
    try {
      const html = await runPrompt(prompt, state.llmConfig);
      setInfographicHtml(html || '<p>No output generated.</p>');
    } catch (e) {
      setInfographicHtml('<p style="color:red">Failed to generate infographic.</p>');
    }
    setInfographicLoading(false);
  };

  const convertToEmbedUrl = (url: string): string => {
    // Google Slides: convert /pub to /embed
    const gsMatch = url.match(/docs\.google\.com\/presentation\/d\/([^/]+)/);
    if (gsMatch) {
      return `https://docs.google.com/presentation/d/${gsMatch[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    // OneDrive: convert share link to embed
    if (url.includes('1drv.ms') || url.includes('sharepoint.com')) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
    return url;
  };

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


  return (
    <>
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
            {(['overview', 'kanban', 'presentations', 'notes', 'audit'] as const).map((t) => (
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
              <Field label="Confidentiality">
                <Select
                  value={draft.confidentiality || 'internal'}
                  onChange={(e) => setDraft({ ...draft, confidentiality: e.target.value as Project['confidentiality'] })}
                  disabled={!canEdit}
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </Select>
              </Field>
              <Field label="Dev Workflow">
                <Select
                  value={draft.devStatus || ''}
                  onChange={(e) => setDraft({ ...draft, devStatus: (e.target.value as DevStatus) || undefined })}
                  disabled={!canEdit}
                >
                  <option value="">— Not set —</option>
                  <option value="to_start">To Start</option>
                  <option value="dev">Dev</option>
                  <option value="uat">UAT</option>
                  <option value="prod">Prod</option>
                </Select>
              </Field>
              <Field label="Innovation Status">
                <Select
                  value={draft.innovationStatus || ''}
                  onChange={(e) => setDraft({ ...draft, innovationStatus: (e.target.value as InnovationStatus) || undefined })}
                  disabled={!canEdit}
                >
                  <option value="">— Not set —</option>
                  <option value="poc">POC</option>
                  <option value="pilot">Pilot</option>
                  <option value="prod">Prod</option>
                </Select>
              </Field>
              <Field label="Family">
                <Select
                  value={draft.familyId || ''}
                  onChange={(e) => setDraft({ ...draft, familyId: e.target.value || undefined })}
                  disabled={!canEdit}
                >
                  <option value="">— None —</option>
                  {(state.projectFamilies || []).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Est. FTE Gain">
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft.fteGain ?? ''}
                  onChange={(e) => setDraft({ ...draft, fteGain: e.target.value ? parseFloat(e.target.value) : undefined })}
                  disabled={!canEdit}
                  placeholder="e.g. 1.5"
                />
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
                <Field label="Context (background, constraints, notes — paste freely)">
                  <Textarea
                    value={draft.context || ''}
                    onChange={(e) => setDraft({ ...draft, context: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Paste any context: business background, constraints, decisions, references, links…"
                    rows={5}
                  />
                </Field>
              </div>

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

              {/* External members */}
              <div className="md:col-span-2">
                <ExternalMembersField
                  members={draft.externalMembers || []}
                  canEdit={canEdit}
                  onChange={(externalMembers) => setDraft({ ...draft, externalMembers })}
                />
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

              {/* Linked Applications */}
              <div className="md:col-span-2 mt-2 surface-flat border p-4">
                <h4 className="text-sm font-bold uppercase tracking-tight mb-3">Linked Applications</h4>
                <div className="space-y-2 mb-3">
                  {(draft.linkedApps || []).map((app) => (
                    <div key={app.id} className="flex items-start justify-between gap-3 border border-neutral-200 dark:border-ink-600 p-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold">{app.name}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border ${
                            app.role === 'impacted' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-300' :
                            app.role === 'contributor' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 text-emerald-700 dark:text-emerald-300' :
                            'bg-brand/10 border-brand text-brand'
                          }`}>{app.role}</span>
                          {app.url && <a href={app.url} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline truncate max-w-[160px]">{app.url}</a>}
                        </div>
                        {app.description && <p className="text-[11px] text-muted mt-0.5">{app.description}</p>}
                      </div>
                      {canEdit && (
                        <button onClick={() => setDraft(d => ({ ...d, linkedApps: (d.linkedApps || []).filter(a => a.id !== app.id) }))} className="text-muted hover:text-red-500 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!(draft.linkedApps || []).length && <p className="text-xs text-muted">No linked applications yet.</p>}
                </div>
                {canEdit && (
                  <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 dark:border-ink-600 pt-3">
                    <Input placeholder="App name" value={newAppName} onChange={e => setNewAppName(e.target.value)} />
                    <select value={newAppRole} onChange={e => setNewAppRole(e.target.value as 'impacted' | 'contributor' | 'both')} className="input-base text-xs">
                      <option value="impacted">Impacted</option>
                      <option value="contributor">Contributor</option>
                      <option value="both">Both</option>
                    </select>
                    <Input placeholder="Description (optional)" value={newAppDesc} onChange={e => setNewAppDesc(e.target.value)} />
                    <Input placeholder="URL (optional)" value={newAppUrl} onChange={e => setNewAppUrl(e.target.value)} />
                    <div className="col-span-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!newAppName.trim()) return;
                        setDraft(d => ({ ...d, linkedApps: [...(d.linkedApps || []), { id: generateId(), name: newAppName.trim(), role: newAppRole, description: newAppDesc.trim() || undefined, url: newAppUrl.trim() || undefined }] }));
                        setNewAppName(''); setNewAppDesc(''); setNewAppUrl(''); setNewAppRole('impacted');
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Add App
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Presentations Tab */}
          {tab === 'presentations' && (
            <div className="space-y-3">
              {(draft.presentations || []).map((p) => (
                <div key={p.id} className="surface-flat border p-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setViewingPresentation({ name: p.name, url: convertToEmbedUrl(p.url) })}>View</Button>
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline">Open</a>
                    {canEdit && (
                      <button onClick={() => setDraft(d => ({ ...d, presentations: (d.presentations || []).filter(x => x.id !== p.id) }))} className="text-muted hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!(draft.presentations || []).length && <p className="text-xs text-muted py-4 text-center">No presentations linked yet.</p>}
              {canEdit && (
                <div className="border-t border-neutral-200 dark:border-ink-600 pt-4 flex items-center gap-2 flex-wrap">
                  <Input placeholder="Presentation name" value={newPptName} onChange={e => setNewPptName(e.target.value)} className="flex-1 min-w-[160px]" />
                  <Input placeholder="URL (Google Slides, OneDrive, etc.)" value={newPptUrl} onChange={e => setNewPptUrl(e.target.value)} className="flex-1 min-w-[220px]" />
                  <Button size="sm" variant="outline" onClick={() => {
                    if (!newPptName.trim() || !newPptUrl.trim()) return;
                    setDraft(d => ({ ...d, presentations: [...(d.presentations || []), { id: generateId(), name: newPptName.trim(), url: newPptUrl.trim(), addedAt: new Date().toISOString(), addedByUserId: currentUser.id }] }));
                    setNewPptName(''); setNewPptUrl('');
                  }}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              )}
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

          {tab === 'notes' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Project Notes — scratchpad</p>
                <span className="text-[9px] text-muted">(auto-saved with project)</span>
              </div>
              <textarea
                className="w-full input-base resize-none text-[12px] leading-relaxed"
                rows={18}
                placeholder="Free-form notes, decisions, context, links, meeting takeaways…"
                value={draft.notes || ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                disabled={!canEdit}
              />
            </div>
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
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={() => setShowPdf(true)}>
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            {canEdit && state.llmConfig?.provider && (
              <Button variant="outline" size="md" onClick={generateInfographic} disabled={infographicLoading}>
                <Sparkles className="w-4 h-4 mr-2" />
                {infographicLoading ? 'Generating…' : 'AI Infographic'}
              </Button>
            )}
            {canEdit && currentUser.role === 'admin' && (
              <Button
                variant="outline" size="md"
                onClick={() => {
                  onSave({ ...draft });
                  onAudit('Saved as template', draft.name);
                  // signal parent to save template
                  window.dispatchEvent(new CustomEvent('doing_save_template', { detail: { project: draft } }));
                }}
                title="Save current project structure as a reusable template"
              >
                <Clipboard className="w-4 h-4 mr-2" />
                Save as template
              </Button>
            )}
          </div>
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

    {showPdf && (
      <ProjectPDFModal
        project={draft}
        state={state}
        aiSynthesis={aiOutput}
        onClose={() => setShowPdf(false)}
      />
    )}

    {/* AI Infographic Modal */}
    {showInfographic && (
      <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-ink-900 w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-ink-600">
            <h3 className="text-sm font-bold uppercase tracking-widest">AI Infographic — {draft.name}</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const w = window.open('', '_blank');
                if (w) { w.document.write(infographicHtml); w.document.close(); w.print(); }
              }} disabled={infographicLoading}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(infographicHtml)} disabled={infographicLoading}>
                <Clipboard className="w-3.5 h-3.5 mr-1" /> Copy HTML
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowInfographic(false); setInfographicHtml(''); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {infographicLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
                <span className="ml-3 text-sm text-muted">Generating infographic…</span>
              </div>
            ) : (
              <iframe srcDoc={infographicHtml} className="w-full h-full border-0" title="AI Infographic" sandbox="allow-same-origin" />
            )}
          </div>
        </div>
      </div>
    )}

    {/* Presentation Viewer Modal */}
    {viewingPresentation && (
      <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-ink-900 w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-ink-600">
            <h3 className="text-sm font-bold uppercase tracking-widest truncate">{viewingPresentation.name}</h3>
            <button onClick={() => setViewingPresentation(null)} className="text-muted hover:text-neutral-900 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={viewingPresentation.url}
              className="w-full h-full border-0"
              title={viewingPresentation.name}
              allowFullScreen
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

const ProjectPDFModal: React.FC<{
  project: Project;
  state: AppState;
  aiSynthesis: string;
  onClose: () => void;
}> = ({ project, state, aiSynthesis, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [landscape, setLandscape] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const html = buildProjectHTML(project, state, aiSynthesis, landscape);

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handlePrint = () => iframeRef.current?.contentWindow?.print();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className={`bg-white dark:bg-ink-900 flex flex-col border border-neutral-200 dark:border-ink-700 shadow-2xl transition-all ${fullscreen ? 'w-full h-full' : 'w-full max-w-5xl h-[90vh]'}`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-ink-700 shrink-0 bg-neutral-50 dark:bg-ink-800">
          <div className="flex items-center gap-2">
            <FileDown className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Project Brief PDF</span>
            <span className="text-[10px] text-muted ml-2">{project.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLandscape((v) => !v)}
              title={landscape ? 'Switch to portrait' : 'Switch to landscape'}
              className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] border transition-colors ${landscape ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand'}`}
            >
              {landscape ? '⬛ Landscape' : '▭ Portrait'}
            </button>
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="w-8 h-8 flex items-center justify-center border border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand transition-colors"
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iframe preview */}
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-same-origin allow-scripts allow-modals allow-popups"
          title="Project Brief PDF Preview"
        />
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
              : status === TaskStatus.ONGOING
              ? 'border-blue-500/40 bg-blue-500/8 dark:bg-blue-500/10'
              : status === TaskStatus.DONE
              ? 'border-emerald-500/40 bg-emerald-500/8 dark:bg-emerald-500/10'
              : '';
          const labelColor =
            status === TaskStatus.BLOCKED
              ? 'text-red-500'
              : status === TaskStatus.PAUSED
              ? 'text-orange-500'
              : status === TaskStatus.ONGOING
              ? 'text-blue-600 dark:text-blue-400'
              : status === TaskStatus.DONE
              ? 'text-emerald-600 dark:text-emerald-400'
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
