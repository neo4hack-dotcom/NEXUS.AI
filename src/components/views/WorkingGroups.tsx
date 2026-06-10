/**
 * WorkingGroupsView — continuous work sessions, reworked to match the
 * DOING_New2 experience (two-pane layout + session timeline + 4-tab session
 * editor + action modal + smart carry-over of unfinished items + AI reports),
 * rendered in the DOINg.AI brutalist brand (brand orange #FF3E00, ink scale).
 *
 * Data model: each WorkingGroup keeps its sessions in `meetings`
 * (WGMeetingNote). A session has notes, decisions, action items (with status /
 * priority / category / owner) and a checklist (with urgent flag).
 */

import React, { useMemo, useState } from 'react';
import {
  Plus, Folder, Calendar, CheckSquare, Trash2, X, Edit, UserPlus, Clock,
  AlertTriangle, FileText, Sparkles, Bot, Loader2, Copy, Check, Flag, Layers,
  List, Edit2, Gavel, Siren, Printer, Users as UsersIcon,
} from 'lucide-react';
import {
  AppState, User, WorkingGroup, WGMeetingNote, WGActionItem, WGActionStatus,
  WGChecklistItem, WGTaskPriority,
} from '../../types';
import { generateId } from '../../services/storage';
import { runPrompt } from '../../services/llmService';
import { useEditingLock } from '../../hooks/useEditingLock';
import { MarkdownView } from '../ui/MarkdownView';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const now = () => new Date().toISOString();

const STATUS_LABEL: Record<WGActionStatus, string> = {
  todo: 'To start', ongoing: 'Ongoing', blocked: 'Blocked', done: 'Done',
};
const statusColor = (s: WGActionStatus): string => {
  switch (s) {
    case 'done': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'blocked': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'ongoing': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    default: return 'bg-neutral-100 text-neutral-600 dark:bg-ink-700 dark:text-neutral-300';
  }
};
const priorityColor = (p?: WGTaskPriority): string => {
  switch (p) {
    case 'urgent': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-sky-500';
    default: return 'text-neutral-400';
  }
};

