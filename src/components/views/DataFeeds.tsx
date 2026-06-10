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
  Eye,
  Sparkles,
  BookOpen,
  Printer,
  Copy,
  Plug,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { AppState, DataFeed, DataFeedFrequency, DataFeedStatus, McpServer, LlmConfig, User } from '../../types';
import { generateId } from '../../services/storage';
import { runPrompt } from '../../services/llmService';

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
  mcpServerIds: [],
});

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ──────────────────────────────────────────────────────────────────────────
   Main view
   ────────────────────────────────────────────────────────────────────────── */

const buildDataFeedBookletHTML = (feeds: DataFeed[], mcpServers: McpServer[], summary?: string): string => {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const BRAND = '#FF3E00';
  const mcpName = (id: string) => mcpServers.find((m) => m.id === id)?.name;

  // KPIs
  const total = feeds.length;
  const prod  = feeds.filter((f) => f.status === 'production').length;
  const inDev = feeds.filter((f) => f.status === 'in_dev' || f.status === 'uat').length;
  const planned = feeds.filter((f) => f.status === 'planned').length;

  // Freq breakdown
  const freqMap: Record<string, number> = {};
  feeds.forEach((f) => { freqMap[FREQUENCY_LABELS[f.frequency]] = (freqMap[FREQUENCY_LABELS[f.frequency]] || 0) + 1; });
  const freqEntries = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
  const freqMax = Math.max(...freqEntries.map((e) => e[1]), 1);

  const freqBars = freqEntries.map(([label, n]) => {
    const pct = Math.round((n / freqMax) * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="width:70px;font-size:8pt;font-weight:700;color:#444;font-family:system-ui;text-transform:uppercase;letter-spacing:0.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</div>
      <div style="flex:1;background:#f1f5f9;height:12px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${BRAND}"></div></div>
      <div style="width:18px;font-size:9pt;font-weight:900;color:${BRAND};font-family:system-ui;text-align:right">${n}</div>
    </div>`;
  }).join('');

  const kpi = (label: string, value: number | string, color = BRAND) =>
    `<div style="border:1px solid #e5e7eb;border-top:3px solid ${color};padding:16px;background:#fff;min-width:120px">
      <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;font-family:system-ui;margin-bottom:6px">${esc(label)}</div>
      <div style="font-size:28pt;font-weight:900;color:${color};font-family:system-ui;line-height:1">${esc(value)}</div>
    </div>`;

  const statusColor: Record<DataFeedStatus, string> = {
    planned: '#6b7280', in_dev: '#3b82f6', uat: '#f59e0b', production: '#10b981', deprecated: '#ef4444',
  };

  const feedCards = feeds.map((f) => {
    const sColor = statusColor[f.status] || '#6b7280';
    const sLabel = STATUS_META[f.status]?.label ?? f.status;
    return `<div style="break-inside:avoid;border:1px solid #e5e7eb;border-left:4px solid ${BRAND};padding:18px;margin-bottom:16px;background:#fff;font-family:system-ui">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
        <div>
          <div style="font-size:14pt;font-weight:900;color:#111;text-transform:uppercase;letter-spacing:-0.02em">${esc(f.platformName)}</div>
          <div style="font-size:9pt;color:#666;margin-top:2px">${esc(f.dataType)}</div>
        </div>
        <span style="padding:3px 10px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;background:${sColor}20;color:${sColor};border:1px solid ${sColor}40;white-space:nowrap">${esc(sLabel)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f9fafb;margin-bottom:10px">
        <div style="flex:1"><span style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#888;display:block">Source</span><span style="font-size:9pt;font-family:monospace;color:#333">${esc(f.source) || '—'}</span></div>
        <span style="font-size:14pt;color:${BRAND}">→</span>
        <div style="flex:1;text-align:right"><span style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#888;display:block">Destination</span><span style="font-size:9pt;font-family:monospace;color:#333">${esc(f.destination) || '—'}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:8pt">
        <div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">Frequency</span><br><strong>${esc(FREQUENCY_LABELS[f.frequency])}</strong></div>
        ${f.projectManager ? `<div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">PM</span><br><strong>${esc(f.projectManager)}</strong></div>` : ''}
        ${f.developer ? `<div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">Developer</span><br><strong>${esc(f.developer)}</strong></div>` : ''}
        ${f.jiraRef ? `<div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">JIRA</span><br><strong style="font-family:monospace">${esc(f.jiraRef)}</strong></div>` : ''}
        ${f.costManDays ? `<div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">Cost</span><br><strong>${esc(f.costManDays)} MD</strong></div>` : ''}
        ${f.prodDate ? `<div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">Production date</span><br><strong style="color:#10b981">${esc(new Date(f.prodDate).toLocaleDateString('en-GB'))}</strong></div>` : ''}
        ${!f.prodDate && f.eta ? `<div><span style="color:#888;text-transform:uppercase;font-size:7pt;font-weight:700">ETA</span><br><strong style="color:#f59e0b">${esc(new Date(f.eta).toLocaleDateString('en-GB'))}</strong></div>` : ''}
      </div>
      ${(() => {
        const names = (f.mcpServerIds || []).map(mcpName).filter(Boolean) as string[];
        return names.length
          ? `<div style="margin-top:10px;padding:8px;background:#fff7f4;border-left:2px solid ${BRAND};font-size:8pt;color:#333"><span style="font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888">Consumed by MCP</span><br>${names.map((n) => `<span style="display:inline-block;margin:2px 4px 0 0;padding:2px 8px;background:${BRAND}15;color:${BRAND};font-weight:700">${esc(n)}</span>`).join('')}</div>`
          : '';
      })()}
      ${f.comments ? `<div style="margin-top:8px;padding:8px;background:#f9fafb;border-left:2px solid #e5e7eb;font-size:8pt;color:#555;font-style:italic">${esc(f.comments)}</div>` : ''}
      ${f.presentationUrl ? `<div style="margin-top:6px"><a href="${esc(f.presentationUrl)}" style="font-size:8pt;color:${BRAND};text-decoration:none">📎 View presentation →</a></div>` : ''}
    </div>`;
  }).join('');

  // LLM-generated executive narrative (optional). Rendered as simple paragraphs;
  // we strip any stray markdown fences so it embeds cleanly in the booklet.
  const summaryBlock = summary && summary.trim()
    ? `<div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid ${BRAND};padding:20px;margin-bottom:20px">
        <div style="font-size:8pt;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;color:${BRAND};margin-bottom:10px">Executive Summary</div>
        <div style="font-size:9.5pt;line-height:1.55;color:#333;white-space:pre-wrap">${esc(summary.replace(/```[a-z]*\n?|```/g, '').trim())}</div>
      </div>`
    : '';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DOINg.AI — Data Feeds Booklet</title>
<style>
  @media print{@page{size:A4;margin:18mm}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#f8f8f6;color:#111;margin:0;padding:20px}
  h1,h2{margin:0}
</style>
</head><body>
<div style="max-width:800px;margin:0 auto">

  <!-- Cover -->
  <div style="background:#050505;color:#fff;padding:40px;margin-bottom:20px">
    <div style="font-size:8pt;letter-spacing:0.25em;text-transform:uppercase;color:${BRAND};margin-bottom:12px">DATA PLATFORM · BOOKLET · ${esc(today.toUpperCase())}</div>
    <div style="font-size:38pt;font-weight:900;letter-spacing:-0.03em;line-height:1">DOINg<span style="color:${BRAND}">.AI</span></div>
    <div style="font-size:18pt;font-weight:300;color:#aaa;margin-top:4px">Data Feeds Registry</div>
  </div>

  <!-- KPIs -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
    ${kpi('Total feeds', total)}
    ${kpi('In production', prod, '#10b981')}
    ${kpi('In dev / UAT', inDev, '#3b82f6')}
    ${kpi('Planned', planned, '#f59e0b')}
  </div>

  ${summaryBlock}

  <!-- Frequency chart -->
  <div style="background:#fff;border:1px solid #e5e7eb;padding:20px;margin-bottom:20px">
    <div style="font-size:8pt;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;color:#888;margin-bottom:12px">Refresh frequency breakdown</div>
    ${freqBars}
  </div>

  <!-- Feed cards -->
  <div style="font-size:8pt;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;color:#888;margin-bottom:12px">${total} data feed${total !== 1 ? 's' : ''}</div>
  ${feedCards}

  <!-- Footer -->
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:7pt;color:#888;text-align:right">
    DOINg.AI · Generated ${esc(today)} · Confidential
  </div>
</div>
</body></html>`;

  return html;
};

export const DataFeedsView: React.FC<Props> = ({ state, currentUser, update }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DataFeedStatus | 'all'>('all');
  const [modalFeed, setModalFeed] = useState<DataFeed | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewFeed, setPreviewFeed] = useState<DataFeed | null>(null);
  const [showBooklet, setShowBooklet] = useState(false);

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
            Data pipeline registry — from source systems to silver copies &amp; data warehouses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBooklet(true)}
            disabled={feeds.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] border border-brand text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-40"
            title="Build a shareable AI Booklet for board communication"
          >
            <Sparkles className="w-4 h-4" />
            AI Booklet
          </button>
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
                <div key={f.id} onDoubleClick={() => setPreviewFeed(f)} className="cursor-default">
                  {/* Main row — double-click opens read-only preview */}
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
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Production date</p>
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
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Presentation</p>
                              <a
                                href={f.presentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-brand hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}
                        {f.comments && (
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Comments</p>
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
      {previewFeed && (
        <FeedPreviewModal
          feed={previewFeed}
          mcpServers={state.mcpServers ?? []}
          onClose={() => setPreviewFeed(null)}
          onEdit={canEdit ? () => { setPreviewFeed(null); openEdit(previewFeed); } : undefined}
        />
      )}

      {modalFeed && (
        <FeedModal
          feed={modalFeed}
          isNew={isNew}
          mcpServers={state.mcpServers ?? []}
          onSave={saveFeed}
          onClose={() => setModalFeed(null)}
        />
      )}

      {showBooklet && (
        <BookletModal
          feeds={feeds}
          mcpServers={state.mcpServers ?? []}
          llmConfig={state.llmConfig}
          onClose={() => setShowBooklet(false)}
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
  mcpServers: McpServer[];
  onSave: (f: DataFeed) => void;
  onClose: () => void;
}> = ({ feed, isNew, mcpServers, onSave, onClose }) => {
  const [form, setForm] = useState<DataFeed>(feed);
  const set = <K extends keyof DataFeed>(k: K, v: DataFeed[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));
  const toggleMcp = (id: string) => {
    const cur = form.mcpServerIds || [];
    set('mcpServerIds', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

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
          <Section title="Project">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project Manager">
                <input className={inputCls} value={form.projectManager ?? ''} onChange={(e) => set('projectManager', e.target.value)} placeholder="PM name" />
              </Field>
              <Field label="Developer">
                <input className={inputCls} value={form.developer ?? ''} onChange={(e) => set('developer', e.target.value)} placeholder="Dev name" />
              </Field>
              <Field label="JIRA Ref">
                <input className={inputCls} value={form.jiraRef ?? ''} onChange={(e) => set('jiraRef', e.target.value)} placeholder="ex: DAT-1234" />
              </Field>
              <Field label="Cost (Man-Days)">
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
              <Field label="Production date">
                <input type="date" className={inputCls} value={form.prodDate ?? ''} onChange={(e) => set('prodDate', e.target.value)} />
              </Field>
              <Field label="ETA (if not yet in production)">
                <input type="date" className={inputCls} value={form.eta ?? ''} onChange={(e) => set('eta', e.target.value)} disabled={!!form.prodDate} />
                {form.prodDate && (
                  <p className="text-[9px] text-muted mt-0.5">ETA not applicable — already in production.</p>
                )}
              </Field>
            </div>
          </Section>

          {/* ── Documentation ── */}
          <Section title="Documentation">
            <div className="space-y-4">
              <Field label="Presentation link">
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
              <Field label="Comments">
                <textarea
                  rows={3}
                  className={textareaCls}
                  value={form.comments ?? ''}
                  onChange={(e) => set('comments', e.target.value)}
                  placeholder="Notes, context, watch points…"
                />
              </Field>
            </div>
          </Section>

          {/* ── Consumers ── */}
          <Section title="Consuming MCP servers">
            <p className="text-[10px] text-muted mb-2">Link the MCP servers that benefit from this feed's availability.</p>
            {mcpServers.length === 0 ? (
              <p className="text-[11px] text-muted italic">No MCP servers in the catalog yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {mcpServers.map((m) => {
                  const on = (form.mcpServerIds || []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMcp(m.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                        on
                          ? 'bg-brand text-white border-brand'
                          : 'border-neutral-300 dark:border-ink-600 text-muted hover:border-brand hover:text-brand'
                      }`}
                    >
                      <Plug className="w-3 h-3" /> {m.name}
                    </button>
                  );
                })}
              </div>
            )}
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

/* ──────────────────────────────────────────────────────────────────────────
   AI Booklet — selectable feeds, LLM narrative, in-app preview (no auto-print),
   with Print / Copy / Open-to-share actions for board communication.
   ────────────────────────────────────────────────────────────────────────── */

const BookletModal: React.FC<{
  feeds: DataFeed[];
  mcpServers: McpServer[];
  llmConfig: LlmConfig;
  onClose: () => void;
}> = ({ feeds, mcpServers, llmConfig, onClose }) => {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(feeds.map((f) => f.id)));
  const [stage, setStage] = useState<'select' | 'preview'>('select');
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState('');
  const [copied, setCopied] = useState(false);

  const chosen = useMemo(() => feeds.filter((f) => selected.has(f.id)), [feeds, selected]);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(feeds.map((f) => f.id)));
  const selectNone = () => setSelected(new Set());

  const buildDataBlock = (): string => {
    const lines: string[] = [];
    chosen.forEach((f) => {
      const mcps = (f.mcpServerIds || [])
        .map((id) => mcpServers.find((m) => m.id === id)?.name)
        .filter(Boolean);
      lines.push(
        `- ${f.platformName} | type=${f.dataType || 'n/a'} | status=${STATUS_META[f.status]?.label ?? f.status} | freq=${FREQUENCY_LABELS[f.frequency]} | ${f.source || '?'} → ${f.destination || '?'}` +
        (f.prodDate ? ` | prod=${f.prodDate.slice(0, 10)}` : f.eta ? ` | eta=${f.eta.slice(0, 10)}` : '') +
        (f.costManDays ? ` | cost=${f.costManDays}MD` : '') +
        (mcps.length ? ` | consumed by MCP: ${mcps.join(', ')}` : '')
      );
    });
    return lines.join('\n');
  };

  const generate = async () => {
    setLoading(true);
    setStage('preview');
    setHtml('');
    let summary = '';
    const prod = chosen.filter((f) => f.status === 'production').length;
    const prompt = `You are DOINg.AI, an executive data-platform analyst. Write a concise, professional executive summary (in English, 120-180 words, plain prose, no markdown, no headings) describing the state of the company's data feed portfolio for a board communication.
There are ${chosen.length} feeds in scope, ${prod} already in production.
Describe overall maturity, delivery momentum, what is live vs upcoming, notable dependencies (which MCP servers rely on which feeds), and any risks or recommendations. Be specific and reference platform names. Do not invent data beyond what is provided.

FEEDS:
${buildDataBlock()}`;
    try {
      summary = await runPrompt(prompt, llmConfig);
    } catch {
      summary = '';
    }
    setHtml(buildDataFeedBookletHTML(chosen, mcpServers, summary));
    setLoading(false);
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };
  const openInTab = () => {
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };
  const copyHtml = async () => {
    try { await navigator.clipboard.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl h-[88vh] flex flex-col bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">AI Booklet — Data Feeds</span>
          </div>
          <div className="flex items-center gap-2">
            {stage === 'preview' && !loading && (
              <>
                <button onClick={() => setStage('select')} className="px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-muted hover:border-brand hover:text-brand transition-colors">
                  ← Back
                </button>
                <button onClick={copyHtml} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors">
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy HTML'}
                </button>
                <button onClick={openInTab} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Open / Send
                </button>
                <button onClick={print} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {stage === 'select' ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold">Choose the feeds to include</p>
                <p className="text-[11px] text-muted mt-0.5">{selected.size} of {feeds.length} selected · a local-LLM executive summary will be generated.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="px-3 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors">Select all</button>
                <button onClick={selectNone} className="px-3 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors">Select none</button>
              </div>
            </div>
            <div className="space-y-1.5">
              {feeds.map((f) => {
                const on = selected.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-colors ${on ? 'border-brand bg-brand/5' : 'border-neutral-200 dark:border-ink-700 hover:border-neutral-400'}`}
                  >
                    {on ? <CheckSquare className="w-4 h-4 text-brand shrink-0" /> : <Square className="w-4 h-4 text-muted shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold">{f.platformName}</span>
                      <span className="text-[11px] text-muted ml-2">{f.dataType}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] shrink-0 ${STATUS_META[f.status]?.color || ''}`}>{STATUS_META[f.status]?.label ?? f.status}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-ink-950">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-muted">
                <Loader2 className="w-7 h-7 animate-spin text-brand mb-3" />
                <p className="text-[11px] uppercase tracking-[0.16em]">Generating booklet with local LLM…</p>
              </div>
            ) : (
              <iframe srcDoc={html} className="w-full h-full border-0 bg-white" title="Data Feeds Booklet" sandbox="allow-same-origin" />
            )}
          </div>
        )}

        {/* Footer (select stage) */}
        {stage === 'select' && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
            <button onClick={onClose} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-muted hover:border-neutral-400 transition-colors">Cancel</button>
            <button
              onClick={generate}
              disabled={chosen.length === 0}
              className="flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate booklet ({chosen.length})
            </button>
          </div>
        )}
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

/* ──────────────────────────────────────────────────────────────────────────
   FeedPreviewModal — read-only detail card (task #6)
   ────────────────────────────────────────────────────────────────────────── */
const FeedPreviewModal: React.FC<{
  feed: DataFeed;
  mcpServers: McpServer[];
  onClose: () => void;
  onEdit?: () => void;
}> = ({ feed, mcpServers, onClose, onEdit }) => {
  const meta = STATUS_META[feed.status];
  const linkedMcps = (feed.mcpServerIds || [])
    .map((id) => mcpServers.find((m) => m.id === id)?.name)
    .filter(Boolean) as string[];
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const Row: React.FC<{ icon: React.ReactNode; label: string; value?: string | number; mono?: boolean }> = ({ icon, label, value, mono }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className={`text-[12px] ${mono ? 'font-mono' : 'font-medium'}`}>{String(value)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Eye className="w-4 h-4 text-brand shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] truncate">Feed details</span>
            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${meta.color}`}>{meta.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={onEdit} className="flex items-center gap-1.5 px-2.5 h-7 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Title + pipeline */}
          <div>
            <h2 className="text-2xl font-black tracking-tight mb-1">{feed.platformName}</h2>
            <p className="text-[11px] text-muted">{feed.dataType}</p>
          </div>

          {/* Pipeline diagram */}
          <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-700">
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted mb-0.5">Source</p>
              <p className="text-[12px] font-mono font-medium truncate">{feed.source || '—'}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-brand shrink-0" />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted mb-0.5">Destination</p>
              <p className="text-[12px] font-mono font-medium truncate">{feed.destination || '—'}</p>
            </div>
          </div>

          {/* Frequency badge */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] border border-brand text-brand">
              {FREQUENCY_LABELS[feed.frequency]}
            </span>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-4">
            <Row icon={<UserIcon className="w-3.5 h-3.5" />} label="Project Manager" value={feed.projectManager} />
            <Row icon={<Code2 className="w-3.5 h-3.5" />} label="Developer" value={feed.developer} />
            <Row icon={<Ticket className="w-3.5 h-3.5" />} label="JIRA ref" value={feed.jiraRef} mono />
            <Row icon={<Banknote className="w-3.5 h-3.5" />} label="Cost" value={feed.costManDays !== undefined ? `${feed.costManDays} Man-Days` : undefined} mono />
            <Row icon={<CalendarDays className="w-3.5 h-3.5" />} label="Production date" value={fmt(feed.prodDate)} mono />
            <Row icon={<Clock4 className="w-3.5 h-3.5" />} label="ETA" value={!feed.prodDate ? fmt(feed.eta) : undefined} mono />
          </div>

          {/* Presentation link */}
          {feed.presentationUrl && (
            <div className="flex items-center gap-2">
              <Presentation className="w-3.5 h-3.5 text-muted shrink-0" />
              <a href={feed.presentationUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-brand hover:underline flex items-center gap-1">
                View presentation <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Consuming MCP servers */}
          {linkedMcps.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1.5">Consumed by MCP</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedMcps.map((n) => (
                  <span key={n} className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-brand/10 text-brand border border-brand/30">
                    <Plug className="w-3 h-3" /> {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {feed.comments && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Comments</p>
              <p className="text-[12px] text-muted whitespace-pre-wrap leading-relaxed">{feed.comments}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   AI Booklet generator — styled HTML report for board sharing (task #7)
   ────────────────────────────────────────────────────────────────────────── */

const esc = (s?: string | number | null) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

