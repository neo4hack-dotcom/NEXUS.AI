/**
 * DataFeedsView — Data Feeds / Silver-Copy pipeline registry.
 *
 * Access: admin + users with the `isIT` flag (G5 group).
 *
 * Each feed tracks one data pipeline from a source system to a silver-copy
 * / data-warehouse table, with full project metadata (PM, dev, JIRA, cost,
 * ETA, presentation link) and a status lifecycle.
 */

import React, { useState, useMemo } from 'react';
import {
  DatabaseZap,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ExternalLink,
  ArrowRight,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Clock4,
  User as UserIcon,
  Code2,
  Ticket,
  Banknote,
  MessageSquare,
  Presentation,
  CheckCircle2,
} from 'lucide-react';
import { AppState, DataFeed, DataFeedFrequency, DataFeedStatus, User } from '../../types';
import { generateId } from '../../services/storage';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   Constants / helpers
   ────────────────────────────────────────────────────────────────────────── */

const FREQUENCY_LABELS: Record<DataFeedFrequency, string> = {
  realtime:  'Realtime',
  hourly:    'Hourly',
  daily:     'Daily',
  weekly:    'Weekly',
  monthly:   'Monthly',
  on_demand: 'On demand',
  other:     'Other',
};

const STATUS_META: Record<DataFeedStatus, { label: string; color: string }> = {
  planned:    { label: 'Planned',    color: 'bg-neutral-200 text-neutral-700 dark:bg-ink-600 dark:text-neutral-300' },
  in_dev:     { label: 'In Dev',     color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  uat:        { label: 'UAT',        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  production: { label: 'Production', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  deprecated: { label: 'Deprecated', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

const EMPTY_FEED = (): Omit<DataFeed, 'id' | 'createdAt' | 'updatedAt'> => ({
  platformName: '',
  dataType: '',
  frequency: 'daily',
  source: '',
  destination: '',
  status: 'planned',
  prodDate: '',
  jiraRef: '',
  costManDays: undefined,
  eta: '',
  comments: '',
  projectManager: '',
  developer: '',
  presentationUrl: '',
});

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ──────────────────────────────────────────────────────────────────────────
   Main view
   ────────────────────────────────────────────────────────────────────────── */

export const DataFeedsView: React.FC<Props> = ({ state, currentUser, update }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DataFeedStatus | 'all'>('all');
  const [modalFeed, setModalFeed] = useState<DataFeed | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const feeds = state.dataFeeds ?? [];

  const filtered = useMemo(() => {
    return feeds.filter((f) => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.platformName.toLowerCase().includes(q) ||
          f.dataType.toLowerCase().includes(q) ||
          f.source.toLowerCase().includes(q) ||
          f.destination.toLowerCase().includes(q) ||
          (f.projectManager ?? '').toLowerCase().includes(q) ||
          (f.developer ?? '').toLowerCase().includes(q) ||
          (f.jiraRef ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [feeds, search, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: feeds.length,
    prod: feeds.filter((f) => f.status === 'production').length,
    inDev: feeds.filter((f) => f.status === 'in_dev' || f.status === 'uat').length,
    planned: feeds.filter((f) => f.status === 'planned').length,
    totalCost: feeds.reduce((acc, f) => acc + (f.costManDays ?? 0), 0),
  }), [feeds]);

  const openNew = () => {
    const now = new Date().toISOString();
    setModalFeed({ ...EMPTY_FEED(), id: generateId(), createdAt: now, updatedAt: now });
    setIsNew(true);
  };

  const openEdit = (f: DataFeed) => {
    setModalFeed({ ...f });
    setIsNew(false);
  };

  const deleteFeed = (id: string) => {
    if (!window.confirm('Delete this data feed? This action cannot be undone.')) return;
    update((s) => ({ ...s, dataFeeds: (s.dataFeeds ?? []).filter((f) => f.id !== id) }));
    if (expandedId === id) setExpandedId(null);
  };

  const saveFeed = (feed: DataFeed) => {
    const now = new Date().toISOString();
    const saved = { ...feed, updatedAt: now };
    update((s) => ({
      ...s,
      dataFeeds: isNew
        ? [...(s.dataFeeds ?? []), saved]
        : (s.dataFeeds ?? []).map((f) => (f.id === saved.id ? saved : f)),
    }));
    setModalFeed(null);
  };

  const canEdit = currentUser.role === 'admin' || currentUser.isIT;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">Data Platform</p>
          <h1 className="display-xl flex items-center gap-3">
            <DatabaseZap className="w-7 h-7 text-brand" />
            Data Feeds
          </h1>
          <p className="text-sm text-muted mt-1">
            Registre des pipelines de données vers les entrepôts (silver copies).
            Visible aux admins et utilisateurs avec le flag IT.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-[11px] font-bold uppercase tracking-[0.16em] hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Feed
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total feeds', value: stats.total, color: 'text-neutral-900 dark:text-white' },
          { label: 'Production', value: stats.prod, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'In dev / UAT', value: stats.inDev, color: 'text-sky-600 dark:text-sky-400' },
          { label: 'Planned', value: stats.planned, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total cost (MD)', value: stats.totalCost > 0 ? `${stats.totalCost} MD` : '—', color: 'text-brand' },
        ].map((kpi) => (
          <div key={kpi.label} className="surface border p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-1">{kpi.label}</p>
            <p className={`text-2xl font-black tracking-tight ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platform, type, source, PM, dev…"
            className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted" />
          {(['all', ...Object.keys(STATUS_META)] as (DataFeedStatus | 'all')[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                statusFilter === s
                  ? 'bg-brand text-white border-brand'
                  : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="surface border border-dashed p-16 text-center">
          <DatabaseZap className="w-10 h-10 mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted">
            {feeds.length === 0
              ? 'No data feeds yet. Click "Add Feed" to register the first pipeline.'
              : 'No feeds match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="surface border overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr_auto] gap-0 border-b border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800">
            {['Platform / Type', 'Source → Destination', 'Frequency', 'PM / Developer', 'Status', 'Prod / ETA', ''].map((h, i) => (
              <div key={i} className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
                {h}
              </div>
            ))}
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-ink-700">
            {filtered.map((f) => {
              const expanded = expandedId === f.id;
              const meta = STATUS_META[f.status];
              return (
                <div key={f.id}>
                  {/* Main row */}
                  <div
                    className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr_auto] gap-0 hover:bg-neutral-50 dark:hover:bg-ink-800/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : f.id)}
                  >
                    {/* Platform / Type */}
                    <div className="px-4 py-3 flex flex-col justify-center">
                      <p className="text-[12px] font-bold uppercase tracking-tight truncate">{f.platformName}</p>
                      <p className="text-[10px] text-muted font-mono truncate">{f.dataType}</p>
                    </div>

                    {/* Source → Destination */}
                    <div className="px-4 py-3 flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-muted truncate flex-1">{f.source}</span>
                      <ArrowRight className="w-3 h-3 text-brand shrink-0" />
                      <span className="text-[10px] font-bold truncate flex-1 text-right">{f.destination}</span>
                    </div>

                    {/* Frequency */}
                    <div className="px-4 py-3 flex items-center">
                      <span className="text-[10px] font-mono text-muted">{FREQUENCY_LABELS[f.frequency]}</span>
                    </div>

                    {/* PM / Dev */}
                    <div className="px-4 py-3 flex flex-col justify-center gap-0.5">
                      {f.projectManager && (
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-muted shrink-0" />
                          <span className="text-[10px] truncate">{f.projectManager}</span>
                        </div>
                      )}
                      {f.developer && (
                        <div className="flex items-center gap-1">
                          <Code2 className="w-3 h-3 text-muted shrink-0" />
                          <span className="text-[10px] text-muted truncate">{f.developer}</span>
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="px-4 py-3 flex items-center">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Prod / ETA */}
                    <div className="px-4 py-3 flex flex-col justify-center gap-0.5">
                      {f.prodDate ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-[10px] font-mono">{fmt(f.prodDate)}</span>
                        </div>
                      ) : f.eta ? (
                        <div className="flex items-center gap-1">
                          <Clock4 className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">{fmt(f.eta)}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted">—</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-3 py-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => openEdit(f)}
                            className="w-7 h-7 flex items-center justify-center text-muted hover:text-brand transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteFeed(f.id)}
                            className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedId(expanded ? null : f.id)}
                        className="w-7 h-7 flex items-center justify-center text-muted hover:text-brand transition-colors"
                        title={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {expanded && (
                    <div className="px-6 py-4 bg-neutral-50 dark:bg-ink-800/50 border-t border-neutral-200 dark:border-ink-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* JIRA + Cost */}
                      <div className="space-y-2">
                        {f.jiraRef && (
                          <div className="flex items-start gap-2">
                            <Ticket className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">JIRA Ref</p>
                              <p className="text-[11px] font-mono">{f.jiraRef}</p>
                            </div>
                          </div>
                        )}
                        {f.costManDays !== undefined && f.costManDays > 0 && (
                          <div className="flex items-start gap-2">
                            <Banknote className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Cost</p>
                              <p className="text-[11px] font-mono">{f.costManDays} Man-Days</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="space-y-2">
                        {f.prodDate && (
                          <div className="flex items-start gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Mise en production</p>
                              <p className="text-[11px] font-mono">{fmt(f.prodDate)}</p>
                            </div>
                          </div>
                        )}
                        {f.eta && !f.prodDate && (
                          <div className="flex items-start gap-2">
                            <Clock4 className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">ETA</p>
                              <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400">{fmt(f.eta)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Presentation + Comments */}
                      <div className="space-y-2">
                        {f.presentationUrl && (
                          <div className="flex items-start gap-2">
                            <Presentation className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Présentation</p>
                              <a
                                href={f.presentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-brand hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Ouvrir <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}
                        {f.comments && (
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Commentaires</p>
                              <p className="text-[11px] text-muted whitespace-pre-wrap">{f.comments}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalFeed && (
        <FeedModal
          feed={modalFeed}
          isNew={isNew}
          onSave={saveFeed}
          onClose={() => setModalFeed(null)}
        />
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Create / Edit modal
   ────────────────────────────────────────────────────────────────────────── */

const FeedModal: React.FC<{
  feed: DataFeed;
  isNew: boolean;
  onSave: (f: DataFeed) => void;
  onClose: () => void;
}> = ({ feed, isNew, onSave, onClose }) => {
  const [form, setForm] = useState<DataFeed>(feed);
  const set = <K extends keyof DataFeed>(k: K, v: DataFeed[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const valid = form.platformName.trim() && form.source.trim() && form.destination.trim();

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const inputCls =
    'w-full h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1';
  const textareaCls =
    'w-full px-3 py-2 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors resize-none';

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl mb-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <DatabaseZap className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
              {isNew ? 'New Data Feed' : 'Edit Data Feed'}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">

          {/* ── Identification ── */}
          <Section title="Identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Platform name *">
                <input className={inputCls} value={form.platformName} onChange={(e) => set('platformName', e.target.value)} placeholder="ex: Salesforce, SAP, Kafka…" autoFocus />
              </Field>
              <Field label="Data type *">
                <input className={inputCls} value={form.dataType} onChange={(e) => set('dataType', e.target.value)} placeholder="ex: CRM events, Finance ledger…" />
              </Field>
              <Field label="Frequency">
                <select
                  className={inputCls}
                  value={form.frequency}
                  onChange={(e) => set('frequency', e.target.value as DataFeedFrequency)}
                >
                  {(Object.entries(FREQUENCY_LABELS) as [DataFeedFrequency, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={inputCls}
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as DataFeedStatus)}
                >
                  {(Object.entries(STATUS_META) as [DataFeedStatus, { label: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Pipeline ── */}
          <Section title="Pipeline">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Source (point de départ) *">
                <input className={inputCls} value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="ex: PostgreSQL prod, Salesforce API…" />
              </Field>
              <Field label="Destination / Silver copy *">
                <input className={inputCls} value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="ex: DWH.silver.crm_events" />
              </Field>
            </div>
          </Section>

          {/* ── Project ── */}
          <Section title="Projet">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project Manager">
                <input className={inputCls} value={form.projectManager ?? ''} onChange={(e) => set('projectManager', e.target.value)} placeholder="Nom du PM" />
              </Field>
              <Field label="Développeur">
                <input className={inputCls} value={form.developer ?? ''} onChange={(e) => set('developer', e.target.value)} placeholder="Nom du dev" />
              </Field>
              <Field label="JIRA Ref">
                <input className={inputCls} value={form.jiraRef ?? ''} onChange={(e) => set('jiraRef', e.target.value)} placeholder="ex: DAT-1234" />
              </Field>
              <Field label="Coût (Man-Days)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={inputCls}
                  value={form.costManDays ?? ''}
                  onChange={(e) => set('costManDays', e.target.value === '' ? undefined : Number(e.target.value))}
                  placeholder="0"
                />
              </Field>
            </div>
          </Section>

          {/* ── Dates ── */}
          <Section title="Dates">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date de mise en production">
                <input type="date" className={inputCls} value={form.prodDate ?? ''} onChange={(e) => set('prodDate', e.target.value)} />
              </Field>
              <Field label="ETA (si pas encore en prod)">
                <input type="date" className={inputCls} value={form.eta ?? ''} onChange={(e) => set('eta', e.target.value)} disabled={!!form.prodDate} />
                {form.prodDate && (
                  <p className="text-[9px] text-muted mt-0.5">ETA non applicable — déjà en production.</p>
                )}
              </Field>
            </div>
          </Section>

          {/* ── Documentation ── */}
          <Section title="Documentation">
            <div className="space-y-4">
              <Field label="Lien présentation">
                <div className="relative">
                  <input className={inputCls + ' pr-8'} value={form.presentationUrl ?? ''} onChange={(e) => set('presentationUrl', e.target.value)} placeholder="https://…" />
                  {form.presentationUrl && (
                    <a
                      href={form.presentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-y-0 right-2 flex items-center text-brand hover:text-brand/80"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </Field>
              <Field label="Commentaires">
                <textarea
                  rows={3}
                  className={textareaCls}
                  value={form.comments ?? ''}
                  onChange={(e) => set('comments', e.target.value)}
                  placeholder="Notes, contexte, points de vigilance…"
                />
              </Field>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 justify-end px-6 py-4 border-t border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
          <button
            onClick={onClose}
            className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-neutral-600 dark:text-ink-300 hover:border-neutral-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            className="flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            {isNew ? 'Create Feed' : 'Save Changes'}
          </button>
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
    {children}
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
