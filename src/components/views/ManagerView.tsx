/**
 * ManagerView — admin-only executive cockpit (sits right after Dashboard).
 *
 * A single pane of glass for steering the portfolio: headline KPIs, attention
 * signals, key projects, a live activity stream (updates + creations), and a
 * row of "pilotage" buttons that each generate a detailed analysis with the
 * local LLM (executive briefing, risk deep-dive, delivery momentum, workload,
 * ROI synthesis), shown in a rich Markdown modal with Print/PDF.
 */

import React, { useMemo, useState } from 'react';
import {
  Gauge, Target, AlertTriangle, Rocket, Bot, Plug, DatabaseZap, Lightbulb,
  Users as UsersIcon, Activity, Clock, ArrowRight, Sparkles, Loader2, X,
  Printer, Copy, Check, TrendingUp, FileText, Layers, Wallet,
} from 'lucide-react';
import { AppState, User, ProjectStatus, TaskStatus, Project } from '../../types';
import { runPrompt } from '../../services/llmService';
import { MarkdownView } from '../ui/MarkdownView';
import type { TabId } from '../Sidebar';

interface Props {
  state: AppState;
  currentUser: User;
  setActiveTab: (t: TabId) => void;
}

type Health = { label: string; tone: 'green' | 'amber' | 'red' | 'muted' };
const projectHealth = (p: Project): Health => {
  if (p.isArchived || p.status === ProjectStatus.DONE) return { label: 'Done', tone: 'muted' };
  const blocked = (p.tasks || []).filter((t) => t.status === TaskStatus.BLOCKED).length;
  const overdue = new Date(p.deadline).getTime() < Date.now();
  if (overdue || blocked > 2) return { label: 'Off Track', tone: 'red' };
  const sevenDays = 7 * 24 * 3600 * 1000;
  if (blocked > 0 || new Date(p.deadline).getTime() - Date.now() < sevenDays) return { label: 'At Risk', tone: 'amber' };
  return { label: 'On Track', tone: 'green' };
};
const TONE: Record<Health['tone'], string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  muted: 'bg-neutral-100 text-neutral-600 dark:bg-ink-700 dark:text-neutral-300',
};
const progress = (p: Project) => {
  const tasks = p.tasks || [];
  const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
  const doneW = tasks.filter((t) => t.status === TaskStatus.DONE).reduce((s, t) => s + (t.weight || 1), 0);
  return totalW ? Math.round((doneW / totalW) * 100) : 0;
};
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const since = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
};

type Analysis = { key: string; title: string };
const ANALYSES: Analysis[] = [
  { key: 'briefing', title: 'Executive briefing' },
  { key: 'risk', title: 'Risk & blockers deep-dive' },
  { key: 'momentum', title: 'Delivery momentum' },
  { key: 'workload', title: 'Workload & capacity' },
  { key: 'roi', title: 'ROI & impact synthesis' },
];

