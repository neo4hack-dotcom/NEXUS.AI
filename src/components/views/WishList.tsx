/**
 * WishList — collective backlog of needs and ideas.
 *
 * Access: every signed-in user (group = 'public').
 *
 * Anyone can:
 *  • submit a new wish (project, MCP, agent, data feed, feature, integration…)
 *  • view all wishes
 *  • comment on any wish
 *
 * Only the requester or an admin can:
 *  • edit the wish content
 *  • change its status (triage workflow)
 *  • delete the wish
 *
 * Wishes cross-link to existing entities (project, MCP server, agent) so a
 * wish "I need an MCP for system X" can later be promoted to a real MCP card.
 */

import React, { useState, useMemo } from 'react';
import {
  Lightbulb,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Search,
  Filter,
  MessageSquare,
  Send,
  CalendarDays,
  Tag,
  User as UserIcon,
  ExternalLink,
  Award,
  Target,
  Plug,
  Bot,
  DatabaseZap,
  Sparkles,
  Workflow,
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Hourglass,
  Inbox,
} from 'lucide-react';
import {
  AppState,
  User,
  WishItem,
  WishCategory,
  WishStatus,
  WishPriority,
  WishComment,
} from '../../types';
import { generateId } from '../../services/storage';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────────────── */

const CATEGORY_META: Record<WishCategory, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  project:     { label: 'Project',     icon: Target,      color: 'text-violet-600 dark:text-violet-400' },
  mcp:         { label: 'MCP Server',  icon: Plug,        color: 'text-cyan-600 dark:text-cyan-400' },
  agent:       { label: 'AI Agent',    icon: Bot,         color: 'text-fuchsia-600 dark:text-fuchsia-400' },
  datafeed:    { label: 'Data Feed',   icon: DatabaseZap, color: 'text-emerald-600 dark:text-emerald-400' },
  feature:     { label: 'Feature',     icon: Sparkles,    color: 'text-amber-600 dark:text-amber-400' },
  integration: { label: 'Integration', icon: Workflow,    color: 'text-sky-600 dark:text-sky-400' },
  other:       { label: 'Other',       icon: HelpCircle,  color: 'text-neutral-500' },
};

