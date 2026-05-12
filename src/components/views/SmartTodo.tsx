import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Bot, Search, CheckCircle2, Circle, AlertCircle, PauseCircle, XCircle,
  Trash2, Edit3, X, Tag, Link, Clock, Zap, Calendar, Repeat, Flag,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Paperclip, Brain, LayoutGrid, List,
  Filter, ArrowUp, ArrowRight, ArrowDown, Minus, Archive, ArchiveRestore, Sparkles, Shield,
  Download, CalendarClock, Mail
} from 'lucide-react';
import {
  SmartTodo, TodoStatus, TodoPriorityLevel, EnergyLevel, User, AppState,
} from '../../types';
import { MarkdownView } from '../ui/MarkdownView';
import { generateId } from '../../services/storage';
import { runPrompt } from '../../services/llmService';

// ── helpers ────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const isOverdue = (todo: SmartTodo) =>
  todo.dueDate && todo.dueDate < today() && todo.status !== 'done' && todo.status !== 'cancelled';

const isDueToday = (todo: SmartTodo) =>
  todo.dueDate === today() && todo.status !== 'done' && todo.status !== 'cancelled';

const formatDuration = (min: number | null): string => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const daysUntil = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const diff = Math.round((new Date(dateStr).getTime() - new Date(today()).getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff}d`;
};

// ── styling maps ────────────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<TodoPriorityLevel, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-400',
  medium: 'border-l-amber-400',
  low: 'border-l-teal-400',
};

const PRIORITY_BADGE: Record<TodoPriorityLevel, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
};

const PRIORITY_ICON: Record<TodoPriorityLevel, React.ReactNode> = {
  urgent: <ArrowUp className="w-3 h-3" />,
  high: <ArrowUp className="w-3 h-3" />,
  medium: <ArrowRight className="w-3 h-3" />,
  low: <ArrowDown className="w-3 h-3" />,
};

const STATUS_CONFIG: Record<TodoStatus, { icon: React.ReactNode; label: string; color: string; activeBg: string }> = {
  todo: { icon: <Circle className="w-4 h-4" />, label: 'To Do', color: 'text-neutral-400 dark:text-neutral-500', activeBg: 'bg-neutral-500' },
  in_progress: { icon: <Clock className="w-4 h-4" />, label: 'In Progress', color: 'text-blue-500', activeBg: 'bg-blue-500' },
  blocked: { icon: <AlertCircle className="w-4 h-4" />, label: 'Blocked', color: 'text-red-500', activeBg: 'bg-red-500' },
  done: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Done', color: 'text-emerald-500', activeBg: 'bg-emerald-500' },
  cancelled: { icon: <XCircle className="w-4 h-4" />, label: 'Cancelled', color: 'text-neutral-400', activeBg: 'bg-neutral-400' },
};

const QUADRANT_CONFIG: Record<number, { label: string; sublabel: string; color: string; bg: string }> = {
  1: { label: 'Do Now', sublabel: 'Urgent & Important', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  2: { label: 'Schedule', sublabel: 'Not Urgent & Important', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  3: { label: 'Delegate', sublabel: 'Urgent & Not Important', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  4: { label: 'Eliminate', sublabel: 'Not Urgent & Not Important', color: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-50 dark:bg-neutral-800' },
};

const ENERGY_CONFIG: Record<EnergyLevel, { icon: string; color: string }> = {
  high: { icon: '⚡', color: 'text-yellow-600 dark:text-yellow-400' },
  medium: { icon: '🔋', color: 'text-blue-500 dark:text-blue-400' },
  low: { icon: '🍃', color: 'text-emerald-600 dark:text-emerald-400' },
};

const PLANNING_FOR_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  today:        { label: 'Today',        color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-900/30' },
  tomorrow:     { label: 'Tomorrow',     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  this_week:    { label: 'This Week',    color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/30' },
  this_month:   { label: 'This Month',   color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  this_quarter: { label: 'This Quarter', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  this_year:    { label: 'This Year',    color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  tbd:          { label: 'TBD',          color: 'text-neutral-500 dark:text-neutral-400',   bg: 'bg-neutral-100 dark:bg-neutral-800' },
};

// ── blank form ──────────────────────────────────────────────────────────────

const blankForm = (userId: string): SmartTodo => ({
  id: '',
  userId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  source: '',
  requester: '',
  sponsor: '',
  isRecurring: false,
  recurrenceRule: null,
  createdByBot: false,
  isArchived: false,
  managerAssigned: false,
  assignedByUserId: undefined,
  title: '',
  description: '',
  tags: [],
  attachments: [],
  links: [],
  status: 'todo',
  priorityLevel: 'medium',
  eisenhowerQuadrant: null,
  energyRequired: 'medium',
  estimatedDurationMin: null,
  actualTimeSpentMin: null,
  startDate: null,
  dueDate: null,
  completedAt: null,
  planningFor: null,
  scheduledDateTime: null,
  scheduledDuration: null,
});

// ── Outlook ICS Generator ───────────────────────────────────────────────────

const formatICSDate = (isoString: string): string =>
  isoString.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace(/\.\d+$/, '');

const generateOutlookICS = (todo: SmartTodo, currentUser: User): void => {
  const now = new Date();
  const dtStamp = formatICSDate(now.toISOString());
  const uid = `${todo.id}-${Date.now()}@doing-app`;

  let dtStart: string;
  let dtEnd: string;

  if (todo.scheduledDateTime) {
    const startDt = new Date(todo.scheduledDateTime);
    const durationMs = (todo.scheduledDuration || 60) * 60 * 1000;
    const endDt = new Date(startDt.getTime() + durationMs);
    dtStart = formatICSDate(startDt.toISOString());
    dtEnd = formatICSDate(endDt.toISOString());
  } else if (todo.dueDate) {
    dtStart = `${todo.dueDate.replace(/-/g, '')}T090000`;
    dtEnd = `${todo.dueDate.replace(/-/g, '')}T100000`;
  } else {
    const d = new Date(now.getTime() + 86400000);
    const ds = d.toISOString().split('T')[0].replace(/-/g, '');
    dtStart = `${ds}T090000`;
    dtEnd = `${ds}T100000`;
  }

  const priorityMap: Record<string, number> = { urgent: 1, high: 3, medium: 5, low: 9 };
  const planLabel = todo.planningFor ? (PLANNING_FOR_CONFIG[todo.planningFor]?.label || todo.planningFor) : '';

  const descLines = [
    `[TASK] ${todo.title}`, '',
    todo.description ? `Description:\n${todo.description}` : '',
    '',
    `Priority: ${todo.priorityLevel.toUpperCase()}`,
    todo.eisenhowerQuadrant ? `Eisenhower Matrix: Q${todo.eisenhowerQuadrant} — ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].label}` : '',
    planLabel ? `Schedule Priority: ${planLabel}` : '',
    todo.requester ? `Requester: ${todo.requester}` : '',
    todo.dueDate ? `Due Date: ${todo.dueDate}` : '',
    todo.tags.length > 0 ? `Tags: #${todo.tags.join(' #')}` : '',
    '',
    `Created by: ${currentUser.firstName} ${currentUser.lastName}`,
    `Generated via DOINg.AI`,
  ].filter(Boolean);

  const descICS = descLines.join('\n').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DOINg.AI//SmartTodo//EN',
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${dtStamp}`, `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
    `SUMMARY:[${todo.priorityLevel.toUpperCase()}] ${todo.title}`,
    `DESCRIPTION:${descICS}`,
    `PRIORITY:${priorityMap[todo.priorityLevel] ?? 5}`,
    'STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todo-${todo.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 50)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── SchedulePickerModal ─────────────────────────────────────────────────────

