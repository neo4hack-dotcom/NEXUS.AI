/**
 * PendingProjects — review workflow for SharePoint-imported drafts.
 *
 * Access: admin + manager only (group g6).
 *
 * For each pending item the reviewer sees:
 *   - The AI-generated draft (editable inline before confirm)
 *   - The raw SharePoint record (collapsible)
 *   - The AI rationale + confidence chip
 *
 * Actions:
 *   - Confirm   → promotes to a real Project, drops the pending record
 *   - Reject    → keeps the pending record for audit but won't import again
 *   - Edit      → opens inline editor for the draft fields
 *   - Re-run AI → re-asks the LLM for a fresh mapping (uses current config)
 */

import React, { useMemo, useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Pencil,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  User as UserIcon,
  Tag,
  AlertTriangle,
  Save,
  X,
  Filter,
  ExternalLink,
} from 'lucide-react';
import {
  AppState,
  User,
  PendingProject,
  Project,
  ProjectStatus,
  PendingProjectStatus,
} from '../../types';
import { generateId } from '../../services/storage';
import { mapWithLlm } from '../../services/sharepointService';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtRelative = (iso?: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)        return `${mins}m ago`;
  if (mins < 1440)      return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

const STATUS_META: Record<PendingProjectStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  confirmed: { label: 'Confirmed',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  rejected:  { label: 'Rejected',       color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

const CONFIDENCE_META: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high:   { label: 'High confidence',   color: 'text-emerald-600' },
  medium: { label: 'Medium confidence', color: 'text-amber-600' },
  low:    { label: 'Low confidence',    color: 'text-red-600' },
};

export const PendingProjects: React.FC<Props> = ({ state, currentUser, update }) => {
  const all = state.pendingProjects ?? [];
  const [filter, setFilter] = useState<PendingProjectStatus | 'all'>('pending');
  const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const items = filter === 'all' ? all : all.filter((p) => p.status === filter);
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [all, filter]);

  const stats = useMemo(() => ({
    pending:   all.filter((p) => p.status === 'pending').length,
    confirmed: all.filter((p) => p.status === 'confirmed').length,
    rejected:  all.filter((p) => p.status === 'rejected').length,
  }), [all]);

  const toggleRaw = (id: string) => {
    setExpandedRaw((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const markBusy = (id: string, on: boolean) => {
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id); else n.delete(id);
      return n;
    });
  };

  // Confirm → promote to real project
  const confirmItem = (item: PendingProject) => {
    const now = new Date().toISOString();
    const draft = item.draft;
    const newProject: Project = {
      id: generateId(),
      name:        draft.name        ?? 'Imported project',
      description: draft.description ?? '',
      context:     draft.context     ?? '',
      notes:       '',
      status:      (draft.status as ProjectStatus) ?? ('Active' as ProjectStatus),
      managerId:   draft.managerId,
      startDate:   draft.startDate   ?? now.slice(0, 10),
      deadline:    draft.deadline    ?? new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      members:     [],
      tasks:       [],
      milestones:  [],
      technologyIds: [],
      repoIds:     [],
      tags:        Array.from(new Set([...(draft.tags ?? []), `sp:${item.spItemId}`])),
      auditLog:    [{
        id: generateId(),
        date: now,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        action: 'Imported from SharePoint',
        details: `SP item #${item.spItemId} confirmed by ${currentUser.firstName} ${currentUser.lastName}`,
      }],
      createdAt: now,
      updatedAt: now,
    };
    update((s) => ({
      ...s,
      projects: [...s.projects, newProject],
      pendingProjects: (s.pendingProjects ?? []).map((p) =>
        p.id === item.id
          ? { ...p, status: 'confirmed', reviewedByUserId: currentUser.id, reviewedAt: now }
          : p
      ),
    }));
  };

  const rejectItem = (item: PendingProject, notes?: string) => {
    const now = new Date().toISOString();
    update((s) => ({
      ...s,
      pendingProjects: (s.pendingProjects ?? []).map((p) =>
        p.id === item.id
          ? { ...p, status: 'rejected', reviewedByUserId: currentUser.id, reviewedAt: now, reviewNotes: notes }
          : p
      ),
    }));
  };

  const reRunAi = async (item: PendingProject) => {
    markBusy(item.id, true);
    try {
      const { draft, aiRationale, aiConfidence } = await mapWithLlm(
        item.spRawItem,
        state.sharePointConfig,
        state.llmConfig,
        state.users,
      );
      update((s) => ({
        ...s,
        pendingProjects: (s.pendingProjects ?? []).map((p) =>
          p.id === item.id
            ? { ...p, draft, aiRationale, aiConfidence }
            : p
        ),
      }));
    } catch (e: any) {
      alert(`Re-run AI failed: ${e.message}`);
    } finally {
      markBusy(item.id, false);
    }
  };

  const saveDraftEdits = (item: PendingProject, newDraft: Partial<Project>) => {
    update((s) => ({
      ...s,
      pendingProjects: (s.pendingProjects ?? []).map((p) =>
        p.id === item.id ? { ...p, draft: newDraft } : p
      ),
    }));
    setEditing(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">Admin · Manager</p>
          <h1 className="display-xl flex items-center gap-3">
            <Inbox className="w-7 h-7 text-brand" />
            Pending Imports
          </h1>
          <p className="text-sm text-muted mt-1">
            Projects auto-discovered from SharePoint. Review each AI-generated draft, edit if needed, then confirm to promote it to a real project.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending review', value: stats.pending,   color: 'text-amber-600' },
          { label: 'Confirmed',      value: stats.confirmed, color: 'text-emerald-600' },
          { label: 'Rejected',       value: stats.rejected,  color: 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="surface border p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-1">{k.label}</p>
            <p className={`text-2xl font-black tracking-tight ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="w-3.5 h-3.5 text-muted mr-1" />
        {(['all', 'pending', 'confirmed', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
              filter === s
                ? 'bg-brand text-white border-brand'
                : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_META[s as PendingProjectStatus].label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface border border-dashed p-16 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted">
            {all.length === 0
              ? 'No pending imports yet. Configure SharePoint in Settings → SharePoint Import.'
              : `No items match the "${filter}" filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isOpen = expandedRaw.has(item.id);
            const isEditing = editing === item.id;
            const isBusy = busy.has(item.id);
            const reviewer = item.reviewedByUserId ? state.users.find((u) => u.id === item.reviewedByUserId) : null;
            const manager = item.draft.managerId ? state.users.find((u) => u.id === item.draft.managerId) : null;

            return (
              <div key={item.id} className="surface border">
                {/* Header */}
                <div className="px-5 py-4 border-b border-neutral-200 dark:border-ink-600 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${STATUS_META[item.status].color}`}>
                        {STATUS_META[item.status].label}
                      </span>
                      {item.aiConfidence && (
                        <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] ${CONFIDENCE_META[item.aiConfidence].color}`}>
                          <Sparkles className="w-2.5 h-2.5" />
                          {CONFIDENCE_META[item.aiConfidence].label}
                        </span>
                      )}
                      <span className="text-[9px] font-mono text-muted">
                        SP #{item.spItemId} · fetched {fmtRelative(item.spFetchedAt)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold tracking-tight">
                      {item.draft.name || <span className="text-muted italic">Unnamed draft</span>}
                    </h3>
                    {item.aiRationale && (
                      <p className="text-[11px] text-muted italic mt-1 flex items-start gap-1">
                        <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-brand" />
                        {item.aiRationale}
                      </p>
                    )}
                  </div>
                  {item.status === 'pending' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditing(isEditing ? null : item.id)}
                        title="Edit draft"
                        className="px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={() => reRunAi(item)}
                        disabled={isBusy}
                        title="Re-run the LLM mapping"
                        className="px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors flex items-center gap-1 disabled:opacity-40"
                      >
                        <RotateCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                        Re-AI
                      </button>
                      <button
                        onClick={() => {
                          const notes = window.prompt('Optional rejection reason (left blank = no reason):');
                          rejectItem(item, notes ?? undefined);
                        }}
                        title="Reject"
                        className="px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-red-300/40 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                      <button
                        onClick={() => confirmItem(item)}
                        title="Confirm and promote to a real project"
                        className="px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.14em] bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Confirm
                      </button>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  {isEditing ? (
                    <DraftEditor
                      draft={item.draft}
                      users={state.users}
                      onSave={(d) => saveDraftEdits(item, d)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      {item.draft.description && (
                        <p className="text-[12px] leading-relaxed">{item.draft.description}</p>
                      )}
                      {item.draft.context && (
                        <p className="text-[11px] text-muted italic">
                          <strong>Context:</strong> {item.draft.context}
                        </p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] pt-2 border-t border-neutral-100 dark:border-ink-700">
                        <Meta icon={Calendar} label="Start">
                          {fmtDate(item.draft.startDate)}
                        </Meta>
                        <Meta icon={Calendar} label="Deadline">
                          {fmtDate(item.draft.deadline)}
                        </Meta>
                        <Meta icon={UserIcon} label="Manager">
                          {manager ? `${manager.firstName} ${manager.lastName}` : <span className="text-muted italic">unmapped</span>}
                        </Meta>
                        <Meta icon={AlertTriangle} label="Status">
                          {item.draft.status ?? '—'}
                        </Meta>
                      </div>
                      {(item.draft.tags ?? []).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <Tag className="w-3 h-3 text-muted" />
                          {(item.draft.tags ?? []).map((t) => (
                            <span key={t} className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] border border-neutral-300 dark:border-ink-600 text-muted">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer (reviewer + raw toggle) */}
                <div className="px-5 py-2.5 border-t border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 flex items-center justify-between text-[10px] flex-wrap gap-2">
                  <div className="text-muted font-mono">
                    {item.spSource && (
                      <a href={item.spSource.siteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" />
                        {item.spSource.listName}
                      </a>
                    )}
                    {reviewer && (
                      <span className="ml-3">
                        Reviewed by <strong>{reviewer.firstName} {reviewer.lastName}</strong> · {fmtRelative(item.reviewedAt)}
                      </span>
                    )}
                    {item.reviewNotes && (
                      <span className="ml-3 italic">"{item.reviewNotes}"</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleRaw(item.id)}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted hover:text-brand"
                  >
                    {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Raw SharePoint payload
                  </button>
                </div>
                {isOpen && (
                  <pre className="px-5 py-3 text-[10px] font-mono bg-neutral-900 text-neutral-100 overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(item.spRawItem, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Small helpers
   ────────────────────────────────────────────────────────────────────────── */

const Meta: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }> = ({
  icon: Icon, label, children,
}) => (
  <div>
    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-0.5 flex items-center gap-1">
      <Icon className="w-2.5 h-2.5" />
      {label}
    </p>
    <p>{children}</p>
  </div>
);

const DraftEditor: React.FC<{
  draft: Partial<Project>;
  users: User[];
  onSave: (d: Partial<Project>) => void;
  onCancel: () => void;
}> = ({ draft, users, onSave, onCancel }) => {
  const [form, setForm] = useState<Partial<Project>>(draft);
  const set = <K extends keyof Project>(k: K, v: Project[K] | undefined) =>
    setForm((d) => ({ ...d, [k]: v }));

  const inputCls = 'w-full h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors';
  const textareaCls = 'w-full px-3 py-2 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors resize-none';

  return (
    <div className="space-y-3 border border-brand/40 bg-brand/5 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name *">
          <input className={inputCls} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={(form.status as string) ?? 'Active'} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
            <option value="Planning">Planning</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Done">Done</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea rows={2} className={textareaCls} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Context">
        <textarea rows={2} className={textareaCls} value={form.context ?? ''} onChange={(e) => set('context', e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Start date">
          <input type="date" className={inputCls} value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Deadline">
          <input type="date" className={inputCls} value={form.deadline ?? ''} onChange={(e) => set('deadline', e.target.value)} />
        </Field>
        <Field label="Manager">
          <select className={inputCls} value={form.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || undefined)}>
            <option value="">— Unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Tags (comma-separated)">
        <input className={inputCls} value={(form.tags ?? []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="flex items-center gap-1 px-3 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-neutral-400">
          <X className="w-3 h-3" /> Cancel
        </button>
        <button onClick={() => onSave(form)} className="flex items-center gap-1 px-3 h-8 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90">
          <Save className="w-3 h-3" /> Save draft
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">
      {label}
    </label>
    {children}
  </div>
);