const STATUS_META: Record<WishStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  submitted:    { label: 'Submitted',    icon: Inbox,        color: 'bg-neutral-100 text-neutral-700 dark:bg-ink-700 dark:text-neutral-300' },
  under_review: { label: 'Under Review', icon: Hourglass,    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  accepted:     { label: 'Accepted',     icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  in_progress:  { label: 'In Progress',  icon: Clock,        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  done:         { label: 'Done',         icon: CheckCircle2, color: 'bg-brand/15 text-brand' },
  rejected:     { label: 'Rejected',     icon: XCircle,      color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  on_hold:      { label: 'On Hold',      icon: PauseCircle,  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

const PRIORITY_META: Record<WishPriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-neutral-500' },
  medium: { label: 'Medium', color: 'text-sky-600' },
  high:   { label: 'High',   color: 'text-amber-600' },
  urgent: { label: 'Urgent', color: 'text-red-600' },
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtRelative = (iso?: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1)   return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const blankWish = (currentUserId: string): WishItem => {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: '',
    description: '',
    category: 'feature',
    requesterId: currentUserId,
    status: 'submitted',
    priority: 'medium',
    comments: [],
    tags: [],
    externalLinks: [],
    createdAt: now,
    updatedAt: now,
  };
};

/* ──────────────────────────────────────────────────────────────────────────
   Main view
   ────────────────────────────────────────────────────────────────────────── */

export const WishList: React.FC<Props> = ({ state, currentUser, update }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WishStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<WishCategory | 'all'>('all');
  const [mineOnly, setMineOnly] = useState(false);

  const [modalWish, setModalWish] = useState<WishItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const wishes = state.wishes ?? [];

  const filtered = useMemo(() => {
    const sorted = [...wishes].sort((a, b) => {
      // Order by status (active first), then priority, then date
      const statusOrder: WishStatus[] = ['in_progress', 'accepted', 'under_review', 'submitted', 'on_hold', 'done', 'rejected'];
      const sa = statusOrder.indexOf(a.status);
      const sb = statusOrder.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      const prioOrder: WishPriority[] = ['urgent', 'high', 'medium', 'low'];
      const pa = prioOrder.indexOf(a.priority);
      const pb = prioOrder.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted.filter((w) => {
      if (mineOnly && w.requesterId !== currentUser.id) return false;
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.title.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          (w.businessJustification ?? '').toLowerCase().includes(q) ||
          (w.sponsorName ?? '').toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [wishes, mineOnly, statusFilter, categoryFilter, search, currentUser.id]);

  const stats = useMemo(() => ({
    total:       wishes.length,
    submitted:   wishes.filter((w) => w.status === 'submitted').length,
    accepted:    wishes.filter((w) => w.status === 'accepted').length,
    inProgress:  wishes.filter((w) => w.status === 'in_progress').length,
    done:        wishes.filter((w) => w.status === 'done').length,
  }), [wishes]);

  const userLookup = useMemo(() => {
    const m = new Map<string, User>();
    state.users.forEach((u) => m.set(u.id, u));
    return m;
  }, [state.users]);

  const openNew = () => {
    setModalWish(blankWish(currentUser.id));
    setIsNew(true);
  };

  const openEdit = (w: WishItem) => {
    setModalWish({ ...w });
    setIsNew(false);
  };

  const saveWish = (w: WishItem) => {
    const now = new Date().toISOString();
    const saved = { ...w, updatedAt: now };
    update((s) => ({
      ...s,
      wishes: isNew
        ? [...(s.wishes ?? []), saved]
        : (s.wishes ?? []).map((x) => (x.id === saved.id ? saved : x)),
    }));
    setModalWish(null);
  };

  const deleteWish = (id: string) => {
    if (!window.confirm('Delete this wish? This action cannot be undone.')) return;
    update((s) => ({ ...s, wishes: (s.wishes ?? []).filter((w) => w.id !== id) }));
  };

  const addComment = (wishId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newComment: WishComment = {
      id: generateId(),
      authorUserId: currentUser.id,
      authorName: `${currentUser.firstName} ${currentUser.lastName}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    update((s) => ({
      ...s,
      wishes: (s.wishes ?? []).map((w) =>
        w.id === wishId
          ? { ...w, comments: [...(w.comments ?? []), newComment], updatedAt: new Date().toISOString() }
          : w
      ),
    }));
    // Reflect locally so the modal stays in sync
    setModalWish((curr) =>
      curr && curr.id === wishId
        ? { ...curr, comments: [...(curr.comments ?? []), newComment] }
        : curr
    );
  };

  const canEditWish = (w: WishItem) => currentUser.role === 'admin' || w.requesterId === currentUser.id;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">Collective Backlog</p>
          <h1 className="display-xl flex items-center gap-3">
            <Lightbulb className="w-7 h-7 text-brand" />
            Wish List
          </h1>
          <p className="text-sm text-muted mt-1">
            Soumettez et documentez vos besoins — un nouveau projet, un MCP, un agent IA,
            un data feed, une intégration… Chaque souhait est suivi avec un sponsor et des dates.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-[11px] font-bold uppercase tracking-[0.16em] hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Submit a wish
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total wishes', value: stats.total,      color: 'text-neutral-900 dark:text-white' },
          { label: 'Submitted',    value: stats.submitted,  color: 'text-neutral-600 dark:text-neutral-400' },
          { label: 'Accepted',     value: stats.accepted,   color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'In progress',  value: stats.inProgress, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Done',         value: stats.done,       color: 'text-brand' },
        ].map((kpi) => (
          <div key={kpi.label} className="surface border p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-1">{kpi.label}</p>
            <p className={`text-2xl font-black tracking-tight ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, description, sponsor, tag…"
              className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          <button
            onClick={() => setMineOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${
              mineOnly
                ? 'bg-brand text-white border-brand'
                : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            My wishes
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted mr-1" />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mr-2">Status</span>
          {(['all', ...Object.keys(STATUS_META)] as (WishStatus | 'all')[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                statusFilter === s
                  ? 'bg-brand text-white border-brand'
                  : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-muted mr-1" />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mr-2">Category</span>
          {(['all', ...Object.keys(CATEGORY_META)] as (WishCategory | 'all')[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                categoryFilter === c
                  ? 'bg-brand text-white border-brand'
                  : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'
              }`}
            >
              {c === 'all' ? 'All' : CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      </div>

      {/* Wish grid */}
      {filtered.length === 0 ? (
        <div className="surface border border-dashed p-16 text-center">
          <Lightbulb className="w-10 h-10 mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted">
            {wishes.length === 0
              ? 'No wishes yet. Be the first to submit one — share an idea, ask for an MCP, request a data feed…'
              : 'No wishes match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => {
            const cat = CATEGORY_META[w.category];
            const stat = STATUS_META[w.status];
            const requester = userLookup.get(w.requesterId);
            const sponsor = w.sponsorId ? userLookup.get(w.sponsorId) : null;
            const sponsorLabel = sponsor
              ? `${sponsor.firstName} ${sponsor.lastName}`
              : (w.sponsorName || null);
            const CatIcon = cat.icon;
            const StatIcon = stat.icon;
            const editable = canEditWish(w);

            return (
              <button
                key={w.id}
                onClick={() => openEdit(w)}
                className="surface border p-4 flex flex-col gap-3 text-left hover:border-brand transition-colors group"
              >
                {/* Top: category + status */}
                <div className="flex items-center justify-between gap-2">
                  <div className={`flex items-center gap-1.5 ${cat.color}`}>
                    <CatIcon className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em]">
                      {cat.label}
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${stat.color}`}>
                    <StatIcon className="w-2.5 h-2.5" />
                    {stat.label}
                  </span>
                </div>

                {/* Title + description */}
                <div>
                  <h3 className="text-sm font-bold tracking-tight leading-snug mb-1 group-hover:text-brand transition-colors line-clamp-2">
                    {w.title || <span className="text-muted italic">Untitled wish</span>}
                  </h3>
                  {w.description && (
                    <p className="text-[11px] text-muted line-clamp-3">{w.description}</p>
                  )}
                </div>

                {/* Tags */}
                {w.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {w.tags.slice(0, 4).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.1em] border border-neutral-300 dark:border-ink-600 text-muted">
                        {t}
                      </span>
                    ))}
                    {w.tags.length > 4 && (
                      <span className="text-[8px] text-muted">+{w.tags.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Footer: meta */}
                <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-ink-700 space-y-1.5">
                  {/* Priority + wishedDate */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`flex items-center gap-1 font-bold uppercase tracking-[0.12em] ${PRIORITY_META[w.priority].color}`}>
                      <TrendingUp className="w-3 h-3" />
                      {PRIORITY_META[w.priority].label}
                    </span>
                    {w.wishedDate && (
                      <span className="flex items-center gap-1 text-muted font-mono">
                        <CalendarDays className="w-3 h-3" />
                        {fmtDate(w.wishedDate)}
                      </span>
                    )}
                  </div>

                  {/* Sponsor + comments */}
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="flex items-center gap-1 truncate">
                      {sponsorLabel ? (
                        <>
                          <Award className="w-3 h-3 shrink-0" />
                          <span className="truncate">{sponsorLabel}</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3 h-3 shrink-0 opacity-40" />
                          <span className="italic opacity-60">No sponsor</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <MessageSquare className="w-3 h-3" />
                      {w.comments.length}
                    </span>
                  </div>

                  {/* Requester + relative date */}
                  <div className="flex items-center justify-between text-[9px] text-muted font-mono">
                    <span>{requester ? `${requester.firstName} ${requester.lastName}` : '—'}</span>
                    <span>{fmtRelative(w.createdAt)}</span>
                  </div>
                </div>

                {/* Quick actions */}
                {editable && (
                  <div className="flex items-center gap-1 -mb-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(w); }}
                      className="w-7 h-7 flex items-center justify-center text-muted hover:text-brand transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWish(w.id); }}
                      className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalWish && (
        <WishModal
          wish={modalWish}
          isNew={isNew}
          currentUser={currentUser}
          state={state}
          onSave={saveWish}
          onDelete={!isNew && canEditWish(modalWish) ? () => { deleteWish(modalWish.id); setModalWish(null); } : undefined}
          onClose={() => setModalWish(null)}
          onAddComment={(txt) => addComment(modalWish.id, txt)}
          readOnly={!isNew && !canEditWish(modalWish)}
        />
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Create / Edit modal
   ────────────────────────────────────────────────────────────────────────── */

const WishModal: React.FC<{
  wish: WishItem;
  isNew: boolean;
  currentUser: User;
  state: AppState;
  readOnly: boolean;
  onSave: (w: WishItem) => void;
  onDelete?: () => void;
  onClose: () => void;
  onAddComment: (text: string) => void;
}> = ({ wish, isNew, currentUser, state, readOnly, onSave, onDelete, onClose, onAddComment }) => {
  const [form, setForm] = useState<WishItem>(wish);
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newLink, setNewLink] = useState('');

  const set = <K extends keyof WishItem>(k: K, v: WishItem[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const valid = form.title.trim().length >= 3 && form.description.trim().length >= 5;

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  // Sync local form when comments change externally (via onAddComment)
  React.useEffect(() => {
    setForm((curr) => ({ ...curr, comments: wish.comments }));
  }, [wish.comments]);

  const inputCls =
    'w-full h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const textareaCls =
    'w-full px-3 py-2 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors resize-none disabled:opacity-60';

  const addTag = () => {
    const t = newTag.trim();
    if (!t || form.tags.includes(t)) return;
    set('tags', [...form.tags, t]);
    setNewTag('');
  };
  const removeTag = (t: string) => set('tags', form.tags.filter((x) => x !== t));

  const addLink = () => {
    const l = newLink.trim();
    if (!l || (form.externalLinks ?? []).includes(l)) return;
    set('externalLinks', [...(form.externalLinks ?? []), l]);
    setNewLink('');
  };
  const removeLink = (l: string) => set('externalLinks', (form.externalLinks ?? []).filter((x) => x !== l));

  // Related entity options depend on category
  const relatedOptions = useMemo(() => {
    switch (form.category) {
      case 'project': return state.projects.map((p) => ({ id: p.id, label: p.name }));
      case 'mcp':     return state.mcpServers.map((m) => ({ id: m.id, label: m.name }));
      case 'agent':   return state.agents.map((a) => ({ id: a.id, label: a.name }));
      default:        return [];
    }
  }, [form.category, state]);

  const relatedKey: keyof WishItem | null =
    form.category === 'project' ? 'relatedProjectId'
    : form.category === 'mcp'   ? 'relatedMcpServerId'
    : form.category === 'agent' ? 'relatedAgentId'
    : null;

  const CatIcon = CATEGORY_META[form.category].icon;
  const requester = state.users.find((u) => u.id === form.requesterId);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl mb-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Lightbulb className="w-4 h-4 text-brand shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] truncate">
              {isNew ? 'Submit a new wish' : readOnly ? 'View wish' : 'Edit wish'}
            </span>
            {!isNew && (
              <span className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${STATUS_META[form.status].color}`}>
                {STATUS_META[form.status].label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">

          {/* The wish */}
          <Section title="Le besoin">
            <Field label="Title *">
              <input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="ex: MCP pour Salesforce" disabled={readOnly} autoFocus />
            </Field>
            <Field label="Description *">
              <textarea rows={4} className={textareaCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Explain the need — what's the situation, what's missing, what should be possible?" disabled={readOnly} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category">
                <div className="relative">
                  <select className={inputCls + ' pl-9'} value={form.category} onChange={(e) => set('category', e.target.value as WishCategory)} disabled={readOnly}>
                    {(Object.entries(CATEGORY_META) as [WishCategory, { label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <CatIcon className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${CATEGORY_META[form.category].color} pointer-events-none`} />
                </div>
              </Field>
              <Field label="Priority">
                <select className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value as WishPriority)} disabled={readOnly}>
                  {(Object.entries(PRIORITY_META) as [WishPriority, { label: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            {relatedKey && relatedOptions.length > 0 && (
              <Field label={`Related ${CATEGORY_META[form.category].label} (optional)`}>
                <select
                  className={inputCls}
                  value={(form[relatedKey] as string) ?? ''}
                  onChange={(e) => set(relatedKey as 'relatedProjectId', e.target.value || undefined)}
                  disabled={readOnly}
                >
                  <option value="">— None —</option>
                  {relatedOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </Field>
            )}
          </Section>

          {/* Justification */}
          <Section title="Justification & impact">
            <Field label="Business justification">
              <textarea rows={2} className={textareaCls} value={form.businessJustification ?? ''} onChange={(e) => set('businessJustification', e.target.value)} placeholder="Why does this matter? What problem does it solve?" disabled={readOnly} />
            </Field>
            <Field label="Expected impact / benefits">
              <textarea rows={2} className={textareaCls} value={form.expectedImpact ?? ''} onChange={(e) => set('expectedImpact', e.target.value)} placeholder="ex: 2 FTE saved/year, faster onboarding, new revenue stream…" disabled={readOnly} />
            </Field>
          </Section>

          {/* Sponsor & dates */}
          <Section title="Sponsor & dates">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sponsor (internal — pick a user)">
                <select className={inputCls} value={form.sponsorId ?? ''} onChange={(e) => set('sponsorId', e.target.value || undefined)} disabled={readOnly}>
                  <option value="">— None / external —</option>
                  {state.users
                    .slice()
                    .sort((a, b) => a.lastName.localeCompare(b.lastName))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} {u.team ? `· ${u.team}` : ''}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Sponsor (free text)">
                <input className={inputCls} value={form.sponsorName ?? ''} onChange={(e) => set('sponsorName', e.target.value)} placeholder="External name (used if no internal sponsor selected)" disabled={readOnly} />
              </Field>
              <Field label="Wished delivery date">
                <input type="date" className={inputCls} value={form.wishedDate ?? ''} onChange={(e) => set('wishedDate', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Submitted by">
                <input className={inputCls} value={requester ? `${requester.firstName} ${requester.lastName}` : '—'} disabled />
              </Field>
            </div>
          </Section>

          {/* Triage (admin/owner) */}
          {!isNew && (
            <Section title="Triage / Status">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Status">
                  <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as WishStatus)} disabled={readOnly}>
                    {(Object.entries(STATUS_META) as [WishStatus, { label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Decided on">
                  <input type="date" className={inputCls} value={form.decidedAt ?? ''} onChange={(e) => set('decidedAt', e.target.value)} disabled={readOnly} />
                </Field>
              </div>
              <Field label="Review notes">
                <textarea rows={2} className={textareaCls} value={form.reviewNotes ?? ''} onChange={(e) => set('reviewNotes', e.target.value)} placeholder="Decision rationale, scoping notes, next steps…" disabled={readOnly} />
              </Field>
            </Section>
          )}

          {/* Tags */}
          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] border border-neutral-300 dark:border-ink-600">
                  {t}
                  {!readOnly && (
                    <button onClick={() => removeTag(t)} className="hover:text-red-500">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Add a tag and press Enter"
                  className={inputCls}
                />
                <button onClick={addTag} className="px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors">
                  Add
                </button>
              </div>
            )}
          </Section>

          {/* External links */}
          <Section title="External links">
            <div className="space-y-1.5 mb-2">
              {(form.externalLinks ?? []).map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <a href={l} target="_blank" rel="noopener noreferrer" className="flex-1 text-[11px] text-brand hover:underline truncate flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {l}
                  </a>
                  {!readOnly && (
                    <button onClick={() => removeLink(l)} className="w-6 h-6 flex items-center justify-center text-muted hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                  placeholder="https:// — Confluence, JIRA, doc…"
                  className={inputCls}
                />
                <button onClick={addLink} className="px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors">
                  Add
                </button>
              </div>
            )}
          </Section>

          {/* Comments */}
          {!isNew && (
            <Section title={`Comments (${form.comments.length})`}>
              <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                {form.comments.length === 0 ? (
                  <p className="text-[11px] text-muted italic">No comments yet. Be the first to add context.</p>
                ) : (
                  form.comments.map((c) => (
                    <div key={c.id} className="border border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{c.authorName}</span>
                        <span className="text-[9px] font-mono text-muted">{fmtRelative(c.createdAt)}</span>
                      </div>
                      <p className="text-[11px] whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim()) { onAddComment(newComment); setNewComment(''); }
                    }
                  }}
                  placeholder={`Add a comment as ${currentUser.firstName}…`}
                  className={inputCls}
                />
                <button
                  onClick={() => { if (newComment.trim()) { onAddComment(newComment); setNewComment(''); } }}
                  disabled={!newComment.trim()}
                  className="flex items-center gap-1 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 justify-between items-center px-6 py-4 border-t border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
          <div>
            {!isNew && onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] text-red-500 border border-red-400/40 hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-neutral-600 dark:text-ink-300 hover:border-neutral-400 transition-colors"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                onClick={() => valid && onSave(form)}
                disabled={!valid}
                className="flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                {isNew ? 'Submit wish' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* Tiny layout helpers */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted border-b border-neutral-200 dark:border-ink-700 pb-1.5 mb-3">
      {title}
    </p>
    <div className="space-y-4">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">
      {label}
    </label>
    {children}
  </div>
);