interface SchedulePickerModalProps {
  initialDate: string | null;
  initialHour: number;
  initialDuration: number;
  onSave: (isoDateTime: string, durationMin: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const SchedulePickerModal: React.FC<SchedulePickerModalProps> = ({
  initialDate, initialHour, initialDuration, onSave, onClear, onClose,
}) => {
  const todayStr = today();
  const [selectedDate, setSelectedDate] = useState(initialDate || todayStr);
  const [selectedHour, setSelectedHour] = useState(initialHour || 9);
  const [duration, setDuration] = useState(initialDuration || 60);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(initialDate || todayStr);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const getDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayRaw = new Date(year, month, 1).getDay();
    const startOffset = (firstDayRaw + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  };

  const handleSave = () => {
    const isoDateTime = `${selectedDate}T${String(selectedHour).padStart(2, '0')}:00:00`;
    onSave(isoDateTime, duration);
  };

  const monthLabel = currentMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const days = getDays();

  const previewLabel = (() => {
    const d = new Date(`${selectedDate}T${String(selectedHour).padStart(2, '0')}:00:00`);
    const dateStr = d.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const endH = selectedHour + Math.floor(duration / 60);
    const endM = duration % 60;
    return `${dateStr} · ${selectedHour}:00 → ${endH}:${String(endM).padStart(2, '0')}`;
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-900 w-full max-w-md border border-neutral-200 dark:border-ink-700 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-ink-700">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Schedule Task</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-ink-700"
              >
                <ChevronLeft className="w-4 h-4 text-muted" />
              </button>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{monthLabel}</span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-ink-700"
              >
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-muted py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                return (
                  <button
                    key={i}
                    onClick={() => !isPast && setSelectedDate(dateStr)}
                    disabled={isPast}
                    className={`aspect-square flex items-center justify-center text-xs font-bold transition-colors
                      ${isSelected ? 'bg-brand text-white' :
                        isToday ? 'border-2 border-brand text-brand' :
                        isPast ? 'text-neutral-300 dark:text-neutral-700 cursor-not-allowed' :
                        'hover:bg-neutral-100 dark:hover:bg-ink-700 text-neutral-700 dark:text-neutral-300'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div>
            <label className="label-xs mb-2 block">Start Time</label>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                <button
                  key={h}
                  onClick={() => setSelectedHour(h)}
                  className={`py-1.5 text-[11px] font-bold transition-colors
                    ${selectedHour === h ? 'bg-brand text-white' : 'bg-neutral-50 dark:bg-ink-800 hover:bg-neutral-100 dark:hover:bg-ink-700 text-neutral-700 dark:text-neutral-300'}`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label-xs mb-2 block">Duration</label>
            <div className="flex flex-wrap gap-2">
              {[30, 60, 90, 120, 150, 180, 240].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors
                    ${duration === d ? 'bg-brand text-white' : 'bg-neutral-50 dark:bg-ink-800 hover:bg-neutral-100 dark:hover:bg-ink-700 text-neutral-700 dark:text-neutral-300'}`}
                >
                  {d < 60 ? `${d}min` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="border border-brand/30 bg-brand/5 p-3">
            <p className="label-xs text-brand mb-0.5">Scheduled Slot</p>
            <p className="text-[12px] font-bold text-brand">{previewLabel}</p>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-neutral-200 dark:border-ink-700">
          <button onClick={onClear} className="px-3 py-2 border border-neutral-200 dark:border-ink-600 text-muted text-sm font-bold hover:bg-neutral-50 dark:hover:bg-ink-800 transition-colors">
            Clear
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-neutral-200 dark:border-ink-600 text-muted text-sm font-bold hover:bg-neutral-50 dark:hover:bg-ink-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-bold transition-colors">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ── TodoCard ────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: SmartTodo;
  onClick: () => void;
  onStatusToggle: (next: TodoStatus) => void;
  onDelete: () => void;
  onArchiveToggle: () => void;
}

const TodoCard: React.FC<TodoCardProps> = ({ todo, onClick, onStatusToggle, onDelete, onArchiveToggle }) => {
  const statusCfg = STATUS_CONFIG[todo.status];
  const overdue = isOverdue(todo);
  const dueToday = isDueToday(todo);

  const nextStatus = (): TodoStatus => {
    if (todo.status === 'todo') return 'in_progress';
    if (todo.status === 'in_progress') return 'done';
    return 'todo';
  };

  return (
    <div
      className={`group relative surface border border-l-4 hover:border-brand transition-all cursor-pointer
        ${PRIORITY_BORDER[todo.priorityLevel]}
        ${todo.status === 'done' ? 'opacity-60' : ''}
        ${todo.status === 'cancelled' ? 'opacity-40' : ''}
        ${todo.isArchived ? 'opacity-50' : ''}
        ${overdue ? 'border-t-2 border-t-red-400' : ''}`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <button
            onClick={e => { e.stopPropagation(); onStatusToggle(nextStatus()); }}
            className={`mt-0.5 shrink-0 ${statusCfg.color} hover:opacity-70 transition-opacity`}
            title={`Status: ${statusCfg.label}`}
          >
            {statusCfg.icon}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm leading-snug ${todo.status === 'done' ? 'line-through text-muted' : ''} ${todo.status === 'cancelled' ? 'line-through' : ''}`}>
              {todo.title || <span className="italic text-muted">Untitled</span>}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {todo.managerAssigned && (
              <span title="Manager assigned" className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-bold">
                <Shield className="w-3 h-3" /> Manager ask
              </span>
            )}
            {todo.isRecurring && (
              <span title="Recurring" className="text-blue-400">
                <Repeat className="w-3.5 h-3.5" />
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_BADGE[todo.priorityLevel]}`}>
              {PRIORITY_ICON[todo.priorityLevel]}
              {todo.priorityLevel}
            </span>
          </div>

          <button
            onClick={e => { e.stopPropagation(); onArchiveToggle(); }}
            className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-muted hover:text-amber-500 transition-all"
            title={todo.isArchived ? 'Unarchive' : 'Archive'}
          >
            {todo.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-muted hover:text-red-500 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {todo.description && (
          <p className="text-xs text-muted line-clamp-2 ml-7 mb-2">{todo.description}</p>
        )}

        <div className="flex items-center gap-3 ml-7 flex-wrap">
          {todo.dueDate && (
            <span className={`flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5
              ${overdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                dueToday ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                'text-muted'}`}>
              <Calendar className="w-3 h-3" />
              {daysUntil(todo.dueDate)}
            </span>
          )}
          {todo.estimatedDurationMin && (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Clock className="w-3 h-3" />
              {formatDuration(todo.estimatedDurationMin)}
            </span>
          )}
          {todo.energyRequired && (
            <span className={`text-[11px] ${ENERGY_CONFIG[todo.energyRequired].color}`}>
              {ENERGY_CONFIG[todo.energyRequired].icon}
            </span>
          )}
          {todo.eisenhowerQuadrant && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].bg} ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].color}`}>
              Q{todo.eisenhowerQuadrant}: {QUADRANT_CONFIG[todo.eisenhowerQuadrant].label}
            </span>
          )}
          {todo.planningFor && PLANNING_FOR_CONFIG[todo.planningFor] && (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 ${PLANNING_FOR_CONFIG[todo.planningFor].bg} ${PLANNING_FOR_CONFIG[todo.planningFor].color}`}>
              <Flag className="w-2.5 h-2.5" />
              {PLANNING_FOR_CONFIG[todo.planningFor].label}
            </span>
          )}
          {todo.scheduledDateTime && (
            <span className="flex items-center gap-1 text-[11px] text-brand font-bold">
              <CalendarClock className="w-3 h-3" />
              {new Date(todo.scheduledDateTime).toLocaleDateString('en', { month: 'short', day: 'numeric' })} {new Date(todo.scheduledDateTime).getHours()}h
              {todo.scheduledDuration ? ` · ${todo.scheduledDuration < 60 ? `${todo.scheduledDuration}min` : `${todo.scheduledDuration / 60}h`}` : ''}
            </span>
          )}
          {todo.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] bg-neutral-100 dark:bg-ink-700 text-muted px-1.5 py-0.5">
              #{t}
            </span>
          ))}
          {todo.tags.length > 3 && <span className="text-[10px] text-muted">+{todo.tags.length - 3}</span>}
        </div>
      </div>
    </div>
  );
};

