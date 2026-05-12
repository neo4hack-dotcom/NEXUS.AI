import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Zap, Plus, ArrowLeft, Users, FileText, MessageSquare, Trophy, Eye,
  Trash2, X, Save, Sparkles, Loader2, Send, BookOpen, Presentation,
  Award, File, Tag, MapPin, Calendar, Edit3, Check, FileDown,
} from 'lucide-react';
import { MarkdownView } from '../ui/MarkdownView';
import {
  AppState, Hackathon, HackathonDocument, HackathonDocType,
  HackathonMessage, HackathonParticipant, HackathonRole, HackathonStatus, User,
} from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { DEFAULT_PROMPTS, fillTemplate, runPrompt } from '../../services/llmService';
import { exportHackathonCandidatePDF } from '../../services/exports';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

/* ── constants ────────────────────────────────────────────────── */

const STATUS_META: Record<HackathonStatus, { label: string; color: string; bg: string }> = {
  upcoming: { label: 'Upcoming', color: '#3b82f6', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  active:   { label: 'Live',     color: '#FF3E00', bg: 'bg-brand/10 text-brand border-brand/30' },
  completed:{ label: 'Done',     color: '#22c55e', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  archived: { label: 'Archived', color: '#94a3b8', bg: 'bg-neutral-400/10 text-muted border-neutral-300' },
};

const ROLE_META: Record<HackathonRole, { label: string; color: string; dot: string }> = {
  dev:      { label: 'Dev',      color: '#3b82f6', dot: 'bg-blue-500' },
  sme:      { label: 'SME',      color: '#f97316', dot: 'bg-orange-500' },
  expert:   { label: 'Expert',   color: '#8b5cf6', dot: 'bg-violet-500' },
  pm:       { label: 'PM',       color: '#22c55e', dot: 'bg-emerald-500' },
  designer: { label: 'Designer', color: '#ec4899', dot: 'bg-pink-500' },
  other:    { label: 'Other',    color: '#94a3b8', dot: 'bg-neutral-400' },
};

const DOC_META: Record<HackathonDocType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  brief:        { icon: FileText,     color: '#3b82f6' },
  guide:        { icon: BookOpen,     color: '#22c55e' },
  result:       { icon: Award,        color: '#FF3E00' },
  presentation: { icon: Presentation, color: '#8b5cf6' },
  resource:     { icon: File,         color: '#f97316' },
  other:        { icon: File,         color: '#94a3b8' },
};

/* ── helpers ──────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');

const useNow = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const countdown = (targetMs: number, nowMs: number) => {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
  };
};

const progress = (startDate: string, endDate: string, nowMs: number) => {
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  if (nowMs < s) return 0;
  if (nowMs > e) return 100;
  return Math.round(((nowMs - s) / (e - s)) * 100);
};

const newHackathon = (): Hackathon => ({
  id: generateId(),
  title: 'New Hackathon',
  theme: '',
  objective: '',
  status: 'upcoming',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
  participants: [],
  documents: [],
  messages: [],
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/* ══════════════════════════════════════════════════════════════
   Main view
══════════════════════════════════════════════════════════════ */

export const HackathonsView: React.FC<Props> = ({ state, currentUser, update }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | HackathonStatus>('all');
  const canManage = currentUser.role === 'admin' || currentUser.role === 'manager';

  const hackathon = selected ? state.hackathons.find((h) => h.id === selected) ?? null : null;

  const upsert = (h: Hackathon) =>
    update((s) => ({
      ...s,
      hackathons: s.hackathons.some((x) => x.id === h.id)
        ? s.hackathons.map((x) => (x.id === h.id ? h : x))
        : [...s.hackathons, h],
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, hackathons: s.hackathons.filter((x) => x.id !== id) }));

  if (hackathon) {
    return (
      <HackathonDetail
        hackathon={hackathon}
        currentUser={currentUser}
        canManage={canManage}
        state={state}
        onBack={() => setSelected(null)}
        onUpdate={upsert}
        onDelete={() => { remove(hackathon.id); setSelected(null); }}
      />
    );
  }

  const filtered = state.hackathons.filter(
    (h) => filter === 'all' || h.status === filter
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Innovation</p>
          <h1 className="display-xl">Hackathons</h1>
          <p className="text-sm text-muted mt-2">
            AI sprint sessions — invite devs, SMEs, and experts to solve real challenges.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              const h = newHackathon();
              upsert(h);
              setSelected(h.id);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-ink-600">
        {(['all', 'upcoming', 'active', 'completed', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] -mb-px border-b-2 transition-colors ${
              filter === f
                ? 'text-brand border-brand'
                : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_META[f].label}
            {f !== 'all' && (
              <span className="ml-1.5 text-[8px]">
                {state.hackathons.filter((h) => h.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-neutral-300 dark:border-ink-500 py-20 text-center">
          <Zap className="w-10 h-10 mx-auto text-muted opacity-30 mb-3" />
          <p className="text-sm text-muted uppercase tracking-[0.16em]">
            {filter === 'all' ? 'No hackathon sessions yet.' : `No ${STATUS_META[filter as HackathonStatus].label.toLowerCase()} sessions.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((h) => (
            <HackathonCard
              key={h.id}
              hackathon={h}
              onClick={() => setSelected(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Card ─────────────────────────────────────────────────────── */

const HackathonCard: React.FC<{ hackathon: Hackathon; onClick: () => void }> = ({ hackathon: h, onClick }) => {
  const now = useNow();
  const meta = STATUS_META[h.status];
  const isActive = h.status === 'active';
  const isUpcoming = h.status === 'upcoming';
  const pct = progress(h.startDate, h.endDate, now);
  const target = isUpcoming ? new Date(h.startDate).getTime() : new Date(h.endDate).getTime();
  const cd = (isActive || isUpcoming) ? countdown(target, now) : null;

  // Role distribution dots
  const roleCounts = h.participants.reduce<Record<HackathonRole, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {} as Record<HackathonRole, number>);

  return (
    <button
      onClick={onClick}
      className="surface border text-left hover:border-brand transition-all group overflow-hidden"
      style={{ borderTop: `3px solid ${meta.color}` }}
    >
      {/* Status + countdown */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <span className={`text-[8px] font-bold uppercase tracking-[0.18em] border px-2 py-0.5 ${meta.bg}`}>
          {meta.label}
        </span>
        {cd && (
          <div className="text-right">
            <p className="text-[9px] text-muted uppercase tracking-[0.1em]">
              {isUpcoming ? 'starts in' : 'ends in'}
            </p>
            <p className={`text-[11px] font-mono font-bold ${isActive ? 'text-brand' : 'text-neutral-600 dark:text-neutral-300'}`}>
              {cd.d > 0 ? `${cd.d}d ` : ''}{pad(cd.h)}:{pad(cd.m)}:{pad(cd.s)}
            </p>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <h3 className="text-lg font-black uppercase tracking-tight leading-tight line-clamp-2 group-hover:text-brand transition-colors">
          {h.title}
        </h3>
        {h.theme && (
          <p className="text-[10px] text-muted mt-1 uppercase tracking-[0.1em]">{h.theme}</p>
        )}
      </div>

      {/* Progress bar (active only) */}
      {isActive && (
        <div className="px-5 pb-3">
          <div className="flex justify-between text-[9px] text-muted mb-1">
            <span>{new Date(h.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <span className="text-brand font-bold">{pct}%</span>
            <span>{new Date(h.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </div>
          <div className="h-1.5 bg-neutral-200 dark:bg-ink-700 overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Role dots */}
          {(Object.entries(roleCounts) as [HackathonRole, number][]).map(([role, count]) => (
            <div key={role} className="flex items-center gap-0.5" title={ROLE_META[role].label}>
              {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full ${ROLE_META[role].dot}`} />
              ))}
              {count > 3 && <span className="text-[8px] text-muted">+{count - 3}</span>}
            </div>
          ))}
          {h.participants.length === 0 && (
            <span className="text-[9px] text-muted">No participants yet</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted">
          <span>{h.documents.length} docs</span>
          <span>·</span>
          <span>{h.messages.length} msgs</span>
        </div>
      </div>
    </button>
  );
};

/* ══════════════════════════════════════════════════════════════
   Detail view
══════════════════════════════════════════════════════════════ */

type DetailTab = 'overview' | 'participants' | 'documents' | 'messages' | 'results';

const HackathonDetail: React.FC<{
  hackathon: Hackathon;
  currentUser: User;
  canManage: boolean;
  state: AppState;
  onBack: () => void;
  onUpdate: (h: Hackathon) => void;
  onDelete: () => void;
}> = ({ hackathon, currentUser, canManage, state, onBack, onUpdate, onDelete }) => {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = useNow();

  const meta = STATUS_META[hackathon.status];
  const isActive = hackathon.status === 'active';
  const isUpcoming = hackathon.status === 'upcoming';
  const pct = progress(hackathon.startDate, hackathon.endDate, now);
  const target = isUpcoming ? new Date(hackathon.startDate).getTime() : new Date(hackathon.endDate).getTime();
  const cd = (isActive || isUpcoming) ? countdown(target, now) : null;

  const tabs: { id: DetailTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'participants', label: 'Participants', icon: Users, count: hackathon.participants.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: hackathon.documents.length },
    { id: 'messages', label: 'Board', icon: MessageSquare, count: hackathon.messages.length },
    { id: 'results', label: 'Results', icon: Trophy },
  ];

  return (
    <div className="space-y-0 max-w-7xl mx-auto animate-fade-in">
      {/* Back + delete */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted hover:text-brand transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All sessions
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportHackathonCandidatePDF(hackathon, state)}>
            <FileDown className="w-3 h-3 mr-1" />
            Candidate Kit PDF
          </Button>
          {canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Edit3 className="w-3 h-3 mr-1" />
                Edit
              </Button>
              {confirmDelete ? (
                <>
                  <span className="text-[10px] text-red-500 uppercase tracking-[0.1em]">Confirm?</span>
                  <Button size="sm" variant="danger" onClick={onDelete}>Yes, delete</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hero header */}
      <div
        className="surface border overflow-hidden mb-4"
        style={{ borderTop: `4px solid ${meta.color}` }}
      >
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-[8px] font-bold uppercase tracking-[0.18em] border px-2.5 py-1 ${meta.bg}`}>
                  {meta.label}
                </span>
                {hackathon.location && (
                  <span className="flex items-center gap-1 text-[9px] text-muted uppercase tracking-[0.1em]">
                    <MapPin className="w-3 h-3" />{hackathon.location}
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight leading-tight mb-2">
                {hackathon.title}
              </h2>
              {hackathon.theme && (
                <p className="text-sm text-muted uppercase tracking-[0.1em] mb-3">{hackathon.theme}</p>
              )}
              <p className="text-sm leading-relaxed max-w-2xl">{hackathon.objective}</p>

              {/* Tags */}
              {hackathon.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {hackathon.tags.map((t) => (
                    <span key={t} className="text-[9px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 bg-brand/10 text-brand border border-brand/20">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Dates */}
              <div className="flex items-center gap-4 mt-4 text-[10px] text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(hackathon.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span>→</span>
                <span>{new Date(hackathon.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Countdown / stats */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              {cd ? (
                <div className="text-center border border-neutral-200 dark:border-ink-600 p-4 min-w-[160px]">
                  <p className="text-[8px] uppercase tracking-[0.18em] text-muted mb-2">
                    {isUpcoming ? 'Starts in' : 'Ends in'}
                  </p>
                  <div className="flex items-end gap-1 justify-center">
                    {cd.d > 0 && (
                      <div className="text-center">
                        <div className="text-3xl font-black font-mono leading-none" style={{ color: meta.color }}>{cd.d}</div>
                        <div className="text-[7px] text-muted uppercase tracking-[0.12em] mt-0.5">days</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-3xl font-black font-mono leading-none" style={{ color: meta.color }}>{pad(cd.h)}</div>
                      <div className="text-[7px] text-muted uppercase tracking-[0.12em] mt-0.5">hrs</div>
                    </div>
                    <div className="text-2xl font-black text-muted -mb-1">:</div>
                    <div className="text-center">
                      <div className="text-3xl font-black font-mono leading-none" style={{ color: meta.color }}>{pad(cd.m)}</div>
                      <div className="text-[7px] text-muted uppercase tracking-[0.12em] mt-0.5">min</div>
                    </div>
                    <div className="text-2xl font-black text-muted -mb-1">:</div>
                    <div className="text-center">
                      <div className="text-3xl font-black font-mono leading-none tabular-nums" style={{ color: meta.color }}>{pad(cd.s)}</div>
                      <div className="text-[7px] text-muted uppercase tracking-[0.12em] mt-0.5">sec</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center border border-neutral-200 dark:border-ink-600 p-4 min-w-[120px]">
                  <div className="text-3xl font-black" style={{ color: meta.color }}>{hackathon.participants.length}</div>
                  <div className="text-[8px] text-muted uppercase tracking-[0.14em] mt-1">Participants</div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline bar for active */}
          {isActive && (
            <div className="mt-5">
              <div className="flex justify-between text-[9px] text-muted mb-1.5">
                <span>{new Date(hackathon.startDate).toLocaleDateString()}</span>
                <span className="font-bold text-brand">{pct}% complete</span>
                <span>{new Date(hackathon.endDate).toLocaleDateString()}</span>
              </div>
              <div className="h-2 bg-neutral-200 dark:bg-ink-700 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pct}%`, background: meta.color }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-t border-neutral-200 dark:border-ink-600 px-4">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] -mb-px border-b-2 transition-colors ${
                tab === id
                  ? 'text-brand border-brand'
                  : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${tab === id ? 'bg-brand text-white' : 'bg-neutral-200 dark:bg-ink-700'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview' && <OverviewTab hackathon={hackathon} />}
        {tab === 'participants' && (
          <ParticipantsTab hackathon={hackathon} canManage={canManage} onUpdate={onUpdate} />
        )}
        {tab === 'documents' && (
          <DocumentsTab hackathon={hackathon} currentUser={currentUser} canManage={canManage} onUpdate={onUpdate} />
        )}
        {tab === 'messages' && (
          <MessagesTab hackathon={hackathon} currentUser={currentUser} onUpdate={onUpdate} />
        )}
        {tab === 'results' && (
          <ResultsTab hackathon={hackathon} canManage={canManage} state={state} onUpdate={onUpdate} />
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <HackathonEditor
          hackathon={hackathon}
          onSave={(h) => { onUpdate(h); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
};

/* ── Overview tab ─────────────────────────────────────────────── */

const OverviewTab: React.FC<{ hackathon: Hackathon }> = ({ hackathon: h }) => {
  const roleGroups = h.participants.reduce<Record<HackathonRole, HackathonParticipant[]>>(
    (acc, p) => { (acc[p.role] = acc[p.role] || []).push(p); return acc; },
    {} as Record<HackathonRole, HackathonParticipant[]>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main info */}
      <div className="lg:col-span-2 space-y-4">
        {h.challenge && (
          <div className="surface border p-5">
            <p className="label-xs mb-2">Challenge</p>
            <p className="text-sm leading-relaxed">{h.challenge}</p>
          </div>
        )}

        <div className="surface border p-5">
          <p className="label-xs mb-3">Team Composition</p>
          {h.participants.length === 0 ? (
            <p className="text-sm text-muted">No participants yet.</p>
          ) : (
            <div className="space-y-3">
              {(Object.entries(roleGroups) as [HackathonRole, HackathonParticipant[]][]).map(([role, members]) => (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-2 h-2 rounded-full ${ROLE_META[role].dot}`} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: ROLE_META[role].color }}>
                      {ROLE_META[role].label} ({members.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {members.map((m) => (
                      <span key={m.id} className="text-[10px] font-mono px-2 py-0.5 surface-flat border">
                        {m.name}
                        {m.expertise && <span className="text-muted ml-1">· {m.expertise}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="space-y-3">
        {[
          { label: 'Participants', value: h.participants.length, color: '#3b82f6' },
          { label: 'Documents', value: h.documents.length, color: '#8b5cf6' },
          { label: 'Messages', value: h.messages.length, color: '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} className="surface border p-4" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="text-3xl font-black" style={{ color }}>{value}</div>
            <div className="text-[10px] text-muted uppercase tracking-[0.14em] mt-1">{label}</div>
          </div>
        ))}
        {h.tags.length > 0 && (
          <div className="surface border p-4">
            <p className="label-xs mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {h.tags.map((t) => (
                <Badge key={t} tone="muted">{t}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Participants tab ─────────────────────────────────────────── */

const ParticipantsTab: React.FC<{
  hackathon: Hackathon;
  canManage: boolean;
  onUpdate: (h: Hackathon) => void;
}> = ({ hackathon, canManage, onUpdate }) => {
  const [roleFilter, setRoleFilter] = useState<HackathonRole | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<HackathonParticipant>({
    id: generateId(), name: '', role: 'dev', email: '', team: '', expertise: '',
  });

  const visible = roleFilter === 'all'
    ? hackathon.participants
    : hackathon.participants.filter((p) => p.role === roleFilter);

  const addParticipant = () => {
    if (!draft.name.trim()) return;
    onUpdate({
      ...hackathon,
      participants: [...hackathon.participants, { ...draft, id: generateId() }],
      updatedAt: new Date().toISOString(),
    });
    setDraft({ id: generateId(), name: '', role: 'dev', email: '', team: '', expertise: '' });
    setAdding(false);
  };

  const removeParticipant = (id: string) =>
    onUpdate({ ...hackathon, participants: hackathon.participants.filter((p) => p.id !== id), updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['all', 'dev', 'sme', 'expert', 'pm', 'designer', 'other'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                roleFilter === r
                  ? 'bg-brand text-white border-brand'
                  : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand'
              }`}
            >
              {r === 'all' ? 'All' : ROLE_META[r].label}
            </button>
          ))}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="surface border p-4 space-y-3">
          <p className="label-xs">New Participant</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="label-xs">Name *</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <label className="label-xs">Role</label>
              <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as HackathonRole })}>
                {(Object.keys(ROLE_META) as HackathonRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="label-xs">Team</label>
              <Input value={draft.team || ''} onChange={(e) => setDraft({ ...draft, team: e.target.value })} placeholder="Team Alpha" />
            </div>
            <div className="space-y-1">
              <label className="label-xs">Expertise</label>
              <Input value={draft.expertise || ''} onChange={(e) => setDraft({ ...draft, expertise: e.target.value })} placeholder="NLP, Computer Vision…" />
            </div>
            <div className="space-y-1">
              <label className="label-xs">Email</label>
              <Input value={draft.email || ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@company.com" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={addParticipant} disabled={!draft.name.trim()}>
              <Check className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Participant grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((p) => {
          const rm = ROLE_META[p.role];
          return (
            <div
              key={p.id}
              className="surface border p-4 group"
              style={{ borderLeft: `4px solid ${rm.color}` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black uppercase tracking-tight">{p.name}</p>
                  {p.team && <p className="text-[10px] text-muted mt-0.5">{p.team}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[8px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 border"
                    style={{ color: rm.color, borderColor: `${rm.color}40`, background: `${rm.color}10` }}
                  >
                    {rm.label}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {p.expertise && (
                <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />{p.expertise}
                </p>
              )}
              {p.email && (
                <p className="text-[10px] font-mono text-muted mt-1">{p.email}</p>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="md:col-span-3 text-center text-sm text-muted py-12">No participants in this category.</p>
        )}
      </div>
    </div>
  );
};

/* ── Documents tab ────────────────────────────────────────────── */

const DocumentsTab: React.FC<{
  hackathon: Hackathon;
  currentUser: User;
  canManage: boolean;
  onUpdate: (h: Hackathon) => void;
}> = ({ hackathon, currentUser, canManage, onUpdate }) => {
  const [editing, setEditing] = useState<HackathonDocument | null>(null);

  const upsertDoc = (doc: HackathonDocument) =>
    onUpdate({
      ...hackathon,
      documents: hackathon.documents.some((d) => d.id === doc.id)
        ? hackathon.documents.map((d) => (d.id === doc.id ? doc : d))
        : [...hackathon.documents, doc],
      updatedAt: new Date().toISOString(),
    });

  const removeDoc = (id: string) =>
    onUpdate({ ...hackathon, documents: hackathon.documents.filter((d) => d.id !== id), updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            onClick={() => setEditing({
              id: generateId(), title: 'New Document', type: 'brief',
              content: '', authorId: currentUser.id,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            })}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Document
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {hackathon.documents.map((doc) => {
          const dm = DOC_META[doc.type];
          const Icon = dm.icon;
          return (
            <button
              key={doc.id}
              onClick={() => setEditing(doc)}
              className="surface border text-left hover:border-brand transition-colors group"
              style={{ borderLeft: `4px solid ${dm.color}` }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: dm.color }}><Icon className="w-4 h-4" /></span>
                    <span className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: dm.color }}>
                      {doc.type}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                </div>
                <p className="font-black uppercase tracking-tight">{doc.title}</p>
                <p className="text-xs text-muted mt-1.5 line-clamp-2">{doc.content || 'Empty document.'}</p>
              </div>
            </button>
          );
        })}
        {hackathon.documents.length === 0 && (
          <p className="lg:col-span-2 text-center text-sm text-muted py-12">No documents yet.</p>
        )}
      </div>

      {editing && (
        <DocEditor
          doc={editing}
          canManage={canManage}
          onSave={(d) => { upsertDoc(d); setEditing(null); }}
          onDelete={(id) => { removeDoc(id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

const DocEditor: React.FC<{
  doc: HackathonDocument;
  canManage: boolean;
  onSave: (d: HackathonDocument) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}> = ({ doc, canManage, onSave, onDelete, onClose }) => {
  const [d, setD] = useState(doc);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h3 className="font-black uppercase tracking-tight">Document</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="label-xs">Title</label>
              <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="label-xs">Type</label>
              <Select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as HackathonDocType })}>
                {(Object.keys(DOC_META) as HackathonDocType[]).map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="label-xs">Content (Markdown supported)</label>
            <Textarea
              value={d.content}
              onChange={(e) => setD({ ...d, content: e.target.value })}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Write in Markdown…"
            />
          </div>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between">
          {canManage ? (
            <Button variant="danger" onClick={() => onDelete(d.id)}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ ...d, updatedAt: new Date().toISOString() })}>
              <Save className="w-4 h-4 mr-2" />Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Messages tab ─────────────────────────────────────────────── */

const MessagesTab: React.FC<{
  hackathon: Hackathon;
  currentUser: User;
  onUpdate: (h: Hackathon) => void;
}> = ({ hackathon, currentUser, onUpdate }) => {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const post = () => {
    if (!text.trim()) return;
    const msg: HackathonMessage = {
      id: generateId(),
      authorId: currentUser.id,
      authorName: `${currentUser.firstName} ${currentUser.lastName}`,
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    onUpdate({ ...hackathon, messages: [...hackathon.messages, msg], updatedAt: new Date().toISOString() });
    setText('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="surface border flex flex-col max-h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
        {hackathon.messages.length === 0 && (
          <p className="text-center text-sm text-muted py-12">No messages yet. Start the conversation!</p>
        )}
        {hackathon.messages.map((m) => {
          const isMe = m.authorId === currentUser.id;
          const initials = m.authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: isMe ? '#FF3E00' : '#3b82f6' }}
              >
                {initials}
              </div>
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-3 py-2 text-sm ${isMe ? 'bg-brand text-white' : 'surface-flat border'}`}>
                  {m.content}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] text-muted">{m.authorName}</span>
                  <span className="text-[8px] text-muted">·</span>
                  <span className="text-[9px] text-muted">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-neutral-200 dark:border-ink-600 p-3 flex gap-2">
        <input
          className="flex-1 bg-transparent border border-neutral-300 dark:border-ink-500 px-3 py-2 text-sm focus:outline-none focus:border-brand"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
        />
        <Button onClick={post} disabled={!text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

/* ── Results tab ──────────────────────────────────────────────── */

const ResultsTab: React.FC<{
  hackathon: Hackathon;
  canManage: boolean;
  state: AppState;
  onUpdate: (h: Hackathon) => void;
}> = ({ hackathon, canManage, state, onUpdate }) => {
  const [editingResults, setEditingResults] = useState(false);
  const [draft, setDraft] = useState(hackathon.results || '');
  const [aiLoading, setAiLoading] = useState(false);

  const buildData = () => {
    const lines = [
      `HACKATHON: ${hackathon.title}`,
      `THEME: ${hackathon.theme}`,
      `OBJECTIVE: ${hackathon.objective}`,
      hackathon.challenge ? `CHALLENGE: ${hackathon.challenge}` : '',
      `DATES: ${hackathon.startDate} → ${hackathon.endDate}`,
      `PARTICIPANTS (${hackathon.participants.length}):`,
      ...hackathon.participants.map((p) => `  - ${p.name} [${p.role}]${p.expertise ? ` — ${p.expertise}` : ''}`),
      '',
      `DOCUMENTS (${hackathon.documents.length}):`,
      ...hackathon.documents.map((d) => `  [${d.type.toUpperCase()}] ${d.title}: ${d.content.slice(0, 300)}`),
      '',
      `RESULTS: ${hackathon.results || '(none yet)'}`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  const synthesize = async () => {
    setAiLoading(true);
    try {
      const data = buildData();
      const tpl = state.prompts['hackathon_synthesis'] || DEFAULT_PROMPTS['hackathon_synthesis'];
      const out = await runPrompt(fillTemplate(tpl, { DATA: data }), state.llmConfig);
      onUpdate({ ...hackathon, aiSynthesis: out, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      onUpdate({ ...hackathon, aiSynthesis: `Error: ${e.message}`, updatedAt: new Date().toISOString() });
    } finally {
      setAiLoading(false);
    }
  };

  const saveResults = () => {
    onUpdate({ ...hackathon, results: draft, updatedAt: new Date().toISOString() });
    setEditingResults(false);
  };

  return (
    <div className="space-y-4">
      {/* Results section */}
      <div className="surface border">
        <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-brand" />
            <h3 className="font-black uppercase tracking-tight">Results & Outcomes</h3>
          </div>
          {canManage && !editingResults && (
            <Button size="sm" variant="outline" onClick={() => setEditingResults(true)}>
              <Edit3 className="w-3 h-3 mr-1" />
              {hackathon.results ? 'Edit' : 'Add Results'}
            </Button>
          )}
        </div>
        <div className="p-5">
          {editingResults ? (
            <div className="space-y-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="Describe the hackathon outcomes, deliverables, demos, scores…"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingResults(false)}>Cancel</Button>
                <Button onClick={saveResults}><Save className="w-4 h-4 mr-2" />Save</Button>
              </div>
            </div>
          ) : hackathon.results ? (
            <MarkdownView content={hackathon.results} />
          ) : (
            <p className="text-sm text-muted text-center py-8">No results recorded yet.</p>
          )}
        </div>
      </div>

      {/* AI Synthesis */}
      <div className="surface border">
        <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <div>
              <h3 className="font-black uppercase tracking-tight">AI Synthesis</h3>
              <p className="text-[9px] text-muted uppercase tracking-[0.14em]">
                Powered by {state.llmConfig.provider} · {state.llmConfig.model}
              </p>
            </div>
          </div>
          <Button onClick={synthesize} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {hackathon.aiSynthesis ? 'Regenerate' : 'Generate Synthesis'}
          </Button>
        </div>
        <div className="p-5">
          {aiLoading && (
            <div className="text-center py-10 space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-brand" />
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Analyzing hackathon data…</p>
            </div>
          )}
          {!aiLoading && hackathon.aiSynthesis && (
            <div className="surface-flat border p-4">
              <MarkdownView content={hackathon.aiSynthesis} />
            </div>
          )}
          {!aiLoading && !hackathon.aiSynthesis && (
            <div className="text-center py-10">
              <Sparkles className="w-10 h-10 mx-auto text-muted opacity-30 mb-3" />
              <p className="text-sm text-muted max-w-md mx-auto">
                Generate a full synthesis of this hackathon: deliverables, lessons learned, recommendations, and user guide — powered by your local LLM.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Editor modal ─────────────────────────────────────────────── */

const HackathonEditor: React.FC<{
  hackathon: Hackathon;
  onSave: (h: Hackathon) => void;
  onClose: () => void;
}> = ({ hackathon, onSave, onClose }) => {
  const [d, setD] = useState<Hackathon>(hackathon);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Edit Hackathon</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="label-xs">Title</label>
            <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Theme / focus area</label>
            <Input value={d.theme} onChange={(e) => setD({ ...d, theme: e.target.value })} placeholder="e.g. NLP & Conversational AI" />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Objective</label>
            <Textarea value={d.objective} onChange={(e) => setD({ ...d, objective: e.target.value })} placeholder="What should participants achieve?" />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Challenge (optional)</label>
            <Textarea value={d.challenge || ''} onChange={(e) => setD({ ...d, challenge: e.target.value })} placeholder="Specific problem statement or constraints…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="label-xs">Status</label>
              <Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as HackathonStatus })}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active / Live</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Location (optional)</label>
              <Input value={d.location || ''} onChange={(e) => setD({ ...d, location: e.target.value })} placeholder="Paris / Remote / Hybrid" />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Start date</label>
              <Input type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">End date</label>
              <Input type="date" value={d.endDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Tags (comma-separated)</label>
            <Input
              value={d.tags.join(', ')}
              onChange={(e) => setD({ ...d, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="AI, NLP, RAG, innovation…"
            />
          </div>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...d, updatedAt: new Date().toISOString() })}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
