import React, { useState, useMemo, useRef } from 'react';
import {
  Plus, X, ChevronRight, Network, Users, CheckSquare,
  Calendar, Edit2, Trash2, Tag, Flag, User as UserIcon,
  ChevronDown, MessageSquare, Target, MoreHorizontal,
  ArrowLeft, Check, Clock, AlertCircle, GripVertical,
  RefreshCw, Circle, PlayCircle, PauseCircle, CheckCircle2,
} from 'lucide-react';
import {
  AppState, User, WorkingGroup, WGTask, WGMeetingNote,
  WGStatus, WGMemberRole, WGTaskStatus, WGTaskPriority,
  WGActionItem, WGActionStatus, ChecklistItem,
} from '../../types';
import { generateId } from '../../services/storage';

/* ─────────────────────────────────────── helpers ── */

const STATUS_COLOR: Record<WGStatus, string> = {
  active: 'bg-emerald-500',
  paused: 'bg-amber-500',
  closed: 'bg-neutral-400',
};

const STATUS_LABEL: Record<WGStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
};

const TASK_COL: { id: WGTaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'doing', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

const TASK_COL_STYLE: Record<WGTaskStatus, string> = {
  todo: 'border-neutral-300 dark:border-ink-600',
  doing: 'border-blue-400',
  review: 'border-amber-400',
  done: 'border-emerald-500',
};

const PRIORITY_COLOR: Record<WGTaskPriority, string> = {
  low: 'text-neutral-400',
  medium: 'text-blue-400',
  high: 'text-amber-500',
  urgent: 'text-red-500',
};

const PRIORITY_LABEL: Record<WGTaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const MEMBER_ROLE_LABEL: Record<WGMemberRole, string> = {
  lead: 'Lead',
  contributor: 'Contributor',
  observer: 'Observer',
};

const now = () => new Date().toISOString();

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/* ─────────────────────────────────────── Avatar ── */
const Avatar: React.FC<{ name: string; color?: string; size?: number }> = ({
  name, color = '#FF3E00', size = 7,
}) => (
  <div
    className={`w-${size} h-${size} flex items-center justify-center text-[9px] font-bold uppercase text-white rounded-none shrink-0`}
    style={{ backgroundColor: color, width: `${size * 4}px`, height: `${size * 4}px` }}
  >
    {name.slice(0, 2)}
  </div>
);

/* ─────────────────────────────────────── Props ── */
interface ViewProps {
  state: AppState;
  currentUser: User;
  update: (fn: (s: AppState) => AppState) => void;
}

/* ══════════════════════════════════════════════════
   TASK MODAL — full editor for a WGTask
══════════════════════════════════════════════════ */
const TaskModal: React.FC<{
  task: WGTask | null;
  wgId: string;
  users: User[];
  wgMembers: string[];
  onClose: () => void;
  onSave: (task: WGTask) => void;
  onDelete?: () => void;
}> = ({ task, wgId: _wgId, users, wgMembers, onClose, onSave, onDelete }) => {
  const isNew = !task;
  const [title, setTitle] = useState(task?.title ?? '');
  const [desc, setDesc] = useState(task?.description ?? '');
  const [status, setStatus] = useState<WGTaskStatus>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<WGTaskPriority>(task?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [labels, setLabels] = useState<string[]>(task?.labels ?? []);
  const [labelInput, setLabelInput] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [checkInput, setCheckInput] = useState('');

  const assignableUsers = users.filter((u) => wgMembers.includes(u.id));

  const addLabel = () => {
    const v = labelInput.trim();
    if (v && !labels.includes(v)) setLabels([...labels, v]);
    setLabelInput('');
  };

  const addCheckItem = () => {
    const v = checkInput.trim();
    if (!v) return;
    setChecklist([...checklist, { id: generateId(), text: v, done: false }]);
    setCheckInput('');
  };

  const toggleCheck = (id: string) =>
    setChecklist(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));

  const removeCheck = (id: string) =>
    setChecklist(checklist.filter((c) => c.id !== id));

  const handleSave = () => {
    if (!title.trim()) return;
    const t: WGTask = {
      id: task?.id ?? generateId(),
      title: title.trim(),
      description: desc.trim(),
      status,
      priority,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
      labels,
      checklist,
      createdAt: task?.createdAt ?? now(),
      updatedAt: now(),
    };
    onSave(t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-900 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-ink-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">
            {isNew ? 'New Task' : 'Edit Task'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-neutral-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Title *</label>
            <input
              className="w-full input-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Description</label>
            <textarea
              className="w-full input-base resize-none"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Details, context, acceptance criteria..."
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Status</label>
              <select className="w-full input-base" value={status} onChange={(e) => setStatus(e.target.value as WGTaskStatus)}>
                {TASK_COL.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Priority</label>
              <select className="w-full input-base" value={priority} onChange={(e) => setPriority(e.target.value as WGTaskPriority)}>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Assignee + Due date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Assignee</label>
              <select className="w-full input-base" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Due Date</label>
              <input type="date" className="w-full input-base" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Labels</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {labels.map((l) => (
                <span key={l} className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] bg-brand/10 text-brand border border-brand/30">
                  {l}
                  <button onClick={() => setLabels(labels.filter((x) => x !== l))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 input-base"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                placeholder="Add label…"
              />
              <button onClick={addLabel} className="btn-secondary text-[10px]">Add</button>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
              Checklist ({checklist.filter((c) => c.done).length}/{checklist.length})
            </label>
            <div className="space-y-1 mb-2">
              {checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <button onClick={() => toggleCheck(c.id)} className={`w-4 h-4 border flex items-center justify-center shrink-0 ${c.done ? 'bg-brand border-brand text-white' : 'border-neutral-300 dark:border-ink-500'}`}>
                    {c.done && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className={`flex-1 text-[11px] ${c.done ? 'line-through text-muted' : ''}`}>{c.text}</span>
                  <button onClick={() => removeCheck(c.id)} className="text-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 input-base"
                value={checkInput}
                onChange={(e) => setCheckInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheckItem())}
                placeholder="Add checklist item…"
              />
              <button onClick={addCheckItem} className="btn-secondary text-[10px]">Add</button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-ink-700">
          <div>
            {!isNew && onDelete && (
              <button onClick={onDelete} className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500 hover:text-red-700">
                Delete Task
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-[10px]">Cancel</button>
            <button onClick={handleSave} disabled={!title.trim()} className="btn-primary text-[10px]">
              {isNew ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   SESSION EDITOR — chained meeting sessions
══════════════════════════════════════════════════ */

const ACTION_STATUS_CYCLE: WGActionStatus[] = ['todo', 'ongoing', 'blocked', 'done'];

const ACTION_STATUS_ICON: Record<WGActionStatus, React.ReactNode> = {
  todo: <Circle className="w-3.5 h-3.5 text-neutral-400" />,
  ongoing: <PlayCircle className="w-3.5 h-3.5 text-blue-500" />,
  blocked: <PauseCircle className="w-3.5 h-3.5 text-red-500" />,
  done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
};

const ACTION_STATUS_LABEL: Record<WGActionStatus, string> = {
  todo: 'To Do',
  ongoing: 'Ongoing',
  blocked: 'Blocked',
  done: 'Done',
};

const SessionEditor: React.FC<{
  session: WGMeetingNote | null;
  carriedItems: WGActionItem[];
  users: User[];
  wgMembers: string[];
  onClose: () => void;
  onSave: (m: WGMeetingNote) => void;
  onDelete?: () => void;
}> = ({ session, carriedItems, users, wgMembers, onClose, onSave, onDelete }) => {
  const isNew = !session;
  const [date, setDate] = useState(session?.date ?? new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(session?.title ?? '');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(session?.attendeeIds ?? []);
  const [agenda, setAgenda] = useState(session?.agenda ?? '');
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [decisions, setDecisions] = useState<string[]>(session?.decisions ?? []);
  const [decisionInput, setDecisionInput] = useState('');
  // Pre-populate with carried items (for new session) or existing actionItems
  const [actionItems, setActionItems] = useState<WGActionItem[]>(
    session?.actionItems ?? carriedItems.map((a) => ({ ...a, id: generateId(), carriedFromSessionId: a.carriedFromSessionId ?? a.id }))
  );
  const [actionInput, setActionInput] = useState('');
  const [actionOwnerId, setActionOwnerId] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');

  const assignableUsers = users.filter((u) => wgMembers.includes(u.id));

  const toggleAttendee = (id: string) =>
    setAttendeeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const addDecision = () => {
    const v = decisionInput.trim();
    if (v) { setDecisions([...decisions, v]); setDecisionInput(''); }
  };

  const addAction = () => {
    const v = actionInput.trim();
    if (!v) return;
    const item: WGActionItem = {
      id: generateId(),
      text: v,
      ownerId: actionOwnerId || undefined,
      dueDate: actionDueDate || undefined,
      status: 'todo',
    };
    setActionItems([...actionItems, item]);
    setActionInput('');
    setActionOwnerId('');
    setActionDueDate('');
  };

  const cycleActionStatus = (id: string) => {
    setActionItems(actionItems.map((a) => {
      if (a.id !== id) return a;
      const idx = ACTION_STATUS_CYCLE.indexOf(a.status);
      return { ...a, status: ACTION_STATUS_CYCLE[(idx + 1) % ACTION_STATUS_CYCLE.length] };
    }));
  };

  const removeAction = (id: string) => setActionItems(actionItems.filter((a) => a.id !== id));

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: session?.id ?? generateId(),
      date,
      title: title.trim(),
      attendeeIds,
      agenda: agenda.trim(),
      notes: notes.trim(),
      decisions,
      actionItems,
      createdAt: session?.createdAt ?? now(),
      updatedAt: now(),
    });
  };

  const carried = actionItems.filter((a) => a.carriedFromSessionId);
  const newActions = actionItems.filter((a) => !a.carriedFromSessionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-900 w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-neutral-200 dark:border-ink-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">{isNew ? 'New Session' : 'Edit Session'}</h2>
          <button onClick={onClose} className="text-muted hover:text-neutral-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Date + Title */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Date</label>
              <input type="date" className="w-full input-base" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Title *</label>
              <input className="w-full input-base" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" autoFocus />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Attendees</label>
            <div className="flex flex-wrap gap-2">
              {assignableUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => toggleAttendee(u.id)}
                  className={`px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] border transition-colors ${attendeeIds.includes(u.id) ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted'}`}
                >
                  {u.firstName} {u.lastName}
                </button>
              ))}
              {assignableUsers.length === 0 && <span className="text-[10px] text-muted">No members in group</span>}
            </div>
          </div>

          {/* Carried-over open actions */}
          {carried.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
                  Carried-over open actions ({carried.length})
                </p>
              </div>
              <div className="space-y-2">
                {carried.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <button
                      onClick={() => cycleActionStatus(a.id)}
                      title={`Status: ${ACTION_STATUS_LABEL[a.status]} — click to advance`}
                      className="shrink-0"
                    >
                      {ACTION_STATUS_ICON[a.status]}
                    </button>
                    <span className={`flex-1 text-[11px] ${a.status === 'done' ? 'line-through text-muted' : ''}`}>{a.text}</span>
                    {a.ownerId && (
                      <span className="text-[9px] text-muted">
                        {(() => { const u = users.find((x) => x.id === a.ownerId); return u ? u.firstName : ''; })()}
                      </span>
                    )}
                    <button onClick={() => removeAction(a.id)} className="text-muted hover:text-red-500 shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agenda + Notes */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Agenda</label>
            <textarea className="w-full input-base resize-none" rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Topics to cover…" />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Notes</label>
            <textarea className="w-full input-base resize-none" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session notes, context, discussions…" />
          </div>

          {/* Decisions */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Key Decisions</label>
            <div className="space-y-1 mb-2">
              {decisions.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 shrink-0">•</span>
                  <span className="flex-1 text-[11px]">{d}</span>
                  <button onClick={() => setDecisions(decisions.filter((_, j) => j !== i))} className="text-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 input-base"
                value={decisionInput}
                onChange={(e) => setDecisionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDecision())}
                placeholder="Add decision…"
              />
              <button onClick={addDecision} className="btn-secondary text-[10px]">Add</button>
            </div>
          </div>

          {/* New action items */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
              Action Items — This Session ({newActions.length})
            </label>
            <div className="space-y-1 mb-3">
              {newActions.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1 border-b border-neutral-100 dark:border-ink-800">
                  <button onClick={() => cycleActionStatus(a.id)} title={ACTION_STATUS_LABEL[a.status]} className="shrink-0">
                    {ACTION_STATUS_ICON[a.status]}
                  </button>
                  <span className={`flex-1 text-[11px] ${a.status === 'done' ? 'line-through text-muted' : ''}`}>{a.text}</span>
                  {a.ownerId && (
                    <span className="text-[9px] text-muted">
                      {(() => { const u = users.find((x) => x.id === a.ownerId); return u ? u.firstName : ''; })()}
                    </span>
                  )}
                  {a.dueDate && <span className="text-[9px] font-mono text-muted">{a.dueDate.slice(5)}</span>}
                  <button onClick={() => removeAction(a.id)} className="text-muted hover:text-red-500 shrink-0"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                className="col-span-3 input-base"
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAction())}
                placeholder="New action item…"
              />
              <select className="input-base text-[10px]" value={actionOwnerId} onChange={(e) => setActionOwnerId(e.target.value)}>
                <option value="">Owner…</option>
                {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
              <input type="date" className="input-base text-[10px]" value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} />
              <button onClick={addAction} className="btn-secondary text-[10px]">Add</button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-ink-700">
          <div>
            {!isNew && onDelete && (
              <button onClick={onDelete} className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500 hover:text-red-700">Delete Session</button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-[10px]">Cancel</button>
            <button onClick={handleSave} disabled={!title.trim()} className="btn-primary text-[10px]">
              {isNew ? 'Log Session' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   WG EDITOR MODAL — create / edit a Working Group
══════════════════════════════════════════════════ */
const WGEditor: React.FC<{
  wg: WorkingGroup | null;
  users: User[];
  onClose: () => void;
  onSave: (wg: WorkingGroup) => void;
  onDelete?: () => void;
}> = ({ wg, users, onClose, onSave, onDelete }) => {
  const isNew = !wg;
  const [name, setName] = useState(wg?.name ?? '');
  const [description, setDescription] = useState(wg?.description ?? '');
  const [objective, setObjective] = useState(wg?.objective ?? '');
  const [status, setStatus] = useState<WGStatus>(wg?.status ?? 'active');
  const [ownerId, setOwnerId] = useState(wg?.ownerId ?? '');
  const [members, setMembers] = useState<{ userId: string; role: WGMemberRole }[]>(wg?.members ?? []);
  const [tags, setTags] = useState<string[]>(wg?.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  const addMember = (userId: string) => {
    if (!members.find((m) => m.userId === userId))
      setMembers([...members, { userId, role: 'contributor' }]);
  };

  const removeMember = (userId: string) => setMembers(members.filter((m) => m.userId !== userId));

  const setMemberRole = (userId: string, role: WGMemberRole) =>
    setMembers(members.map((m) => (m.userId === userId ? { ...m, role } : m)));

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: wg?.id ?? generateId(),
      name: name.trim(),
      description: description.trim(),
      objective: objective.trim(),
      status,
      ownerId: ownerId || undefined,
      members,
      tasks: wg?.tasks ?? [],
      meetings: wg?.meetings ?? [],
      tags,
      createdAt: wg?.createdAt ?? now(),
      updatedAt: now(),
    });
  };

  const nonMembers = users.filter((u) => !members.find((m) => m.userId === u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-900 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-ink-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">
            {isNew ? 'New Working Group' : 'Edit Working Group'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-neutral-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Name *</label>
            <input className="w-full input-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" autoFocus />
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Objective</label>
            <input className="w-full input-base" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Core mission of this group…" />
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Description</label>
            <textarea className="w-full input-base resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional context…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Status</label>
              <select className="w-full input-base" value={status} onChange={(e) => setStatus(e.target.value as WGStatus)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Owner</label>
              <select className="w-full input-base" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— None —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
          </div>

          {/* Members */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Members</label>
            {members.length > 0 && (
              <div className="space-y-1 mb-2">
                {members.map((m) => {
                  const u = users.find((x) => x.id === m.userId);
                  if (!u) return null;
                  return (
                    <div key={m.userId} className="flex items-center gap-2 py-1 border-b border-neutral-100 dark:border-ink-800">
                      <span className="flex-1 text-[11px] font-bold">{u.firstName} {u.lastName}</span>
                      <select
                        className="text-[9px] uppercase tracking-[0.1em] border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-800 px-1 py-0.5"
                        value={m.role}
                        onChange={(e) => setMemberRole(m.userId, e.target.value as WGMemberRole)}
                      >
                        <option value="lead">Lead</option>
                        <option value="contributor">Contributor</option>
                        <option value="observer">Observer</option>
                      </select>
                      <button onClick={() => removeMember(m.userId)} className="text-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {nonMembers.length > 0 && (
              <select className="w-full input-base" value="" onChange={(e) => e.target.value && addMember(e.target.value)}>
                <option value="">+ Add member…</option>
                {nonMembers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold bg-neutral-100 dark:bg-ink-700 text-muted">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 input-base"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag…"
              />
              <button onClick={addTag} className="btn-secondary text-[10px]">Add</button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-ink-700">
          <div>
            {!isNew && onDelete && (
              <button onClick={onDelete} className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500 hover:text-red-700">Delete Group</button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-[10px]">Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} className="btn-primary text-[10px]">
              {isNew ? 'Create Group' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   TASKS KANBAN TAB
══════════════════════════════════════════════════ */
const TasksTab: React.FC<{
  wg: WorkingGroup;
  users: User[];
  canManage: boolean;
  onUpdateTasks: (tasks: WGTask[]) => void;
}> = ({ wg, users, canManage, onUpdateTasks }) => {
  const [editingTask, setEditingTask] = useState<WGTask | null | 'new'>(null);
  const [newInCol, setNewInCol] = useState<WGTaskStatus | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<WGTaskStatus | null>(null);

  const tasksByCol = useMemo(() => {
    const map: Record<WGTaskStatus, WGTask[]> = { todo: [], doing: [], review: [], done: [] };
    wg.tasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [wg.tasks]);

  const saveTask = (task: WGTask) => {
    const exists = wg.tasks.find((t) => t.id === task.id);
    const next = exists ? wg.tasks.map((t) => (t.id === task.id ? task : t)) : [...wg.tasks, task];
    onUpdateTasks(next);
    setEditingTask(null);
  };

  const deleteTask = (id: string) => {
    onUpdateTasks(wg.tasks.filter((t) => t.id !== id));
    setEditingTask(null);
  };

  const quickAdd = (col: WGTaskStatus) => {
    const t = quickTitle.trim();
    if (!t) { setNewInCol(null); return; }
    const task: WGTask = {
      id: generateId(),
      title: t,
      description: '',
      status: col,
      priority: 'medium',
      labels: [],
      checklist: [],
      createdAt: now(),
      updatedAt: now(),
    };
    onUpdateTasks([...wg.tasks, task]);
    setQuickTitle('');
    setNewInCol(null);
  };

  const onDragStart = (id: string) => setDragId(id);
  const onDragEnd = () => { setDragId(null); setDragOver(null); };
  const onDrop = (col: WGTaskStatus) => {
    if (!dragId) return;
    onUpdateTasks(wg.tasks.map((t) => t.id === dragId ? { ...t, status: col, updatedAt: now() } : t));
    setDragId(null);
    setDragOver(null);
  };

  const assigneeName = (id?: string) => {
    if (!id) return null;
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName[0]}.` : null;
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {TASK_COL.map((col) => {
        const colTasks = tasksByCol[col.id];
        const isOver = dragOver === col.id;
        return (
          <div
            key={col.id}
            className={`flex flex-col flex-shrink-0 w-64 ${isOver ? 'opacity-80' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop(col.id)}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 border-b-2 ${TASK_COL_STYLE[col.id]} mb-3`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{col.label}</span>
                <span className="text-[9px] font-mono text-muted bg-neutral-100 dark:bg-ink-700 px-1.5 py-0.5 rounded-none">
                  {colTasks.length}
                </span>
              </div>
              {canManage && (
                <button
                  onClick={() => { setNewInCol(col.id); setQuickTitle(''); }}
                  className="text-muted hover:text-brand transition-colors"
                  title="Add task"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick-add input */}
            {newInCol === col.id && (
              <div className="mb-2 p-2 border border-brand/40 bg-brand/5">
                <input
                  autoFocus
                  className="w-full bg-transparent text-[11px] font-medium outline-none placeholder:text-muted"
                  placeholder="Task title…"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); quickAdd(col.id); }
                    if (e.key === 'Escape') { setNewInCol(null); setQuickTitle(''); }
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => quickAdd(col.id)} className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">Add</button>
                  <button onClick={() => { setNewInCol(null); setQuickTitle(''); setEditingTask('new'); }} className="text-[9px] text-muted uppercase tracking-[0.14em]">Full form</button>
                  <button onClick={() => { setNewInCol(null); setQuickTitle(''); }} className="text-[9px] text-muted uppercase tracking-[0.14em] ml-auto">Cancel</button>
                </div>
              </div>
            )}

            {/* Task cards */}
            <div className="space-y-2 flex-1">
              {colTasks.map((task) => {
                const done = task.checklist?.filter((c) => c.done).length ?? 0;
                const total = task.checklist?.length ?? 0;
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
                return (
                  <div
                    key={task.id}
                    draggable={canManage}
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                    className={`group bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 p-3 cursor-pointer hover:border-brand/50 transition-all ${dragId === task.id ? 'opacity-50' : ''}`}
                    onClick={() => setEditingTask(task)}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold leading-tight flex-1">{task.title}</span>
                      {canManage && (
                        <GripVertical className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {task.description && (
                      <p className="text-[10px] text-muted line-clamp-2 mb-2">{task.description}</p>
                    )}

                    {task.labels && task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {task.labels.map((l) => (
                          <span key={l} className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-brand/10 text-brand">{l}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase ${PRIORITY_COLOR[task.priority]}`}>
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                        {total > 0 && (
                          <span className="text-[9px] text-muted font-mono">{done}/{total}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <AlertCircle className="w-3 h-3 text-red-500" />}
                        {task.dueDate && (
                          <span className={`text-[9px] font-mono ${isOverdue ? 'text-red-500' : 'text-muted'}`}>
                            {task.dueDate.slice(5)}
                          </span>
                        )}
                        {task.assigneeId && (
                          <span className="text-[9px] text-muted">{assigneeName(task.assigneeId)}</span>
                        )}
                      </div>
                    </div>

                    {total > 0 && (
                      <div className="mt-2 h-0.5 bg-neutral-100 dark:bg-ink-700 w-full">
                        <div className="h-full bg-brand transition-all" style={{ width: `${(done / total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}

              {colTasks.length === 0 && newInCol !== col.id && (
                <div className={`border-2 border-dashed flex items-center justify-center h-16 text-[9px] text-muted uppercase tracking-[0.14em] transition-colors ${isOver ? 'border-brand/50 bg-brand/5' : 'border-neutral-200 dark:border-ink-700'}`}>
                  {isOver ? 'Drop here' : 'Empty'}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Task editor modal */}
      {editingTask !== null && (
        <TaskModal
          task={editingTask === 'new' ? null : editingTask}
          wgId={wg.id}
          users={users}
          wgMembers={wg.members.map((m) => m.userId)}
          onClose={() => setEditingTask(null)}
          onSave={saveTask}
          onDelete={editingTask !== 'new' ? () => deleteTask((editingTask as WGTask).id) : undefined}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MEETINGS TAB — session-chaining view
══════════════════════════════════════════════════ */
const MeetingsTab: React.FC<{
  wg: WorkingGroup;
  users: User[];
  canManage: boolean;
  onUpdateMeetings: (meetings: WGMeetingNote[]) => void;
}> = ({ wg, users, canManage, onUpdateMeetings }) => {
  const [editing, setEditing] = useState<WGMeetingNote | null | 'new'>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...wg.meetings].sort((a, b) => b.date.localeCompare(a.date));

  // All action items from all sessions that are not done — used as carry-over for new sessions
  const openCarriedItems: WGActionItem[] = wg.meetings.flatMap((m) =>
    (m.actionItems ?? []).filter((a) => a.status !== 'done').map((a) => ({
      ...a,
      carriedFromSessionId: a.carriedFromSessionId ?? m.id,
    }))
  );

  const saveSession = (m: WGMeetingNote) => {
    const exists = wg.meetings.find((x) => x.id === m.id);
    const next = exists ? wg.meetings.map((x) => (x.id === m.id ? m : x)) : [...wg.meetings, m];
    onUpdateMeetings(next);
    setEditing(null);
  };

  const deleteSession = (id: string) => {
    onUpdateMeetings(wg.meetings.filter((m) => m.id !== id));
    setEditing(null);
  };

  const userName = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id;
  };

  const sessionOpenCount = (m: WGMeetingNote) =>
    (m.actionItems ?? []).filter((a) => a.status !== 'done').length;

  return (
    <div>
      {canManage && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] text-muted uppercase tracking-[0.14em]">
            {sorted.length} session{sorted.length !== 1 ? 's' : ''}
            {openCarriedItems.length > 0 && (
              <span className="ml-2 text-amber-600 font-bold">{openCarriedItems.length} open action{openCarriedItems.length !== 1 ? 's' : ''} across sessions</span>
            )}
          </p>
          <button onClick={() => setEditing('new')} className="btn-primary text-[10px] flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> New Session
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-[11px] uppercase tracking-[0.14em]">No sessions logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((m, idx) => {
            const isExpanded = expanded === m.id;
            const openCount = sessionOpenCount(m);
            const carriedCount = (m.actionItems ?? []).filter((a) => a.carriedFromSessionId).length;
            const isMostRecent = idx === 0;
            return (
              <div key={m.id} className={`border bg-white dark:bg-ink-900 ${isMostRecent ? 'border-brand/40' : 'border-neutral-200 dark:border-ink-700'}`}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-ink-800 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : m.id)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    {isMostRecent && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-brand text-white">Latest</span>
                    )}
                    <span className="text-[9px] font-mono text-muted">{fmtDate(m.date)}</span>
                    <span className="text-[11px] font-bold">{m.title}</span>
                    <span className="text-[9px] text-muted">{m.attendeeIds.length} attendees</span>
                    {m.decisions.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-brand/10 text-brand">
                        {m.decisions.length} decision{m.decisions.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {openCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                        {openCount} open action{openCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {carriedCount > 0 && (
                      <span className="flex items-center gap-1 text-[8px] text-muted">
                        <RefreshCw className="w-2.5 h-2.5" /> {carriedCount} carried
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(m); }}
                        className="text-muted hover:text-brand"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-100 dark:border-ink-700 px-4 py-4 space-y-4">
                    {m.attendeeIds.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Attendees</p>
                        <p className="text-[11px]">{m.attendeeIds.map(userName).join(', ')}</p>
                      </div>
                    )}
                    {m.agenda && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Agenda</p>
                        <p className="text-[11px] text-muted whitespace-pre-wrap">{m.agenda}</p>
                      </div>
                    )}
                    {m.notes && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Notes</p>
                        <p className="text-[11px] whitespace-pre-wrap">{m.notes}</p>
                      </div>
                    )}
                    {m.decisions.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Key Decisions</p>
                        <ul className="space-y-0.5">
                          {m.decisions.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px]">
                              <span className="text-brand mt-0.5">•</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(m.actionItems ?? []).length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-2">Action Items</p>
                        {/* Carried-over section */}
                        {(m.actionItems ?? []).filter((a) => a.carriedFromSessionId).length > 0 && (
                          <div className="mb-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40 p-2 rounded">
                            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-amber-600 mb-1.5">
                              <RefreshCw className="w-2.5 h-2.5 inline mr-1" />Carried over
                            </p>
                            <div className="space-y-1">
                              {(m.actionItems ?? []).filter((a) => a.carriedFromSessionId).map((a) => (
                                <div key={a.id} className="flex items-center gap-2">
                                  {ACTION_STATUS_ICON[a.status]}
                                  <span className={`flex-1 text-[11px] ${a.status === 'done' ? 'line-through text-muted' : ''}`}>{a.text}</span>
                                  {a.ownerId && (
                                    <span className="text-[9px] text-muted">
                                      {(() => { const u = users.find((x) => x.id === a.ownerId); return u ? u.firstName : ''; })()}
                                    </span>
                                  )}
                                  {a.dueDate && <span className="text-[9px] font-mono text-muted">{a.dueDate.slice(5)}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* New actions from this session */}
                        <div className="space-y-1">
                          {(m.actionItems ?? []).filter((a) => !a.carriedFromSessionId).map((a) => (
                            <div key={a.id} className="flex items-center gap-2 py-0.5">
                              {ACTION_STATUS_ICON[a.status]}
                              <span className={`flex-1 text-[11px] ${a.status === 'done' ? 'line-through text-muted' : ''}`}>{a.text}</span>
                              {a.ownerId && (
                                <span className="text-[9px] text-muted">
                                  {(() => { const u = users.find((x) => x.id === a.ownerId); return u ? u.firstName : ''; })()}
                                </span>
                              )}
                              {a.dueDate && <span className="text-[9px] font-mono text-muted">{a.dueDate.slice(5)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <SessionEditor
          session={editing === 'new' ? null : editing}
          carriedItems={editing === 'new' ? openCarriedItems : []}
          users={users}
          wgMembers={wg.members.map((m) => m.userId)}
          onClose={() => setEditing(null)}
          onSave={saveSession}
          onDelete={editing !== 'new' ? () => deleteSession((editing as WGMeetingNote).id) : undefined}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════ */
const OverviewTab: React.FC<{
  wg: WorkingGroup;
  users: User[];
}> = ({ wg, users }) => {
  const totalTasks = wg.tasks.length;
  const doneTasks = wg.tasks.filter((t) => t.status === 'done').length;
  const inProgress = wg.tasks.filter((t) => t.status === 'doing').length;
  const blocked = wg.tasks.filter((t) => t.status === 'review').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Objective */}
      {wg.objective && (
        <div className="p-4 border border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Objective</p>
          <p className="text-[13px]">{wg.objective}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: totalTasks, color: 'text-neutral-900 dark:text-white' },
          { label: 'In Progress', value: inProgress, color: 'text-blue-500' },
          { label: 'In Review', value: blocked, color: 'text-amber-500' },
          { label: 'Done', value: doneTasks, color: 'text-emerald-500' },
        ].map((s) => (
          <div key={s.label} className="p-4 border border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div className="p-4 border border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Overall Progress</p>
            <span className="text-[11px] font-bold text-brand">{progress}%</span>
          </div>
          <div className="h-2 bg-neutral-100 dark:bg-ink-700 w-full">
            <div className="h-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Members */}
      <div className="p-4 border border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-3">Members ({wg.members.length})</p>
        {wg.members.length === 0 ? (
          <p className="text-[11px] text-muted">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {wg.members.map((m) => {
              const u = users.find((x) => x.id === m.userId);
              if (!u) return null;
              return (
                <div key={m.userId} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 flex items-center justify-center text-[9px] font-bold uppercase text-white shrink-0"
                    style={{ backgroundColor: u.avatarColor ?? '#FF3E00' }}
                  >
                    {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-[9px] text-muted uppercase tracking-[0.1em]">{u.functionTitle} — {u.team}</p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 ${m.role === 'lead' ? 'bg-brand/10 text-brand' : 'text-muted bg-neutral-100 dark:bg-ink-700'}`}>
                    {MEMBER_ROLE_LABEL[m.role]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tags */}
      {wg.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {wg.tags.map((t) => (
            <span key={t} className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] bg-neutral-100 dark:bg-ink-700 text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   WG DETAIL — hero + tabs
══════════════════════════════════════════════════ */
type WGTab = 'tasks' | 'meetings' | 'overview';

const WGDetail: React.FC<{
  wg: WorkingGroup;
  users: User[];
  canManage: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateTasks: (tasks: WGTask[]) => void;
  onUpdateMeetings: (meetings: WGMeetingNote[]) => void;
}> = ({ wg, users, canManage, onBack, onEdit, onDelete, onUpdateTasks, onUpdateMeetings }) => {
  const [tab, setTab] = useState<WGTab>('tasks');
  const owner = users.find((u) => u.id === wg.ownerId);
  const totalTasks = wg.tasks.length;
  const doneTasks = wg.tasks.filter((t) => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const TABS: { id: WGTab; label: string }[] = [
    { id: 'tasks', label: `Tasks (${totalTasks})` },
    { id: 'meetings', label: `Meetings (${wg.meetings.length})` },
    { id: 'overview', label: 'Overview' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="border border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-ink-700 flex items-center gap-3">
          <button onClick={onBack} className="text-muted hover:text-brand transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className={`w-2 h-2 rounded-full ${STATUS_COLOR[wg.status]}`} />
          <h1 className="text-lg font-bold flex-1 truncate">{wg.name}</h1>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
            {STATUS_LABEL[wg.status]}
          </span>
          {canManage && (
            <>
              <button onClick={onEdit} className="text-muted hover:text-brand transition-colors" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={onDelete} className="text-muted hover:text-red-500 transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <div className="px-6 py-4 grid grid-cols-3 gap-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Owner</p>
            <p className="text-[11px] font-bold">{owner ? `${owner.firstName} ${owner.lastName}` : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Members</p>
            <div className="flex items-center gap-1">
              {wg.members.slice(0, 5).map((m) => {
                const u = users.find((x) => x.id === m.userId);
                if (!u) return null;
                return (
                  <div
                    key={m.userId}
                    title={`${u.firstName} ${u.lastName}`}
                    className="w-6 h-6 flex items-center justify-center text-[8px] font-bold uppercase text-white"
                    style={{ backgroundColor: u.avatarColor ?? '#FF3E00' }}
                  >
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                );
              })}
              {wg.members.length > 5 && (
                <span className="text-[9px] text-muted ml-1">+{wg.members.length - 5}</span>
              )}
              {wg.members.length === 0 && <span className="text-[11px] text-muted">—</span>}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-1">Progress</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-ink-700">
                <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] font-bold text-brand">{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-ink-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'tasks' && (
        <TasksTab wg={wg} users={users} canManage={canManage} onUpdateTasks={onUpdateTasks} />
      )}
      {tab === 'meetings' && (
        <MeetingsTab wg={wg} users={users} canManage={canManage} onUpdateMeetings={onUpdateMeetings} />
      )}
      {tab === 'overview' && (
        <OverviewTab wg={wg} users={users} />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   WG CARD
══════════════════════════════════════════════════ */
const WGCard: React.FC<{
  wg: WorkingGroup;
  users: User[];
  onClick: () => void;
}> = ({ wg, users, onClick }) => {
  const totalTasks = wg.tasks.length;
  const doneTasks = wg.tasks.filter((t) => t.status === 'done').length;
  const inProgress = wg.tasks.filter((t) => t.status === 'doing' || t.status === 'review').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 hover:border-brand/50 hover:shadow-sm transition-all"
    >
      <div className={`h-1 w-full ${STATUS_COLOR[wg.status]}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[12px] font-bold group-hover:text-brand transition-colors leading-tight">{wg.name}</h3>
          <span className={`text-[8px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 shrink-0 ${
            wg.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
            wg.status === 'paused' ? 'bg-amber-500/10 text-amber-600' :
            'bg-neutral-100 text-muted'
          }`}>
            {STATUS_LABEL[wg.status]}
          </span>
        </div>

        {wg.objective && (
          <p className="text-[10px] text-muted line-clamp-2 mb-3">{wg.objective}</p>
        )}

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted">{doneTasks}/{totalTasks} tasks</span>
            {inProgress > 0 && <span className="text-[9px] text-blue-500">{inProgress} active</span>}
          </div>
          <div className="h-1 bg-neutral-100 dark:bg-ink-700 w-full">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Members + meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {wg.members.slice(0, 4).map((m) => {
              const u = users.find((x) => x.id === m.userId);
              if (!u) return null;
              return (
                <div
                  key={m.userId}
                  title={`${u.firstName} ${u.lastName}`}
                  className="w-5 h-5 flex items-center justify-center text-[7px] font-bold uppercase text-white"
                  style={{ backgroundColor: u.avatarColor ?? '#FF3E00' }}
                >
                  {u.firstName[0]}{u.lastName[0]}
                </div>
              );
            })}
            {wg.members.length > 4 && (
              <span className="text-[9px] text-muted ml-1">+{wg.members.length - 4}</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted">
            <ChevronRight className="w-3 h-3 group-hover:text-brand transition-colors" />
          </div>
        </div>

        {wg.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {wg.tags.slice(0, 3).map((t) => (
              <span key={t} className="px-1.5 py-0.5 text-[8px] uppercase bg-neutral-100 dark:bg-ink-700 text-muted">{t}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
};

/* ══════════════════════════════════════════════════
   MAIN VIEW
══════════════════════════════════════════════════ */
export const WorkingGroupsView: React.FC<ViewProps> = ({ state, currentUser, update }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<WGStatus | 'all'>('all');
  const [editorWg, setEditorWg] = useState<WorkingGroup | null | 'new'>(null);

  const canManage = currentUser.role === 'admin' || currentUser.role === 'manager';
  const wgs = state.workingGroups ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return wgs;
    return wgs.filter((wg) => wg.status === filter);
  }, [wgs, filter]);

  const selected = useMemo(() => wgs.find((wg) => wg.id === selectedId) ?? null, [wgs, selectedId]);

  const updateWGs = (fn: (wgs: WorkingGroup[]) => WorkingGroup[]) =>
    update((s) => ({ ...s, workingGroups: fn(s.workingGroups ?? []) }));

  const saveWG = (wg: WorkingGroup) => {
    updateWGs((prev) => {
      const exists = prev.find((x) => x.id === wg.id);
      return exists ? prev.map((x) => (x.id === wg.id ? wg : x)) : [...prev, wg];
    });
    setEditorWg(null);
    if (!selected) setSelectedId(wg.id);
  };

  const deleteWG = (id: string) => {
    updateWGs((prev) => prev.filter((x) => x.id !== id));
    setSelectedId(null);
  };

  const updateTasks = (wgId: string, tasks: WGTask[]) =>
    updateWGs((prev) => prev.map((x) => (x.id === wgId ? { ...x, tasks, updatedAt: now() } : x)));

  const updateMeetings = (wgId: string, meetings: WGMeetingNote[]) =>
    updateWGs((prev) => prev.map((x) => (x.id === wgId ? { ...x, meetings, updatedAt: now() } : x)));

  const FILTER_TABS: { id: WGStatus | 'all'; label: string }[] = [
    { id: 'all', label: `All (${wgs.length})` },
    { id: 'active', label: `Active (${wgs.filter((w) => w.status === 'active').length})` },
    { id: 'paused', label: `Paused (${wgs.filter((w) => w.status === 'paused').length})` },
    { id: 'closed', label: `Closed (${wgs.filter((w) => w.status === 'closed').length})` },
  ];

  /* ── Detail view ── */
  if (selected) {
    return (
      <div>
        <WGDetail
          wg={selected}
          users={state.users}
          canManage={canManage}
          onBack={() => setSelectedId(null)}
          onEdit={() => setEditorWg(selected)}
          onDelete={() => { if (confirm(`Delete "${selected.name}"?`)) deleteWG(selected.id); }}
          onUpdateTasks={(tasks) => updateTasks(selected.id, tasks)}
          onUpdateMeetings={(meetings) => updateMeetings(selected.id, meetings)}
        />

        {editorWg !== null && (
          <WGEditor
            wg={editorWg === 'new' ? null : editorWg}
            users={state.users}
            onClose={() => setEditorWg(null)}
            onSave={saveWG}
            onDelete={editorWg !== 'new' ? () => { deleteWG((editorWg as WorkingGroup).id); setEditorWg(null); } : undefined}
          />
        )}
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display-lg">Working Groups</h1>
          <p className="text-[11px] text-muted mt-1">Cross-functional groups, tasks and decisions</p>
        </div>
        {canManage && (
          <button onClick={() => setEditorWg('new')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Group
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 border-b border-neutral-200 dark:border-ink-700">
        {FILTER_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] border-b-2 transition-colors -mb-px ${
              filter === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <Network className="w-10 h-10 mx-auto mb-4 text-muted opacity-30" />
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-4">
            {filter === 'all' ? 'No working groups yet' : `No ${filter} groups`}
          </p>
          {canManage && filter === 'all' && (
            <button onClick={() => setEditorWg('new')} className="btn-primary text-[10px] flex items-center gap-2 mx-auto">
              <Plus className="w-3.5 h-3.5" /> Create First Group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((wg) => (
            <WGCard key={wg.id} wg={wg} users={state.users} onClick={() => setSelectedId(wg.id)} />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editorWg !== null && (
        <WGEditor
          wg={editorWg === 'new' ? null : editorWg}
          users={state.users}
          onClose={() => setEditorWg(null)}
          onSave={saveWG}
        />
      )}
    </div>
  );
};