// ── TodoFormModal ───────────────────────────────────────────────────────────

const inputCls = 'w-full p-2.5 bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-600 text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-brand/30';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1';

interface TodoFormModalProps {
  initial: SmartTodo;
  onSave: (todo: SmartTodo) => void;
  onClose: () => void;
  title: string;
  currentUser: User;
  users?: User[];
  isAdmin?: boolean;
}

const TodoFormModal: React.FC<TodoFormModalProps> = ({ initial, onSave, onClose, title, currentUser, users, isAdmin }) => {
  const [form, setForm] = useState<SmartTodo>(initial);
  const [tagInput, setTagInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const set = (field: keyof SmartTodo, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !form.links.includes(l)) set('links', [...form.links, l]);
    setLinkInput('');
  };

  const addAttachment = () => {
    if (attachName.trim() && attachUrl.trim()) {
      set('attachments', [...form.attachments, { name: attachName.trim(), url: attachUrl.trim() }]);
      setAttachName(''); setAttachUrl('');
    }
  };

  const handleSave = () => {
    if (!form.title.trim()) { alert('A title is required.'); return; }
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
      completedAt: form.status === 'done' && !form.completedAt ? new Date().toISOString() : form.completedAt,
    });
  };

  const handleArchiveToggle = () => {
    onSave({ ...form, isArchived: !form.isArchived, updatedAt: new Date().toISOString() });
  };

  const isEditing = !!form.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="surface border border-neutral-200 dark:border-ink-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-ink-700">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.14em]">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="What needs to be done?" />
          </div>

          {/* Admin: assign to user */}
          {isAdmin && users && users.length > 0 && (
            <div>
              <label className={labelCls}>Assign to User (Admin)</label>
              <select
                value={form.userId}
                onChange={e => {
                  const uid = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    userId: uid,
                    managerAssigned: uid !== currentUser.id,
                    assignedByUserId: uid !== currentUser.id ? currentUser.id : undefined,
                  }));
                }}
                className={inputCls}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}{u.id === currentUser.id ? ' (you)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Additional context..." />
          </div>

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as TodoStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors
                    ${form.status === s
                      ? `${STATUS_CONFIG[s].activeBg} text-white border-transparent`
                      : 'border-neutral-200 dark:border-ink-600 text-muted hover:border-neutral-400'}`}
                >
                  {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority</label>
            <select value={form.priorityLevel} onChange={e => set('priorityLevel', e.target.value as TodoPriorityLevel)} className={inputCls}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Eisenhower + Energy */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Eisenhower Quadrant</label>
              <select value={form.eisenhowerQuadrant ?? ''} onChange={e => set('eisenhowerQuadrant', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                <option value="">— None —</option>
                <option value="1">Q1: Do Now (Urgent + Important)</option>
                <option value="2">Q2: Schedule (Not Urgent + Important)</option>
                <option value="3">Q3: Delegate (Urgent + Not Important)</option>
                <option value="4">Q4: Eliminate (Not Urgent + Not Important)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Energy Required</label>
              <select value={form.energyRequired} onChange={e => set('energyRequired', e.target.value as EnergyLevel)} className={inputCls}>
                <option value="low">Low 🍃</option>
                <option value="medium">Medium 🔋</option>
                <option value="high">High ⚡</option>
              </select>
            </div>
          </div>

          {/* Schedule Priority */}
          <div>
            <label className={labelCls}>Schedule Priority</label>
            <select value={form.planningFor ?? ''} onChange={e => set('planningFor', e.target.value || null)} className={inputCls}>
              <option value="">— Not set —</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="tbd">TBD</option>
            </select>
          </div>

          {/* Dates + Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={form.startDate ?? ''} onChange={e => set('startDate', e.target.value || null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={form.dueDate ?? ''} onChange={e => set('dueDate', e.target.value || null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Est. Duration (min)</label>
              <input type="number" min="0" value={form.estimatedDurationMin ?? ''} onChange={e => set('estimatedDurationMin', e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="e.g. 90" />
            </div>
          </div>

          {/* Schedule picker */}
          <div>
            <label className={labelCls}>Scheduled Slot</label>
            {form.scheduledDateTime ? (
              <div className="flex items-center gap-3 p-3 border border-brand/30 bg-brand/5">
                <CalendarClock className="w-4 h-4 text-brand shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand">
                    {new Date(form.scheduledDateTime).toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-brand/70">
                    {new Date(form.scheduledDateTime).getHours()}:00
                    {form.scheduledDuration ? ` · ${form.scheduledDuration < 60 ? `${form.scheduledDuration}min` : `${form.scheduledDuration / 60}h`}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setShowSchedulePicker(true)} className="px-2.5 py-1 bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-colors">Edit</button>
                <button type="button" onClick={() => { set('scheduledDateTime', null); set('scheduledDuration', null); }} className="text-muted hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSchedulePicker(true)}
                className="w-full flex items-center gap-2 p-3 border-2 border-dashed border-neutral-300 dark:border-ink-600 text-sm text-muted hover:border-brand hover:text-brand transition-colors"
              >
                <CalendarClock className="w-4 h-4" />
                Click to schedule a time slot…
              </button>
            )}
          </div>

          {showSchedulePicker && (
            <SchedulePickerModal
              initialDate={form.scheduledDateTime ? form.scheduledDateTime.split('T')[0] : null}
              initialHour={form.scheduledDateTime ? new Date(form.scheduledDateTime).getHours() : 9}
              initialDuration={form.scheduledDuration || 60}
              onSave={(isoDateTime, durationMin) => { set('scheduledDateTime', isoDateTime); set('scheduledDuration', durationMin); setShowSchedulePicker(false); }}
              onClear={() => { set('scheduledDateTime', null); set('scheduledDuration', null); setShowSchedulePicker(false); }}
              onClose={() => setShowSchedulePicker(false)}
            />
          )}

          {/* Source + Requester + Sponsor */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <input value={form.source} onChange={e => set('source', e.target.value)} className={inputCls} placeholder="Email, Meeting..." />
            </div>
            <div>
              <label className={labelCls}>Requester</label>
              <input value={form.requester} onChange={e => set('requester', e.target.value)} className={inputCls} placeholder="Who requested this?" />
            </div>
            <div>
              <label className={labelCls}>Sponsor</label>
              <input value={form.sponsor ?? ''} onChange={e => set('sponsor', e.target.value)} className={inputCls} placeholder="Sponsor" />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={e => set('isRecurring', e.target.checked)} />
            <label htmlFor="recurring" className="text-sm font-bold cursor-pointer">Recurring task</label>
            {form.isRecurring && (
              <input value={form.recurrenceRule ?? ''} onChange={e => set('recurrenceRule', e.target.value || null)} className="flex-1 p-2 border border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 text-sm" placeholder="e.g. Every Monday" />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-bold">
                  #{t}
                  <button onClick={() => set('tags', form.tags.filter(x => x !== t))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag..." className={inputCls} />
              <button onClick={addTag} className="px-3 py-2 bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors">Add</button>
            </div>
          </div>

          {/* Links */}
          <div>
            <label className={labelCls}>Links</label>
            <div className="space-y-1 mb-2">
              {form.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{l}</span>
                  <button onClick={() => set('links', form.links.filter((_, j) => j !== i))} className="text-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="https://..." className={inputCls} />
              <button onClick={addLink} className="px-3 py-2 bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors">Add</button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className={labelCls}>Attachments</label>
            <div className="space-y-1 mb-2">
              {form.attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-neutral-50 dark:bg-ink-800 px-2 py-1.5 border border-neutral-200 dark:border-ink-600">
                  <Paperclip className="w-3 h-3 shrink-0 text-muted" />
                  <span className="font-bold">{a.name}</span>
                  <span className="truncate flex-1 text-blue-500">{a.url}</span>
                  <button onClick={() => set('attachments', form.attachments.filter((_, j) => j !== i))} className="text-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={attachName} onChange={e => setAttachName(e.target.value)} placeholder="Name" className="w-1/3 p-2 border border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 text-sm" />
              <input value={attachUrl} onChange={e => setAttachUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAttachment()} placeholder="URL or path" className="flex-1 p-2 border border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 text-sm" />
              <button onClick={addAttachment} className="px-3 py-2 bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors">Add</button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-neutral-200 dark:border-ink-700">
          {isEditing && (
            <button onClick={handleArchiveToggle} className="flex items-center gap-2 px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-sm font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
              {form.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {form.isArchived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2 border border-neutral-200 dark:border-ink-600 text-muted text-sm font-bold hover:bg-neutral-50 dark:hover:bg-ink-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-bold transition-colors">
            Save Todo
          </button>
        </div>
      </div>
    </div>
  );
};

// ── TodoDetailModal ─────────────────────────────────────────────────────────

interface TodoDetailModalProps {
  todo: SmartTodo;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TodoStatus) => void;
  onArchiveToggle: () => void;
  currentUser: User;
}

const TodoDetailModal: React.FC<TodoDetailModalProps> = ({ todo, onClose, onEdit, onDelete, onStatusChange, onArchiveToggle, currentUser }) => {
  const statusCfg = STATUS_CONFIG[todo.status];
  const overdue = isOverdue(todo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`surface border border-l-4 ${PRIORITY_BORDER[todo.priorityLevel]} w-full max-w-2xl max-h-[88vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 border-b border-neutral-200 dark:border-ink-700">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase ${PRIORITY_BADGE[todo.priorityLevel]}`}>
                {PRIORITY_ICON[todo.priorityLevel]} {todo.priorityLevel}
              </span>
              {todo.managerAssigned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[11px] font-bold">
                  <Shield className="w-3 h-3" /> Manager ask
                </span>
              )}
              {todo.isArchived && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                  <Archive className="w-3 h-3" /> Archived
                </span>
              )}
              {todo.isRecurring && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                  <Repeat className="w-3 h-3" /> {todo.recurrenceRule || 'Recurring'}
                </span>
              )}
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[11px] font-bold">
                  <AlertCircle className="w-3 h-3" /> Overdue
                </span>
              )}
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight">{todo.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onArchiveToggle} className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title={todo.isArchived ? 'Unarchive' : 'Archive'}>
              {todo.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </button>
            <button onClick={onEdit} className="p-2 text-brand hover:bg-brand/10 transition-colors" title="Edit">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => { onDelete(); onClose(); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-muted hover:text-neutral-900 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="label-xs">Status:</span>
            {(Object.keys(STATUS_CONFIG) as TodoStatus[]).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors
                  ${todo.status === s
                    ? `${STATUS_CONFIG[s].activeBg} text-white border-transparent`
                    : 'border-neutral-200 dark:border-ink-600 text-muted hover:border-neutral-400'}`}
              >
                {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {todo.description && (
            <div>
              <p className="label-xs mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{todo.description}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4 bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-600 p-4">
            {todo.dueDate && (
              <div>
                <p className="label-xs mb-0.5">Due Date</p>
                <p className={`text-sm font-bold ${overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {todo.dueDate} <span className="font-normal text-xs text-muted">({daysUntil(todo.dueDate)})</span>
                </p>
              </div>
            )}
            {todo.startDate && (
              <div>
                <p className="label-xs mb-0.5">Start Date</p>
                <p className="text-sm font-bold">{todo.startDate}</p>
              </div>
            )}
            {todo.estimatedDurationMin && (
              <div>
                <p className="label-xs mb-0.5">Estimated Duration</p>
                <p className="text-sm font-bold">{formatDuration(todo.estimatedDurationMin)}</p>
              </div>
            )}
            {todo.actualTimeSpentMin != null && (
              <div>
                <p className="label-xs mb-0.5">Actual Time Spent</p>
                <p className="text-sm font-bold">{formatDuration(todo.actualTimeSpentMin)}</p>
              </div>
            )}
            {todo.energyRequired && (
              <div>
                <p className="label-xs mb-0.5">Energy Required</p>
                <p className="text-sm font-bold capitalize">{ENERGY_CONFIG[todo.energyRequired].icon} {todo.energyRequired}</p>
              </div>
            )}
            {todo.eisenhowerQuadrant && (
              <div>
                <p className="label-xs mb-0.5">Eisenhower Quadrant</p>
                <p className={`text-sm font-bold ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].color}`}>
                  Q{todo.eisenhowerQuadrant}: {QUADRANT_CONFIG[todo.eisenhowerQuadrant].label}
                </p>
              </div>
            )}
            {todo.planningFor && PLANNING_FOR_CONFIG[todo.planningFor] && (
              <div>
                <p className="label-xs mb-0.5">Schedule Priority</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold ${PLANNING_FOR_CONFIG[todo.planningFor].bg} ${PLANNING_FOR_CONFIG[todo.planningFor].color}`}>
                  <Flag className="w-3 h-3" />
                  {PLANNING_FOR_CONFIG[todo.planningFor].label}
                </span>
              </div>
            )}
            {todo.scheduledDateTime && (
              <div className="col-span-2">
                <p className="label-xs mb-0.5">Scheduled Slot</p>
                <p className="text-sm font-bold text-brand flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4" />
                  {new Date(todo.scheduledDateTime).toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}{new Date(todo.scheduledDateTime).getHours()}:00
                  {todo.scheduledDuration ? ` — ${todo.scheduledDuration < 60 ? `${todo.scheduledDuration}min` : `${todo.scheduledDuration / 60}h`}` : ''}
                </p>
              </div>
            )}
            {todo.source && (
              <div>
                <p className="label-xs mb-0.5">Source</p>
                <p className="text-sm">{todo.source}</p>
              </div>
            )}
            {todo.requester && (
              <div>
                <p className="label-xs mb-0.5">Requester</p>
                <p className="text-sm">{todo.requester}</p>
              </div>
            )}
            {todo.sponsor && (
              <div>
                <p className="label-xs mb-0.5">Sponsor</p>
                <p className="text-sm">{todo.sponsor}</p>
              </div>
            )}
          </div>

          {/* Outlook ICS */}
          <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="label-xs text-blue-600 dark:text-blue-400 mb-1">Outlook Meeting</p>
            <p className="text-xs text-muted mb-3">
              Generate a .ics file to import directly into Outlook.
              {!todo.scheduledDateTime && <span className="text-amber-600 dark:text-amber-400"> (Set a scheduled slot for a specific time.)</span>}
            </p>
            <button
              onClick={() => generateOutlookICS(todo, currentUser)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Outlook Meeting (.ics)
            </button>
          </div>

          {/* Tags */}
          {todo.tags.length > 0 && (
            <div>
              <p className="label-xs mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {todo.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-bold">
                    <Tag className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {todo.links.length > 0 && (
            <div>
              <p className="label-xs mb-2">Links</p>
              <div className="space-y-1">
                {todo.links.map((l, i) => (
                  <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{l}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {todo.attachments.length > 0 && (
            <div>
              <p className="label-xs mb-2">Attachments</p>
              <div className="space-y-1">
                {todo.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm bg-neutral-50 dark:bg-ink-800 px-3 py-2 border border-neutral-200 dark:border-ink-600 hover:border-brand transition-colors">
                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted" />
                    <span className="font-bold">{a.name}</span>
                    <span className="text-xs text-muted truncate flex-1">{a.url}</span>
                    <ExternalLink className="w-3 h-3 text-muted shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-muted flex gap-4 pt-2">
            <span>Created: {new Date(todo.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(todo.updatedAt).toLocaleDateString()}</span>
            {todo.completedAt && <span>Completed: {new Date(todo.completedAt).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── AISynthesisModal ─────────────────────────────────────────────────────────

const AISynthesisModal: React.FC<{ result: string; onClose: () => void }> = ({ result, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="surface border border-neutral-200 dark:border-ink-700 w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-ink-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="text-[13px] font-bold uppercase tracking-[0.14em]">AI Synthesis</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <MarkdownView content={result} />
        </div>
        <div className="p-5 border-t border-neutral-200 dark:border-ink-700">
          <button onClick={onClose} className="w-full py-2 border border-neutral-200 dark:border-ink-600 text-muted text-sm font-bold hover:bg-neutral-50 dark:hover:bg-ink-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── EisenhowerMatrixView ────────────────────────────────────────────────────

const EisenhowerMatrixView: React.FC<{ todos: SmartTodo[]; onTodoClick: (todo: SmartTodo) => void }> = ({ todos, onTodoClick }) => {
  const activeTodos = todos.filter(t => !t.isArchived);
  const getQuadrantTodos = (q: 1 | 2 | 3 | 4) => activeTodos.filter(t => t.eisenhowerQuadrant === q && t.status !== 'done' && t.status !== 'cancelled');
  const unclassified = activeTodos.filter(t => !t.eisenhowerQuadrant && t.status !== 'done' && t.status !== 'cancelled');

  const QuadrantCell = ({ q }: { q: 1 | 2 | 3 | 4 }) => {
    const cfg = QUADRANT_CONFIG[q];
    const qtodos = getQuadrantTodos(q);
    return (
      <div className={`border p-4 ${cfg.bg} border-neutral-200 dark:border-ink-600`}>
        <div className="mb-3">
          <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${cfg.color}`}>Q{q}: {cfg.label}</span>
          <p className="text-[10px] text-muted">{cfg.sublabel}</p>
        </div>
        <div className="space-y-2">
          {qtodos.length === 0 && <p className="text-xs text-muted italic">No tasks here</p>}
          {qtodos.map(t => (
            <div
              key={t.id}
              onClick={() => onTodoClick(t)}
              className="surface border border-neutral-200 dark:border-ink-600 p-2.5 cursor-pointer hover:border-brand transition-colors"
            >
              <p className="text-xs font-bold line-clamp-2">{t.title}</p>
              {t.dueDate && <p className="text-[10px] text-muted mt-1">{daysUntil(t.dueDate)}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <QuadrantCell q={1} />
        <QuadrantCell q={2} />
        <QuadrantCell q={3} />
        <QuadrantCell q={4} />
      </div>
      {unclassified.length > 0 && (
        <div className="surface-flat border border-neutral-200 dark:border-ink-600 p-4">
          <p className="label-xs mb-2">Unclassified ({unclassified.length})</p>
          <div className="flex flex-wrap gap-2">
            {unclassified.map(t => (
              <div key={t.id} onClick={() => onTodoClick(t)} className="surface border border-neutral-200 dark:border-ink-600 cursor-pointer hover:border-brand px-3 py-2 text-xs font-bold transition-colors">
                {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── SmartTodoView (main export) ─────────────────────────────────────────────

interface Props {
  state: AppState;
  currentUser: User;
  update: (mutator: (s: AppState) => AppState) => void;
}

export const SmartTodoView: React.FC<Props> = ({ state, currentUser, update }) => {
  const isAdmin = currentUser.role === 'admin';

  // Filter todos: admin sees all assigned ones, others only see their own
  const todos = useMemo(() => {
    const all = state.smartTodos || [];
    if (isAdmin) {
      return all.filter(t => t.userId === currentUser.id || t.managerAssigned);
    }
    return all.filter(t => t.userId === currentUser.id);
  }, [state.smartTodos, currentUser.id, isAdmin]);

  const [filterStatus, setFilterStatus] = useState<'all' | TodoStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TodoPriorityLevel>('all');
  const [filterPlanningFor, setFilterPlanningFor] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created' | 'title'>('due_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [selectedTodo, setSelectedTodo] = useState<SmartTodo | null>(null);
  const [editingTodo, setEditingTodo] = useState<SmartTodo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [aiSynthesisLoading, setAiSynthesisLoading] = useState(false);
  const [aiSynthesisResult, setAiSynthesisResult] = useState<string | null>(null);

  const stats = useMemo(() => {
    const nonArchived = todos.filter(t => !t.isArchived);
    const active = nonArchived.filter(t => t.status !== 'cancelled');
    return {
      total: active.length,
      todo: active.filter(t => t.status === 'todo').length,
      inProgress: active.filter(t => t.status === 'in_progress').length,
      blocked: active.filter(t => t.status === 'blocked').length,
      done: active.filter(t => t.status === 'done').length,
      overdue: active.filter(t => isOverdue(t)).length,
      dueToday: active.filter(t => isDueToday(t)).length,
    };
  }, [todos]);

  const PRIORITY_ORDER: Record<TodoPriorityLevel, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filtered = useMemo(() => {
    let result = viewTab === 'active' ? todos.filter(t => !t.isArchived) : todos.filter(t => t.isArchived);
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus);
    if (filterPriority !== 'all') result = result.filter(t => t.priorityLevel === filterPriority);
    if (filterPlanningFor !== 'all') result = result.filter(t => (t.planningFor ?? 'none') === filterPlanningFor);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tg => tg.toLowerCase().includes(q)) ||
        t.requester.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'due_date') { cmp = (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'); }
      else if (sortBy === 'priority') { cmp = PRIORITY_ORDER[a.priorityLevel] - PRIORITY_ORDER[b.priorityLevel]; }
      else if (sortBy === 'created') { cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); }
      else if (sortBy === 'title') { cmp = a.title.localeCompare(b.title); }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [todos, viewTab, filterStatus, filterPriority, filterPlanningFor, searchQuery, sortBy, sortDir]);

  const saveTodo = (todo: SmartTodo) => {
    update(s => ({
      ...s,
      smartTodos: (s.smartTodos || []).some(t => t.id === todo.id)
        ? (s.smartTodos || []).map(t => t.id === todo.id ? todo : t)
        : [...(s.smartTodos || []), todo],
    }));
  };

  const deleteTodo = (id: string) => {
    update(s => ({ ...s, smartTodos: (s.smartTodos || []).filter(t => t.id !== id) }));
  };

  const handleCreate = (form: SmartTodo) => {
    const newTodo: SmartTodo = { ...form, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (!newTodo.userId) newTodo.userId = currentUser.id;
    saveTodo(newTodo);
    setIsCreating(false);
  };

  const handleUpdate = (form: SmartTodo) => {
    saveTodo({ ...form, updatedAt: new Date().toISOString() });
    setEditingTodo(null);
    setSelectedTodo(form);
  };

  const handleStatusChange = (todo: SmartTodo, status: TodoStatus) => {
    const updated: SmartTodo = {
      ...todo, status, updatedAt: new Date().toISOString(),
      completedAt: status === 'done' ? new Date().toISOString() : todo.completedAt,
    };
    saveTodo(updated);
    if (selectedTodo?.id === todo.id) setSelectedTodo(updated);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this todo?')) return;
    deleteTodo(id);
    if (selectedTodo?.id === id) setSelectedTodo(null);
  };

  const handleArchiveToggle = (todo: SmartTodo) => {
    const updated: SmartTodo = { ...todo, isArchived: !todo.isArchived, updatedAt: new Date().toISOString() };
    saveTodo(updated);
    if (selectedTodo?.id === todo.id) setSelectedTodo(null);
  };

  const handleAISynthesis = async () => {
    if (!state.llmConfig?.provider) { alert('Configure LLM settings first.'); return; }
    setAiSynthesisLoading(true);
    try {
      const todoSummary = todos.filter(t => !t.isArchived).map(t =>
        `- [${t.status.toUpperCase()}] [${t.priorityLevel}] ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}${t.description ? ` — ${t.description.slice(0, 100)}` : ''}`
      ).join('\n');
      const prompt = `You are DOINg.AI, an expert productivity assistant.

Analyze this person's task list and provide:
1. A brief executive summary of their workload
2. Top 3 priority actions they should take NOW
3. Items at risk (overdue or high-urgency)
4. Patterns or recommendations

Task list:
${todoSummary}

Respond in clear Markdown with sections. Be concise and actionable.`;
      const result = await runPrompt(prompt, state.llmConfig);
      setAiSynthesisResult(result);
    } catch (e: any) {
      setAiSynthesisResult(`Error: ${e.message}`);
    } finally {
      setAiSynthesisLoading(false);
    }
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <Minus className="w-3 h-3 text-neutral-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Modals */}
      {aiSynthesisResult && <AISynthesisModal result={aiSynthesisResult} onClose={() => setAiSynthesisResult(null)} />}
      {isCreating && (
        <TodoFormModal
          initial={blankForm(currentUser.id)}
          onSave={handleCreate}
          onClose={() => setIsCreating(false)}
          title="New Smart To Do"
          currentUser={currentUser}
          users={isAdmin ? state.users : undefined}
          isAdmin={isAdmin}
        />
      )}
      {editingTodo && (
        <TodoFormModal
          initial={editingTodo}
          onSave={handleUpdate}
          onClose={() => setEditingTodo(null)}
          title="Edit Todo"
          currentUser={currentUser}
          users={isAdmin ? state.users : undefined}
          isAdmin={isAdmin}
        />
      )}
      {selectedTodo && !editingTodo && (
        <TodoDetailModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onEdit={() => { setEditingTodo(selectedTodo); setSelectedTodo(null); }}
          onDelete={() => handleDelete(selectedTodo.id)}
          onStatusChange={s => handleStatusChange(selectedTodo, s)}
          onArchiveToggle={() => handleArchiveToggle(selectedTodo)}
          currentUser={currentUser}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <p className="label-xs">Personal Task Manager</p>
          <h1 className="display-xl">Smart ToDo</h1>
          <p className="text-sm text-muted mt-2">Your private task list — visible only to you.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAISynthesis}
            disabled={aiSynthesisLoading}
            className="flex items-center gap-2 border border-brand/40 text-brand hover:bg-brand hover:text-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {aiSynthesisLoading ? 'Generating...' : 'AI Synthesis'}
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Todo
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {[
          { label: 'Total', value: stats.total, color: '', filter: 'all' as const },
          { label: 'To Do', value: stats.todo, color: '', filter: 'todo' as const },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600 dark:text-blue-400', filter: 'in_progress' as const },
          { label: 'Blocked', value: stats.blocked, color: 'text-red-600 dark:text-red-400', filter: 'blocked' as const },
          { label: 'Done', value: stats.done, color: 'text-emerald-600 dark:text-emerald-400', filter: 'done' as const },
          { label: 'Due Today', value: stats.dueToday, color: 'text-amber-600 dark:text-amber-400', filter: null as null },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-700 dark:text-red-400 font-black', filter: null as null },
        ].map(stat => (
          <button
            key={stat.label}
            onClick={() => stat.filter && setFilterStatus(filterStatus === stat.filter ? 'all' : stat.filter)}
            className={`surface border p-3 text-center transition-all hover:border-brand ${stat.filter && filterStatus === stat.filter ? 'border-brand bg-brand/5' : ''}`}
          >
            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="label-xs">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Active / Archived tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-ink-700">
        <button
          onClick={() => setViewTab('active')}
          className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] -mb-px border-b-2 transition-colors ${viewTab === 'active' ? 'text-brand border-brand' : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'}`}
        >
          Active
        </button>
        <button
          onClick={() => setViewTab('archived')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] -mb-px border-b-2 transition-colors ${viewTab === 'archived' ? 'text-brand border-brand' : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          Archived
          {todos.filter(t => t.isArchived).length > 0 && (
            <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.5">
              {todos.filter(t => t.isArchived).length}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <div className="surface border border-neutral-200 dark:border-ink-700 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search todos..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-600 text-sm outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)} className="p-2 bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-600 text-sm">
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={filterPlanningFor} onChange={e => setFilterPlanningFor(e.target.value)} className="p-2 bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-600 text-sm">
          <option value="all">All Schedules</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
          <option value="this_quarter">This Quarter</option>
          <option value="this_year">This Year</option>
          <option value="tbd">TBD</option>
        </select>

        <div className="flex items-center overflow-hidden border border-neutral-200 dark:border-ink-600">
          {([['due_date', 'Due Date'], ['priority', 'Priority'], ['created', 'Created'], ['title', 'Title']] as [typeof sortBy, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${sortBy === field ? 'bg-brand text-white' : 'text-muted hover:bg-neutral-100 dark:hover:bg-ink-700'}`}
            >
              {label} <SortIcon field={field} />
            </button>
          ))}
        </div>

        {viewTab === 'active' && (
          <div className="flex items-center overflow-hidden border border-neutral-200 dark:border-ink-600">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-brand text-white' : 'text-muted hover:bg-neutral-100 dark:hover:bg-ink-700'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`p-2 transition-colors ${viewMode === 'matrix' ? 'bg-brand text-white' : 'text-muted hover:bg-neutral-100 dark:hover:bg-ink-700'}`}
              title="Eisenhower matrix"
            >
              <Brain className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-300 dark:border-ink-600">
          <CheckCircle2 className="w-10 h-10 text-muted mb-4" />
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] mb-2">No todos yet</h3>
          <p className="text-xs text-muted mb-6">Create your first task manually.</p>
          <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors">
            <Plus className="w-4 h-4" /> New Todo
          </button>
        </div>
      ) : viewTab === 'active' && viewMode === 'matrix' ? (
        <EisenhowerMatrixView todos={filtered} onTodoClick={setSelectedTodo} />
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted border border-dashed border-neutral-300 dark:border-ink-600">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{viewTab === 'archived' ? 'No archived todos.' : 'No todos match your filters.'}</p>
            </div>
          ) : (
            filtered.map(todo => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onClick={() => setSelectedTodo(todo)}
                onStatusToggle={s => handleStatusChange(todo, s)}
                onDelete={() => handleDelete(todo.id)}
                onArchiveToggle={() => handleArchiveToggle(todo)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