export const ManagerView: React.FC<Props> = ({ state, currentUser, setActiveTab }) => {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);

  const userName = (id?: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };

  const kpi = useMemo(() => {
    const active = state.projects.filter((p) => !p.isArchived);
    const rag = { 'On Track': 0, 'At Risk': 0, 'Off Track': 0 } as Record<string, number>;
    active.forEach((p) => { const h = projectHealth(p); if (h.tone !== 'muted') rag[h.label]++; });
    const overdue = active.filter((p) => new Date(p.deadline).getTime() < Date.now() && p.status !== ProjectStatus.DONE).length;
    return {
      active: active.length,
      rag,
      overdue,
      bigBets: active.filter((p) => p.isBigBet).length,
      agentsProd: (state.agents || []).filter((a) => a.status === 'production').length,
      agents: (state.agents || []).length,
      mcp: (state.mcpServers || []).length,
      feedsProd: (state.dataFeeds || []).filter((d) => d.status === 'production').length,
      feeds: (state.dataFeeds || []).length,
      wishesOpen: (state.wishes || []).filter((w) => ['submitted', 'under_review'].includes(w.status)).length,
      team: state.users.length,
      groups: (state.workingGroups || []).filter((g) => g.status === 'active').length,
    };
  }, [state]);

  // Attention signals
  const attention = useMemo(() => {
    const active = state.projects.filter((p) => !p.isArchived);
    const offTrack = active.filter((p) => projectHealth(p).tone === 'red');
    const atRisk = active.filter((p) => projectHealth(p).tone === 'amber');
    const blockedTasks = active.reduce((s, p) => s + (p.tasks || []).filter((t) => t.status === TaskStatus.BLOCKED).length, 0);
    const stale = active.filter((p) => {
      const last = p.auditLog?.[p.auditLog.length - 1];
      const ts = last ? new Date(last.date).getTime() : new Date(p.updatedAt).getTime();
      return Date.now() - ts > 10 * 24 * 3600 * 1000;
    });
    return { offTrack, atRisk, blockedTasks, stale };
  }, [state]);

  // Key projects: big bets + off/at-risk, then by nearest deadline
  const keyProjects = useMemo(() => {
    return state.projects
      .filter((p) => !p.isArchived && p.status !== ProjectStatus.DONE)
      .map((p) => ({ p, h: projectHealth(p) }))
      .sort((a, b) => {
        const score = (x: typeof a) => (x.p.isBigBet ? 4 : 0) + (x.h.tone === 'red' ? 3 : x.h.tone === 'amber' ? 2 : 0);
        const d = score(b) - score(a);
        if (d !== 0) return d;
        return new Date(a.p.deadline).getTime() - new Date(b.p.deadline).getTime();
      })
      .slice(0, 6);
  }, [state]);

  // Live activity stream: audit entries + recent creations
  const activity = useMemo(() => {
    const items: { ts: number; label: string; sub: string; kind: string }[] = [];
    state.projects.forEach((p) => {
      (p.auditLog || []).slice(-3).forEach((a) =>
        items.push({ ts: new Date(a.date).getTime(), label: `${a.action} — ${p.name}`, sub: a.userName || '', kind: 'update' }));
      items.push({ ts: new Date(p.createdAt).getTime(), label: `Project created: ${p.name}`, sub: userName(p.managerId), kind: 'project' });
    });
    (state.agents || []).forEach((a) => items.push({ ts: new Date(a.createdAt).getTime(), label: `Agent: ${a.name}`, sub: a.status, kind: 'agent' }));
    (state.mcpServers || []).forEach((m) => items.push({ ts: new Date(m.createdAt).getTime(), label: `MCP: ${m.name}`, sub: m.category || '', kind: 'mcp' }));
    (state.dataFeeds || []).forEach((d) => items.push({ ts: new Date(d.createdAt).getTime(), label: `Data feed: ${d.platformName}`, sub: d.status, kind: 'feed' }));
    (state.wishes || []).forEach((w) => items.push({ ts: new Date(w.createdAt).getTime(), label: `Wish: ${w.title}`, sub: w.status, kind: 'wish' }));
    return items.filter((i) => i.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 14);
  }, [state]);

  // ── LLM analyses ───────────────────────────────────────────────────────
  const buildData = (): string => {
    const active = state.projects.filter((p) => !p.isArchived);
    const lines: string[] = [];
    lines.push(`PORTFOLIO: ${active.length} active projects | RAG: OnTrack ${kpi.rag['On Track']}, AtRisk ${kpi.rag['At Risk']}, OffTrack ${kpi.rag['Off Track']} | Overdue ${kpi.overdue} | Big bets ${kpi.bigBets}`);
    lines.push(`ASSETS: ${kpi.agents} agents (${kpi.agentsProd} prod), ${kpi.mcp} MCP servers, ${kpi.feeds} data feeds (${kpi.feedsProd} prod), ${kpi.groups} active working groups, ${kpi.wishesOpen} open wishes`);
    lines.push('');
    lines.push('PROJECTS:');
    active.slice(0, 40).forEach((p) => {
      const h = projectHealth(p);
      const roi = (p as any).roiModel ? ' [has ROI model]' : '';
      lines.push(`- ${p.name} [${h.label}] status=${p.status} progress=${progress(p)}% deadline=${fmtDate(p.deadline)} PM=${userName(p.managerId)}${p.isBigBet ? ' BIGBET' : ''}${roi}`);
    });
    return lines.join('\n');
  };

  const promptFor = (key: string): string => {
    const base = `You are DOINg.AI, the executive operations co-pilot for an AI project portfolio. Using ONLY the data below, write a sharp, specific analysis in rich Markdown (headings, bullet points, a table where useful, **bold** for figures). Reference real project names and numbers. Be decisive and actionable.\n\n`;
    const ask: Record<string, string> = {
      briefing: 'Produce a one-page EXECUTIVE BRIEFING for leadership: overall portfolio health, the 3 things going well, the 3 things needing attention, and 3 concrete decisions to make this week.',
      risk: 'Produce a RISK & BLOCKERS deep-dive: rank the most at-risk projects, explain the likely root cause of each, quantify exposure, and propose specific mitigations with an owner suggestion.',
      momentum: 'Analyse DELIVERY MOMENTUM: which projects are progressing well vs stalling, slippage patterns, and where to push to maximise throughput this month.',
      workload: 'Analyse WORKLOAD & CAPACITY across people (PMs and members): who looks over-allocated or single-point-of-failure, and how to rebalance.',
      roi: 'Produce an ROI & IMPACT synthesis: estimate where the portfolio is creating the most value (use FTE gains, big bets, in-production assets), flag low-ROI efforts, and recommend where to invest or stop.',
    };
    return base + ask[key] + '\n\nDATA:\n' + buildData();
  };

  const runAnalysis = async (a: Analysis) => {
    setAiTitle(a.title); setAiContent(''); setAiLoading(true); setAiOpen(true);
    try {
      const out = await runPrompt(promptFor(a.key), state.llmConfig);
      setAiContent(out || '_No output generated._');
    } catch {
      setAiContent('> Generation failed — check the local LLM connection in Settings.');
    } finally { setAiLoading(false); }
  };

  const printAnalysis = () => {
    const body = document.getElementById('mgr-analysis')?.innerHTML ?? '';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${aiTitle}</title>
<style>@media print{@page{size:A4;margin:18mm}}body{font-family:-apple-system,system-ui,sans-serif;color:#111;max-width:820px;margin:0 auto;padding:32px;line-height:1.6}
h1,h2,h3{font-weight:800}h2{border-bottom:2px solid #FF3E00;padding-bottom:4px}h3{color:#FF3E00}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:10pt}th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}th{background:#faf3f0}
.cover{background:#050505;color:#fff;padding:28px;margin:-32px -32px 24px}.brand{font-size:26pt;font-weight:900}.brand span{color:#FF3E00}</style></head><body>
<div class="cover"><div style="font-size:8pt;letter-spacing:.25em;text-transform:uppercase;color:#FF3E00;margin-bottom:8px">Manager Cockpit · ${today}</div><div class="brand">DOINg<span>.AI</span></div><div style="color:#aaa;margin-top:4px">${aiTitle}</div></div>
${body}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string; onClick?: () => void; sub?: string }> =
    ({ icon, label, value, accent = 'text-brand', onClick, sub }) => (
      <button onClick={onClick} disabled={!onClick}
        className={`surface border p-4 text-left ${onClick ? 'hover:border-brand transition-colors cursor-pointer' : 'cursor-default'}`}>
        <div className="flex items-center gap-2 text-muted mb-2">{icon}<span className="text-[9px] font-bold uppercase tracking-[0.16em]">{label}</span></div>
        <p className={`text-3xl font-black ${accent}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted mt-1">{sub}</p>}
      </button>
    );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">Admin cockpit</p>
          <h1 className="display-xl flex items-center gap-3"><Gauge className="w-7 h-7 text-brand" /> Manager View</h1>
          <p className="text-sm text-muted mt-1">Welcome back, {currentUser.firstName}. Your portfolio at a glance — and on tap, deep AI analyses.</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard icon={<Target className="w-3.5 h-3.5" />} label="Active projects" value={kpi.active} onClick={() => setActiveTab('projects')} sub={`${kpi.bigBets} big bets`} />
        <KpiCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Off track" value={kpi.rag['Off Track']} accent="text-red-500" sub={`${kpi.overdue} overdue`} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="At risk" value={kpi.rag['At Risk']} accent="text-amber-500" />
        <KpiCard icon={<Bot className="w-3.5 h-3.5" />} label="Agents in prod" value={kpi.agentsProd} accent="text-fuchsia-500" onClick={() => setActiveTab('agents')} sub={`${kpi.agents} total`} />
        <KpiCard icon={<Plug className="w-3.5 h-3.5" />} label="MCP servers" value={kpi.mcp} accent="text-cyan-500" onClick={() => setActiveTab('mcp')} />
        <KpiCard icon={<DatabaseZap className="w-3.5 h-3.5" />} label="Data feeds" value={kpi.feeds} accent="text-teal-500" onClick={() => setActiveTab('datafeeds')} sub={`${kpi.feedsProd} in prod`} />
        <KpiCard icon={<Lightbulb className="w-3.5 h-3.5" />} label="Open wishes" value={kpi.wishesOpen} accent="text-amber-500" onClick={() => setActiveTab('wishes')} />
        <KpiCard icon={<Layers className="w-3.5 h-3.5" />} label="Working groups" value={kpi.groups} onClick={() => setActiveTab('workinggroups')} />
        <KpiCard icon={<UsersIcon className="w-3.5 h-3.5" />} label="Team" value={kpi.team} onClick={() => setActiveTab('contributors')} />
        <KpiCard icon={<Rocket className="w-3.5 h-3.5" />} label="On track" value={kpi.rag['On Track']} accent="text-emerald-500" />
      </div>

      {/* Pilotage — AI analyses */}
      <div className="surface border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-brand" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em]">Pilotage — AI deep-dives</h2>
          <span className="text-[10px] text-muted">one tap → a detailed, board-ready analysis from your local LLM</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {ANALYSES.map((a) => (
            <button key={a.key} onClick={() => runAnalysis(a)}
              className="flex items-center gap-2 px-3 py-3 border border-neutral-200 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors text-left">
              {a.key === 'briefing' && <FileText className="w-4 h-4 shrink-0" />}
              {a.key === 'risk' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {a.key === 'momentum' && <TrendingUp className="w-4 h-4 shrink-0" />}
              {a.key === 'workload' && <UsersIcon className="w-4 h-4 shrink-0" />}
              {a.key === 'roi' && <Wallet className="w-4 h-4 shrink-0" />}
              <span className="text-[11px] font-bold leading-tight">{a.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Key projects */}
        <div className="lg:col-span-2 surface border">
          <div className="px-5 py-3 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em]">Key projects</h2>
            <button onClick={() => setActiveTab('projects')} className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand hover:underline flex items-center gap-1">All <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-ink-600">
            {keyProjects.length === 0 && <p className="p-6 text-sm text-muted text-center">No active projects.</p>}
            {keyProjects.map(({ p, h }) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                {p.isBigBet && <span title="Big bet" className="shrink-0"><Rocket className="w-3.5 h-3.5 text-amber-500" /></span>}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{p.name}</p>
                  <p className="text-[10px] text-muted">{userName(p.managerId)} · due {fmtDate(p.deadline)}</p>
                </div>
                <div className="w-24 hidden md:block">
                  <div className="h-1 bg-neutral-200 dark:bg-ink-600 overflow-hidden"><div className="h-full bg-brand" style={{ width: `${progress(p)}%` }} /></div>
                </div>
                <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${TONE[h.tone]}`}>{h.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attention + activity */}
        <div className="space-y-5">
          <div className="surface border p-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Attention required</h2>
            <div className="space-y-2 text-[12px]">
              <Row label="Off-track projects" value={attention.offTrack.length} tone="red" onClick={() => setActiveTab('projects')} />
              <Row label="At-risk projects" value={attention.atRisk.length} tone="amber" onClick={() => setActiveTab('projects')} />
              <Row label="Blocked tasks" value={attention.blockedTasks} tone="red" onClick={() => setActiveTab('board')} />
              <Row label="Stale (>10d) projects" value={attention.stale.length} tone="muted" onClick={() => setActiveTab('projects')} />
            </div>
          </div>

          <div className="surface border">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] px-5 py-3 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-2"><Activity className="w-4 h-4 text-brand" /> Latest activity</h2>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100 dark:divide-ink-700">
              {activity.length === 0 && <p className="p-5 text-sm text-muted text-center">No recent activity.</p>}
              {activity.map((it, i) => (
                <div key={i} className="px-5 py-2.5 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] leading-snug truncate">{it.label}</p>
                    <p className="text-[9px] text-muted">{it.sub}{it.sub ? ' · ' : ''}{since(new Date(it.ts).toISOString())}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis modal */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface border w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between bg-brand text-white">
              <h3 className="text-[13px] font-black uppercase tracking-tight flex items-center gap-2"><Sparkles className="w-5 h-5" /> {aiTitle}</h3>
              <button onClick={() => setAiOpen(false)} className="hover:opacity-70"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-ink-950">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-brand mb-3" />
                  <p className="text-[11px] uppercase tracking-[0.16em]">Analysing the portfolio…</p>
                </div>
              ) : (
                <div id="mgr-analysis" className="surface border p-6 md:p-8 text-[13px] leading-relaxed"><MarkdownView content={aiContent} /></div>
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2">
              <button onClick={printAnalysis} disabled={aiLoading || !aiContent} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 disabled:opacity-40"><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
              <button onClick={() => { navigator.clipboard?.writeText(aiContent); setAiCopied(true); setTimeout(() => setAiCopied(false), 1500); }} disabled={aiLoading || !aiContent} className="flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand disabled:opacity-40">{aiCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} {aiCopied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: number; tone: 'red' | 'amber' | 'muted'; onClick?: () => void }> = ({ label, value, tone, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between hover:text-brand transition-colors">
    <span>{label}</span>
    <span className={`px-2 py-0.5 text-[11px] font-black ${value > 0 ? (tone === 'red' ? 'text-red-500' : tone === 'amber' ? 'text-amber-500' : 'text-muted') : 'text-muted'}`}>{value}</span>
  </button>
);