export const WorkingGroupsView: React.FC<Props> = ({ state, currentUser, update }) => {
  const groups = state.workingGroups ?? [];

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groups[0]?.id ?? null);
  const [editingGroup, setEditingGroup] = useState<WorkingGroup | null>(null);
  const [editingSession, setEditingSession] = useState<{ groupId: string; session: WGMeetingNote } | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'decisions' | 'actions' | 'checklist'>('notes');
  const [actionInEdit, setActionInEdit] = useState<{ index: number; action: WGActionItem } | null>(null);
  const [newDecisionText, setNewDecisionText] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(false);

  // AI report modal
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContent, setAiContent] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

  useEditingLock(!!editingGroup || !!editingSession || !!actionInEdit);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const canEdit = !!currentUser && (
    currentUser.role === 'admin' || (selectedGroup?.members ?? []).some((m) => m.userId === currentUser.id)
  );

  // ── persistence helpers ──────────────────────────────────────────────
  const upsertGroup = (g: WorkingGroup) =>
    update((s) => ({
      ...s,
      workingGroups: (s.workingGroups ?? []).some((x) => x.id === g.id)
        ? (s.workingGroups ?? []).map((x) => (x.id === g.id ? { ...g, updatedAt: now() } : x))
        : [{ ...g, updatedAt: now() }, ...(s.workingGroups ?? [])],
    }));

  const deleteGroup = (id: string) => {
    if (!window.confirm('Delete this working group and all its sessions?')) return;
    update((s) => ({ ...s, workingGroups: (s.workingGroups ?? []).filter((g) => g.id !== id) }));
    if (selectedGroupId === id) setSelectedGroupId(null);
  };

  const projectName = (id?: string) => (id ? state.projects.find((p) => p.id === id)?.name : null);
  const userName = (id?: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : null;
  };
  const hasBlocked = (g: WorkingGroup) => {
    const latest = [...(g.meetings ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    return !!latest?.actionItems?.some((a) => a.status === 'blocked');
  };
  const groupCategories = (g: WorkingGroup | null): string[] => {
    const set = new Set<string>();
    (g?.meetings ?? []).forEach((m) => (m.actionItems ?? []).forEach((a) => a.category && set.add(a.category)));
    return [...set];
  };

  // ── group handlers ───────────────────────────────────────────────────
  const handleCreateGroup = () => {
    const g: WorkingGroup = {
      id: generateId(),
      name: 'New Working Group',
      description: '', objective: '', status: 'active',
      ownerId: currentUser.id,
      members: [{ userId: currentUser.id, role: 'lead' }],
      tasks: [], meetings: [], tags: [],
      createdAt: now(), updatedAt: now(),
    };
    setEditingGroup(g);
  };
  const saveGroup = () => {
    if (!editingGroup) return;
    upsertGroup(editingGroup);
    setSelectedGroupId(editingGroup.id);
    setEditingGroup(null);
  };

  // ── session handlers ─────────────────────────────────────────────────
  const sortedSessions = useMemo(
    () => [...(selectedGroup?.meetings ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [selectedGroup]
  );

  const handleCreateSession = (g: WorkingGroup) => {
    const prev = [...(g.meetings ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    // Smart carry-over: clone unfinished actions + checklist items into the new session.
    const carryActions: WGActionItem[] = (prev?.actionItems ?? [])
      .filter((a) => a.status !== 'done')
      .map((a) => ({ ...a, id: generateId(), carriedFromSessionId: prev!.id }));
    const carryChecklist: WGChecklistItem[] = (prev?.checklist ?? [])
      .filter((c) => !c.done)
      .map((c) => ({ ...c, id: generateId() }));
    const session: WGMeetingNote = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      title: '', attendeeIds: [], notes: '',
      decisions: [], actionItems: carryActions, checklist: carryChecklist,
      createdAt: now(), updatedAt: now(),
    };
    setEditingSession({ groupId: g.id, session });
    setActiveTab('notes');
  };

  const handleEditSession = (g: WorkingGroup, s: WGMeetingNote) => {
    setEditingSession({ groupId: g.id, session: JSON.parse(JSON.stringify(s)) });
    setActiveTab('notes');
  };

  const saveSession = () => {
    if (!editingSession) return;
    const g = groups.find((x) => x.id === editingSession.groupId);
    if (g) {
      const idx = (g.meetings ?? []).findIndex((m) => m.id === editingSession.session.id);
      const stamped = { ...editingSession.session, updatedAt: now() };
      const meetings = idx >= 0
        ? g.meetings.map((m) => (m.id === stamped.id ? stamped : m))
        : [stamped, ...(g.meetings ?? [])];
      upsertGroup({ ...g, meetings });
    }
    setEditingSession(null);
  };

  const deleteSession = () => {
    if (!editingSession) return;
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    const g = groups.find((x) => x.id === editingSession.groupId);
    if (g) upsertGroup({ ...g, meetings: (g.meetings ?? []).filter((m) => m.id !== editingSession.session.id) });
    setEditingSession(null);
  };

  // session-local mutators
  const patchSession = (patch: Partial<WGMeetingNote>) =>
    setEditingSession((cur) => (cur ? { ...cur, session: { ...cur.session, ...patch } } : cur));

  const saveActionFromModal = () => {
    if (!editingSession || !actionInEdit) return;
    const items = [...(editingSession.session.actionItems ?? [])];
    if (actionInEdit.index === -1) items.push(actionInEdit.action);
    else items[actionInEdit.index] = actionInEdit.action;
    patchSession({ actionItems: items });
    setActionInEdit(null);
  };
  const openActionModal = (index: number, action?: WGActionItem) => {
    setActionInEdit(action
      ? { index, action: { ...action } }
      : { index: -1, action: { id: generateId(), text: '', ownerId: '', dueDate: '', status: 'todo', priority: 'medium', category: '' } });
  };
  const deleteAction = (index: number) => {
    if (!editingSession) return;
    patchSession({ actionItems: (editingSession.session.actionItems ?? []).filter((_, i) => i !== index) });
  };

  const addChecklist = () => {
    if (!editingSession) return;
    patchSession({ checklist: [...(editingSession.session.checklist ?? []), { id: generateId(), text: '', comment: '', isUrgent: false, done: false }] });
  };
  const updateChecklist = (index: number, field: keyof WGChecklistItem, value: any) => {
    if (!editingSession) return;
    patchSession({ checklist: (editingSession.session.checklist ?? []).map((c, i) => (i === index ? { ...c, [field]: value } : c)) });
  };
  const deleteChecklist = (index: number) => {
    if (!editingSession) return;
    patchSession({ checklist: (editingSession.session.checklist ?? []).filter((_, i) => i !== index) });
  };

  const addDecision = () => {
    if (!editingSession || !newDecisionText.trim()) return;
    patchSession({ decisions: [...(editingSession.session.decisions ?? []), newDecisionText.trim()] });
    setNewDecisionText('');
  };
  const deleteDecision = (idx: number) => {
    if (!editingSession) return;
    patchSession({ decisions: (editingSession.session.decisions ?? []).filter((_, i) => i !== idx) });
  };

  // ── AI report ────────────────────────────────────────────────────────
  const buildGroupData = (g: WorkingGroup, onlyLast: boolean): string => {
    const sessions = [...(g.meetings ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    const scope = onlyLast ? sessions.slice(0, 1) : sessions;
    const lines: string[] = [`GROUP: ${g.name}`];
    if (g.projectId) lines.push(`LINKED PROJECT: ${projectName(g.projectId) ?? g.projectId}`);
    lines.push(`MEMBERS: ${g.members.map((m) => userName(m.userId) ?? m.userId).join(', ') || 'none'}`);
    scope.forEach((s) => {
      lines.push(`\nSESSION ${s.date}:`);
      if (s.notes) lines.push(`Notes: ${s.notes}`);
      if (s.decisions?.length) lines.push(`Decisions: ${s.decisions.join(' | ')}`);
      (s.actionItems ?? []).forEach((a) =>
        lines.push(`Action [${STATUS_LABEL[a.status]}${a.priority ? `/${a.priority}` : ''}]${a.category ? ` (${a.category})` : ''}: ${a.text}${a.ownerId ? ` -> ${userName(a.ownerId) ?? a.ownerId}` : ''}${a.dueDate ? ` due ${a.dueDate}` : ''}`));
      (s.checklist ?? []).forEach((c) => lines.push(`Checklist [${c.done ? 'x' : ' '}]${c.isUrgent ? ' URGENT' : ''}: ${c.text}`));
    });
    return lines.join('\n');
  };

  const runReport = async (onlyLast: boolean) => {
    if (!selectedGroup) return;
    setAiTitle(onlyLast ? `Last session summary — ${selectedGroup.name}` : `Deep analysis — ${selectedGroup.name}`);
    setAiContent(''); setAiLoading(true); setAiOpen(true);
    const prompt = `You are DOINg.AI, an executive operations assistant. Produce a polished ${onlyLast ? 'summary of the latest working session' : 'full analysis of this working group across its sessions'} in English, using rich Markdown (headings, bullet lists, **bold**, and a short table of open action items with owner + status). Cover progress, key decisions, blockers/risks, who owns what, and clear next steps. Be specific; do not invent data.\n\nDATA:\n${buildGroupData(selectedGroup, onlyLast)}`;
    try {
      const out = await runPrompt(prompt, state.llmConfig);
      setAiContent(out || '_No output generated._');
    } catch {
      setAiContent('> Generation failed. Check the local LLM connection in Settings.');
    } finally {
      setAiLoading(false);
    }
  };

  const printReport = () => {
    const body = document.getElementById('wg-report-render')?.innerHTML ?? '';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${aiTitle}</title>
<style>@media print{@page{size:A4;margin:18mm}}body{font-family:-apple-system,system-ui,sans-serif;color:#111;max-width:820px;margin:0 auto;padding:32px;line-height:1.6}
h1,h2,h3{font-weight:800;letter-spacing:-.02em}h2{border-bottom:2px solid #FF3E00;padding-bottom:4px}h3{color:#FF3E00}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:10pt}th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}th{background:#faf3f0}
.cover{background:#050505;color:#fff;padding:28px;margin:-32px -32px 24px}.brand{font-size:26pt;font-weight:900}.brand span{color:#FF3E00}</style></head><body>
<div class="cover"><div style="font-size:8pt;letter-spacing:.25em;text-transform:uppercase;color:#FF3E00;margin-bottom:8px">Working Group · ${today}</div><div class="brand">DOINg<span>.AI</span></div><div style="color:#aaa;margin-top:4px">${aiTitle}</div></div>
${body}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  // ── render: empty state ──────────────────────────────────────────────
  if (groups.length === 0) {
    return (
      <div className="max-w-7xl mx-auto animate-fade-in">
        {editingGroup && renderGroupModal()}
        <div className="surface border p-12 text-center max-w-lg mx-auto mt-10">
          <div className="w-20 h-20 bg-brand/10 flex items-center justify-center mx-auto mb-6">
            <Folder className="w-10 h-10 text-brand" />
          </div>
          <h2 className="display-xl mb-3">Working Groups</h2>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            Organise continuous work sessions, track long-running topics and keep a history of decisions and actions.
          </p>
          <button onClick={handleCreateGroup} className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white text-[11px] font-bold uppercase tracking-[0.16em] hover:bg-brand/90 transition-colors">
            <Plus className="w-4 h-4" /> Create first group
          </button>
        </div>
      </div>
    );
  }

  // ── render: main ─────────────────────────────────────────────────────
  return (
    <div className="flex gap-5 max-w-[1500px] mx-auto h-[calc(100vh-7rem)] animate-fade-in">
      {editingGroup && renderGroupModal()}
      {editingSession && renderSessionModal()}
      {actionInEdit && renderActionModal()}
      {aiOpen && renderAiModal()}

      {/* Sidebar — group list */}
      <div className="w-72 shrink-0 surface border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em]">Working Groups</h2>
          <button onClick={handleCreateGroup} title="New group" className="w-8 h-8 flex items-center justify-center bg-brand text-white hover:bg-brand/90 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {groups.map((g) => {
            const active = g.id === selectedGroupId;
            return (
              <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                className={`w-full text-left p-3 border transition-colors ${active ? 'border-brand bg-brand/5' : 'border-transparent hover:bg-neutral-100 dark:hover:bg-ink-700'}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-[13px] font-bold leading-snug ${active ? 'text-brand' : ''}`}>{g.name}</h3>
                  {hasBlocked(g) && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                </div>
                {g.projectId && (
                  <p className="text-[10px] text-muted flex items-center gap-1 mt-1 truncate"><Folder className="w-3 h-3" /> {projectName(g.projectId)}</p>
                )}
                <p className="text-[10px] text-muted mt-1">{(g.meetings ?? []).length} session{(g.meetings ?? []).length !== 1 ? 's' : ''}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main — selected group */}
      <div className="flex-1 surface border flex flex-col overflow-hidden min-w-0">
        {selectedGroup ? (
          <>
            <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-start justify-between gap-3 surface-flat">
              <div className="min-w-0">
                <h2 className="text-xl font-black uppercase tracking-tight truncate">{selectedGroup.name}</h2>
                <div className="flex gap-4 text-[11px] text-muted mt-1">
                  {selectedGroup.projectId && <span className="flex items-center gap-1"><Folder className="w-3.5 h-3.5" /> {projectName(selectedGroup.projectId)}</span>}
                  <span className="flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" /> {selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <button onClick={() => setGroupByCategory((v) => !v)} title="Group actions by category"
                  className={`flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border transition-colors ${groupByCategory ? 'border-brand text-brand' : 'border-neutral-300 dark:border-ink-600 text-muted hover:border-brand hover:text-brand'}`}>
                  {groupByCategory ? <Layers className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />} {groupByCategory ? 'Grouped' : 'List'}
                </button>
                {state.llmConfig?.provider && (
                  <>
                    <button onClick={() => runReport(false)} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border border-neutral-300 dark:border-ink-600 text-brand hover:border-brand transition-colors"><FileText className="w-3.5 h-3.5" /> Full report</button>
                    <button onClick={() => runReport(true)} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border border-neutral-300 dark:border-ink-600 text-purple-500 hover:border-purple-500 transition-colors"><Sparkles className="w-3.5 h-3.5" /> Last session</button>
                  </>
                )}
                {canEdit && (
                  <>
                    <button onClick={() => setEditingGroup(selectedGroup)} title="Configure" className="w-8 h-8 flex items-center justify-center text-muted hover:text-brand transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => deleteGroup(selectedGroup.id)} title="Delete group" className="w-8 h-8 flex items-center justify-center text-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => handleCreateSession(selectedGroup)} className="flex items-center gap-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-[0.12em] bg-brand text-white hover:bg-brand/90 transition-colors ml-1"><Plus className="w-3.5 h-3.5" /> New session</button>
                  </>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-6">
              {sortedSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted">
                  <Clock className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">No sessions yet.</p>
                  {canEdit && <p className="text-xs">Create a session to start tracking.</p>}
                </div>
              ) : (
                <div className="relative pl-6 space-y-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-ink-600">
                  {sortedSessions.map((s) => (
                    <div key={s.id} className="relative">
                      <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-brand border-2 border-white dark:border-ink-900" />
                      <div className="surface-flat border p-4">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200 dark:border-ink-600">
                          <time className="text-[12px] font-bold text-brand flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {s.date}</time>
                          {canEdit && <button onClick={() => handleEditSession(selectedGroup, s)} className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted hover:text-brand">Edit</button>}
                        </div>

                        {s.notes && <p className="text-[13px] leading-relaxed whitespace-pre-wrap mb-3">{s.notes}</p>}

                        {s.decisions?.length > 0 && (
                          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-1.5"><Gavel className="w-3 h-3" /> Key decisions</p>
                            <ul className="space-y-1">
                              {s.decisions.map((d, i) => <li key={i} className="text-[12px] flex gap-2"><span className="text-amber-500">•</span> {d}</li>)}
                            </ul>
                          </div>
                        )}

                        {(s.checklist?.length ?? 0) > 0 && (
                          <div className="mb-3 space-y-1">
                            {s.checklist!.map((c) => (
                              <div key={c.id} className="text-[12px] flex items-center gap-2 bg-neutral-50 dark:bg-ink-800/50 px-2 py-1">
                                {c.done ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 border border-neutral-400" />}
                                <span className={c.done ? 'line-through opacity-60' : ''}>{c.text}</span>
                                {c.isUrgent && <Siren className="w-3.5 h-3.5 text-red-500 ml-auto" />}
                              </div>
                            ))}
                          </div>
                        )}

                        {(s.actionItems?.length ?? 0) > 0 && (
                          <div className="bg-neutral-50 dark:bg-ink-800/50 border border-neutral-200 dark:border-ink-600 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted flex items-center gap-1 mb-2"><CheckSquare className="w-3 h-3" /> Actions</p>
                            {renderActionList(s.actionItems!)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Folder className="w-16 h-16 mb-3 opacity-10" />
            <p className="text-sm">Select a working group.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── action list (view mode, optional category grouping) ──────────────
  function renderActionList(items: WGActionItem[]) {
    const line = (a: WGActionItem) => {
      const isExternal = a.ownerId && !state.users.some((u) => u.id === a.ownerId);
      const owner = userName(a.ownerId) ?? a.ownerId;
      return (
        <li key={a.id} className="flex items-start gap-2 border border-neutral-200 dark:border-ink-600 p-2 bg-white dark:bg-ink-800">
          <div className="flex flex-col items-center gap-1">
            <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase w-16 text-center ${statusColor(a.status)}`}>{STATUS_LABEL[a.status]}</span>
            {a.priority && a.priority !== 'medium' && <Flag className={`w-3 h-3 ${priorityColor(a.priority)}`} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {!groupByCategory && a.category && <span className="text-[8px] font-bold uppercase tracking-wide bg-neutral-100 dark:bg-ink-700 text-muted px-1.5">{a.category}</span>}
              <span className={`text-[12px] font-medium truncate ${a.status === 'done' ? 'line-through opacity-60' : ''}`}>{a.text}</span>
            </div>
            <div className="flex gap-2 mt-1 items-center text-[10px] text-muted">
              {a.ownerId && <span className={`px-1.5 py-0.5 ${isExternal ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-neutral-100 dark:bg-ink-700'}`}>{isExternal ? <UserPlus className="w-2.5 h-2.5 inline mr-1" /> : '@'}{owner}</span>}
              {a.dueDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.dueDate}</span>}
            </div>
          </div>
        </li>
      );
    };
    if (groupByCategory) {
      const grouped: Record<string, WGActionItem[]> = {};
      items.forEach((a) => { const c = a.category || 'General'; (grouped[c] ||= []).push(a); });
      return (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, listItems]) => (
            <div key={cat}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-brand border-b border-brand/20 pb-0.5 mb-1.5">{cat}</p>
              <ul className="space-y-1.5">{listItems.map(line)}</ul>
            </div>
          ))}
        </div>
      );
    }
    return <ul className="space-y-1.5">{items.map(line)}</ul>;
  }

  // ── group config modal ───────────────────────────────────────────────
  function renderGroupModal() {
    if (!editingGroup) return null;
    const g = editingGroup;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="surface border w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black uppercase tracking-tight">Configure group</h3>
            <button onClick={() => setEditingGroup(null)} className="w-8 h-8 flex items-center justify-center hover:text-brand"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Title</label>
              <input value={g.name} onChange={(e) => setEditingGroup({ ...g, name: e.target.value })}
                className="w-full h-9 px-3 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Linked project (optional)</label>
              <select value={g.projectId || ''} onChange={(e) => setEditingGroup({ ...g, projectId: e.target.value || undefined })}
                className="w-full h-9 px-3 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand">
                <option value="">— Standalone —</option>
                {state.projects.filter((p) => !p.isArchived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Members (can edit)</label>
              <div className="max-h-40 overflow-y-auto border border-neutral-300 dark:border-ink-600 p-2 space-y-1">
                {state.users.map((u) => {
                  const on = g.members.some((m) => m.userId === u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 text-[12px] cursor-pointer py-0.5">
                      <input type="checkbox" checked={on} onChange={() => setEditingGroup({
                        ...g,
                        members: on ? g.members.filter((m) => m.userId !== u.id) : [...g.members, { userId: u.id, role: 'contributor' }],
                      })} />
                      {u.firstName} {u.lastName}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setEditingGroup(null)} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-muted hover:border-neutral-400">Cancel</button>
            <button onClick={saveGroup} className="px-5 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90">Save</button>
          </div>
        </div>
      </div>
    );
  }

  // ── session editor modal (4 tabs) ─────────────────────────────────────
  function renderSessionModal() {
    if (!editingSession) return null;
    const s = editingSession.session;
    const tab = (id: typeof activeTab, label: string) => (
      <button onClick={() => setActiveTab(id)}
        className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-[0.12em] border-b-2 transition-colors ${activeTab === id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-neutral-700 dark:hover:text-neutral-300'}`}>
        {label}
      </button>
    );
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="surface border w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between surface-flat">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Edit session</h3>
              <input type="date" value={s.date} onChange={(e) => patchSession({ date: e.target.value })}
                className="bg-transparent text-[12px] text-muted font-medium focus:outline-none mt-0.5" />
            </div>
            <button onClick={() => setEditingSession(null)} className="w-9 h-9 flex items-center justify-center hover:text-brand"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex border-b border-neutral-200 dark:border-ink-600">
            {tab('notes', 'Notes')}
            {tab('decisions', `Decisions (${s.decisions?.length ?? 0})`)}
            {tab('actions', `Actions (${s.actionItems?.length ?? 0})`)}
            {tab('checklist', `Checklist (${s.checklist?.length ?? 0})`)}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'notes' && (
              <textarea value={s.notes} onChange={(e) => patchSession({ notes: e.target.value })}
                placeholder="Meeting minutes — key points, context, discussion…"
                className="w-full h-full min-h-[300px] p-4 text-[13px] leading-relaxed border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand resize-none" />
            )}

            {activeTab === 'decisions' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={newDecisionText} onChange={(e) => setNewDecisionText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDecision()}
                    placeholder="Record a key decision…" className="flex-1 h-9 px-3 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
                  <button onClick={addDecision} className="px-4 text-[10px] font-bold uppercase tracking-[0.12em] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Add</button>
                </div>
                {(s.decisions ?? []).map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <Gavel className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="flex-1 text-[12px]">{d}</span>
                    <button onClick={() => deleteDecision(i)} className="text-muted hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {(s.decisions?.length ?? 0) === 0 && <p className="text-center text-[12px] text-muted italic py-8">No decisions recorded.</p>}
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-3">
                <button onClick={() => openActionModal(-1)} className="w-full py-2 border-2 border-dashed border-brand/40 text-brand text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-brand/5 flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add action</button>
                {(s.actionItems ?? []).map((a, idx) => {
                  const isExternal = a.ownerId && !state.users.some((u) => u.id === a.ownerId);
                  return (
                    <div key={a.id} onClick={() => openActionModal(idx, a)} className="border border-neutral-200 dark:border-ink-600 p-3 bg-white dark:bg-ink-800 hover:border-brand transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase ${statusColor(a.status)}`}>{STATUS_LABEL[a.status]}</span>
                            {a.priority === 'urgent' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                            <span className="text-[12px] font-medium truncate">{a.text || <span className="italic text-muted">Untitled</span>}</span>
                          </div>
                          <div className="flex gap-2 items-center text-[10px] text-muted">
                            <span className={isExternal ? 'text-amber-600 dark:text-amber-400' : ''}><UserPlus className="w-3 h-3 inline mr-1" />{userName(a.ownerId) ?? a.ownerId ?? 'Unassigned'}</span>
                            {a.dueDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.dueDate}</span>}
                            {a.category && <span className="bg-neutral-100 dark:bg-ink-700 px-1.5">{a.category}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); deleteAction(idx); }} className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                          <Edit2 className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(s.actionItems?.length ?? 0) === 0 && <p className="text-center text-[12px] text-muted italic py-4">No actions defined.</p>}
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="space-y-2">
                <button onClick={addChecklist} className="w-full py-2 border-2 border-dashed border-brand/40 text-brand text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-brand/5 flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add item</button>
                {(s.checklist ?? []).map((c, idx) => (
                  <div key={c.id} className="flex items-start gap-3 border border-neutral-200 dark:border-ink-600 p-3 bg-white dark:bg-ink-800">
                    <input type="checkbox" checked={c.done} onChange={(e) => updateChecklist(idx, 'done', e.target.checked)} className="w-4 h-4 mt-1" />
                    <div className="flex-1 space-y-1">
                      <input value={c.text} onChange={(e) => updateChecklist(idx, 'text', e.target.value)} placeholder="Item…"
                        className={`w-full bg-transparent text-[12px] focus:outline-none ${c.done ? 'line-through text-muted' : ''}`} />
                      <input value={c.comment ?? ''} onChange={(e) => updateChecklist(idx, 'comment', e.target.value)} placeholder="Note…"
                        className="w-full bg-transparent text-[10px] italic text-muted focus:outline-none" />
                    </div>
                    <button onClick={() => updateChecklist(idx, 'isUrgent', !c.isUrgent)} title="Toggle urgent"
                      className={`p-1.5 ${c.isUrgent ? 'text-red-500 bg-red-100 dark:bg-red-900/30' : 'text-muted hover:bg-neutral-100 dark:hover:bg-ink-700'}`}><Siren className="w-4 h-4" /></button>
                    <button onClick={() => deleteChecklist(idx)} className="text-muted hover:text-red-500 pt-1.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between surface-flat">
            <button onClick={deleteSession} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
            <div className="flex gap-2">
              <button onClick={() => setEditingSession(null)} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-muted hover:border-neutral-400">Cancel</button>
              <button onClick={saveSession} className="px-5 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90">Save session</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── action editor modal ───────────────────────────────────────────────
  function renderActionModal() {
    if (!actionInEdit) return null;
    const a = actionInEdit.action;
    const isExternal = a.ownerId && !state.users.some((u) => u.id === a.ownerId);
    const cats = groupCategories(selectedGroup);
    const setA = (patch: Partial<WGActionItem>) => setActionInEdit({ ...actionInEdit, action: { ...a, ...patch } });
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="surface border w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-neutral-200 dark:border-ink-600">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><CheckSquare className="w-5 h-5 text-brand" /> {actionInEdit.index === -1 ? 'New action' : 'Edit action'}</h3>
            <button onClick={() => setActionInEdit(null)} className="hover:text-brand"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Description</label>
              <textarea value={a.text} onChange={(e) => setA({ text: e.target.value })} rows={3} placeholder="What needs to be done?"
                className="w-full p-3 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Status</label>
                <select value={a.status} onChange={(e) => setA({ status: e.target.value as WGActionStatus })}
                  className="w-full h-9 px-2 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand">
                  {(Object.keys(STATUS_LABEL) as WGActionStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Priority</label>
                <select value={a.priority || 'medium'} onChange={(e) => setA({ priority: e.target.value as WGTaskPriority })}
                  className="w-full h-9 px-2 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand">
                  {(['low', 'medium', 'high', 'urgent'] as WGTaskPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Assignee</label>
              <select value={isExternal ? 'EXTERNAL' : (a.ownerId || '')} onChange={(e) => setA({ ownerId: e.target.value === 'EXTERNAL' ? 'External person' : e.target.value })}
                className="w-full h-9 px-2 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand mb-2">
                <option value="">— Unassigned —</option>
                {state.users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                <option value="EXTERNAL">— External person —</option>
              </select>
              {isExternal && (
                <input value={a.ownerId} onChange={(e) => setA({ ownerId: e.target.value })} placeholder="External name…" autoFocus
                  className="w-full h-9 px-3 text-[12px] border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 focus:outline-none" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Category</label>
                <input list="wg-cats" value={a.category || ''} onChange={(e) => setA({ category: e.target.value })} placeholder="e.g. Legal"
                  className="w-full h-9 px-3 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
                <datalist id="wg-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">Due date</label>
                <input type="date" value={a.dueDate || ''} onChange={(e) => setA({ dueDate: e.target.value })}
                  className="w-full h-9 px-3 text-[12px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setActionInEdit(null)} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-muted hover:border-neutral-400">Cancel</button>
            <button onClick={saveActionFromModal} className="px-5 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90">Save action</button>
          </div>
        </div>
      </div>
    );
  }

  // ── AI report modal ────────────────────────────────────────────────────
  function renderAiModal() {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="surface border w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between bg-brand text-white">
            <h3 className="text-[13px] font-black uppercase tracking-tight flex items-center gap-2"><Bot className="w-5 h-5" /> {aiTitle}</h3>
            <button onClick={() => setAiOpen(false)} className="hover:opacity-70"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-ink-950">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-brand mb-3" />
                <p className="text-[11px] uppercase tracking-[0.16em]">Analysing sessions with the local LLM…</p>
              </div>
            ) : (
              <div id="wg-report-render" className="surface border p-6 md:p-8 text-[13px] leading-relaxed"><MarkdownView content={aiContent} /></div>
            )}
          </div>
          <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2">
            <button onClick={printReport} disabled={aiLoading || !aiContent} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 disabled:opacity-40"><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
            <button onClick={() => { navigator.clipboard?.writeText(aiContent); setAiCopied(true); setTimeout(() => setAiCopied(false), 1500); }} disabled={aiLoading || !aiContent} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand disabled:opacity-40">{aiCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} {aiCopied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      </div>
    );
  }
};
