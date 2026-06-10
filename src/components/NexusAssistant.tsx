import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Trash2, Loader2, Copy, Check, Maximize2, Minimize2, MessageSquare, LayoutTemplate, Printer, Download, History, Sparkles, Pencil, Eye } from 'lucide-react';
import { MarkdownView } from './ui/MarkdownView';
import { AppState, LlmConfig } from '../types';
import { runPrompt } from '../services/llmService';

/* ─── Context builder ────────────────────────────────────────────── */

const buildContext = (state: AppState): string => {
  if (!state) return '';

  const projects = state.projects || [];
  const users = state.users || [];
  const techs = state.technologies || [];
  const repos = state.repositories || [];
  const hackathons = state.hackathons || [];
  const wgs = state.workingGroups || [];
  const checkIns = state.weeklyCheckIns || [];
  const mcpServers = state.mcpServers || [];
  const mcpFamilies = state.mcpFamilies || [];
  const mcpBestPractices = state.mcpBestPractices || [];
  const agents = state.agents || [];
  const agentFamilies = state.agentFamilies || [];

  const now = Date.now();

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const projectLines = projects.map((p) => {
    const tasks = p.tasks || [];
    const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
    const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
    const pct = totalW ? Math.round((doneW / totalW) * 100) : 0;
    const blocked = tasks.filter((t) => t.status === 'Blocked').length;
    const overdue = new Date(p.deadline).getTime() < now && p.status !== 'Done';
    const owner = users.find((u) => u.id === p.managerId);
    const slipDays =
      p.initialDeadline && new Date(p.deadline).getTime() > new Date(p.initialDeadline).getTime()
        ? Math.round((new Date(p.deadline).getTime() - new Date(p.initialDeadline).getTime()) / 86400000)
        : 0;
    return [
      `Project: ${p.name}`,
      `  Status: ${p.status} | Progress: ${pct}% | Tasks: ${tasks.length} (${blocked} blocked)`,
      `  Deadline: ${fmtDate(p.deadline)}${overdue ? ' [OVERDUE]' : ''}${slipDays > 0 ? ` [slipped +${slipDays}d]` : ''}`,
      `  Manager: ${owner ? owner.firstName + ' ' + owner.lastName : '—'}`,
      `  Members: ${p.members.length} | Budget: ${p.budget || 0} MD`,
      p.description ? `  Description: ${p.description.slice(0, 200)}` : '',
      p.context ? `  Context: ${p.context.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n');
  });

  const userLines = users.map((u) =>
    `User: ${u.firstName} ${u.lastName} | Role: ${u.role} | Team: ${u.team}${u.squadTeam ? ` | Squad: ${u.squadTeam}` : ''} | Title: ${u.functionTitle}`
  );

  const techLines = techs.map((t) =>
    `Tech: ${t.name} | ${t.category}${t.layer ? ' | ' + t.layer : ''}${t.maturityStatus ? ' | ' + t.maturityStatus : ''}${t.technicalArchitect ? ' | Architect: ' + t.technicalArchitect : ''}`
  );

  const repoLines = repos.map((r) =>
    `Repo: ${r.name} | ${r.provider || 'git'} | ${r.visibility}`
  );

  const hackathonLines = hackathons.map((h) =>
    `Hackathon: ${h.title} | Status: ${h.status} | ${fmtDate(h.startDate)} → ${fmtDate(h.endDate)} | ${h.participants.length} participants`
  );

  const wgLines = wgs.map((wg) => {
    const total = wg.tasks.length;
    const done = wg.tasks.filter((t) => t.status === 'done').length;
    return `WorkingGroup: ${wg.name} | Status: ${wg.status} | Tasks: ${total} (${done} done) | Members: ${wg.members.length}`;
  });

  // Latest mood per user
  const latestMoods: Record<string, string> = {};
  checkIns.forEach((c) => {
    if (!latestMoods[c.userId] || c.weekOf > (latestMoods[c.userId + '_date'] || '')) {
      latestMoods[c.userId] = c.mood;
      latestMoods[c.userId + '_date'] = c.weekOf;
    }
  });
  const moods = Object.entries(latestMoods)
    .filter(([k]) => !k.endsWith('_date'))
    .map(([uid, mood]) => {
      const u = users.find((x) => x.id === uid);
      return u ? `${u.firstName} ${u.lastName}: ${mood}` : '';
    })
    .filter(Boolean);

  // ── MCP catalog ──────────────────────────────────────────────────────
  const familyMap = new Map(mcpFamilies.map((f) => [f.id, f.name]));
  const mcpServerLines = mcpServers.map((s) => {
    const fam = s.familyId ? familyMap.get(s.familyId) || '' : '';
    const toolList = s.tools.length > 0
      ? s.tools.slice(0, 8).map((t) => t.name).join(', ') + (s.tools.length > 8 ? `, +${s.tools.length - 8} more` : '')
      : 'no tools';
    return [
      `MCP: ${s.name}`,
      `  Category: ${s.category || '—'} | Family: ${fam || '—'} | Deploy: ${s.deployStatus || (s.isActive ? 'active' : 'inactive')}`,
      `  Source: ${s.source}${s.url ? ' | URL: ' + s.url : ''}${s.token ? ' | Auth: configured' : ''}`,
      s.scope ? `  Scope: ${s.scope}` : '',
      s.useCase ? `  Use case: ${s.useCase.slice(0, 200)}` : '',
      s.teamIT ? `  IT owner: ${s.teamIT}` : '',
      (s.userTeams || []).length > 0 ? `  User teams: ${(s.userTeams || []).join(', ')}` : '',
      (s.tags || []).length > 0 ? `  Tags: ${s.tags.join(', ')}` : '',
      `  Tools (${s.tools.length}): ${toolList}`,
      s.description ? `  Description: ${s.description.slice(0, 250)}` : '',
    ].filter(Boolean).join('\n');
  });

  // Build a fast keyword index over MCP tools so the LLM can answer
  // "which MCP exposes a tool for X?" without scanning every server's prose.
  const toolIndex: string[] = [];
  mcpServers.forEach((s) => {
    s.tools.forEach((t) => {
      toolIndex.push(`  - ${t.name} [${s.name}]: ${(t.description || t.enrichedDescription || '').slice(0, 120)}`);
    });
  });

  const familyLines = mcpFamilies.map((f) => {
    const memberCount = mcpServers.filter((s) => s.familyId === f.id).length;
    return `Family: ${f.name} (${memberCount} server${memberCount === 1 ? '' : 's'})${f.description ? ' — ' + f.description : ''}`;
  });

  const bestPracticeLines = mcpBestPractices.map((bp) => {
    const summary = (bp.content || '').replace(/\s+/g, ' ').slice(0, 180);
    return `BestPractice: ${bp.title}${bp.category ? ` [${bp.category}]` : ''}${bp.pinned ? ' [PINNED]' : ''} — ${summary}`;
  });

  // ── AI Agents catalog ────────────────────────────────────────────────
  const agentFamilyMap = new Map(agentFamilies.map((f) => [f.id, f.name]));
  const agentLines = agents.map((a) => {
    const fam = a.familyId ? agentFamilyMap.get(a.familyId) || '' : '';
    const mcpLinks = a.mcpServerIds.length > 0
      ? a.mcpServerIds.map((id) => mcpServers.find((s) => s.id === id)?.name).filter(Boolean).join(', ')
      : '';
    const m = a.metrics;
    const metricsStr = m && (m.monthlyInvocations || m.successRatePct || m.costPerMonthEur)
      ? ` | Metrics: ${m.monthlyInvocations ? `${m.monthlyInvocations}/mo invocations` : ''}${m.successRatePct ? `, ${m.successRatePct}% success` : ''}${m.costPerMonthEur ? `, €${m.costPerMonthEur}/mo` : ''}`
      : '';
    return [
      `Agent: ${a.name} (v${a.version || '0.1.0'})`,
      `  Status: ${a.status} | Family: ${fam || '—'} | Category: ${a.category || '—'}`,
      `  Stack: ${a.llmProvider || '—'}${a.llmModel ? ' / ' + a.llmModel : ''}${a.framework ? ' [' + a.framework + ']' : ''}`,
      a.description ? `  Description: ${a.description.slice(0, 200)}` : '',
      a.tools.length > 0 ? `  Tools (${a.tools.length}): ${a.tools.slice(0, 8).map((t) => t.name).join(', ')}` : '',
      mcpLinks ? `  MCP servers used: ${mcpLinks}` : '',
      (a.userTeams || []).length > 0 ? `  User teams: ${a.userTeams.join(', ')}` : '',
      metricsStr ? `  ${metricsStr.trim()}` : '',
    ].filter(Boolean).join('\n');
  });

  // ── Data feeds ────────────────────────────────────────────────────────
  const dataFeeds = state.dataFeeds || [];
  const dataFeedLines = dataFeeds.map((d) => {
    const mcps = (d.mcpServerIds || []).map((id) => mcpServers.find((s) => s.id === id)?.name).filter(Boolean);
    return `DataFeed: ${d.platformName} | Type: ${d.dataType || '—'} | Status: ${d.status} | Freq: ${d.frequency} | ${d.source || '?'} -> ${d.destination || '?'}${mcps.length ? ` | Consumed by MCP: ${mcps.join(', ')}` : ''}`;
  });

  // ── Wishes ────────────────────────────────────────────────────────────
  const wishes = state.wishes || [];
  const wishLines = wishes.map((w) =>
    `Wish: ${w.title} | Category: ${w.category} | Status: ${w.status} | Priority: ${w.priority}${w.sponsorName ? ` | Sponsor: ${w.sponsorName}` : ''}`
  );

  // ── AI contacts ───────────────────────────────────────────────────────
  const aiContacts = state.aiContacts || [];
  const contactLines = aiContacts.map((c) =>
    `Contact: ${c.firstName} ${c.lastName} | ${c.functionTitle || '—'}${c.team ? ` | Team: ${c.team}` : ''}${c.pole ? ` | Pole: ${c.pole}` : ''}${c.location ? ` | ${c.location}` : ''}`
  );

  const sections: string[] = [
    `=== DOINg.AI CONTEXT (${new Date().toLocaleDateString('en-GB')} — ${projects.length} projects, ${users.length} users, ${mcpServers.length} MCP servers, ${agents.length} agents, ${dataFeeds.length} data feeds) ===`,
    '',
    '--- PROJECTS ---',
    ...projectLines,
    '',
    '--- TEAM ---',
    ...userLines,
    '',
    ...(techLines.length > 0 ? ['--- TECHNOLOGIES ---', ...techLines, ''] : []),
    ...(repoLines.length > 0 ? ['--- REPOSITORIES ---', ...repoLines, ''] : []),
    ...(hackathonLines.length > 0 ? ['--- HACKATHONS ---', ...hackathonLines, ''] : []),
    ...(wgLines.length > 0 ? ['--- WORKING GROUPS ---', ...wgLines, ''] : []),
    ...(moods.length > 0 ? ['--- TEAM MOOD (latest check-ins) ---', ...moods, ''] : []),
    ...(familyLines.length > 0 ? ['--- MCP FAMILIES ---', ...familyLines, ''] : []),
    ...(mcpServerLines.length > 0 ? ['--- MCP SERVERS ---', ...mcpServerLines, ''] : []),
    ...(toolIndex.length > 0 ? ['--- MCP TOOL INDEX (tool [server]: description) ---', ...toolIndex, ''] : []),
    ...(bestPracticeLines.length > 0 ? ['--- MCP BEST PRACTICES ---', ...bestPracticeLines, ''] : []),
    ...(agentLines.length > 0 ? ['--- AI AGENTS ---', ...agentLines, ''] : []),
    ...(dataFeedLines.length > 0 ? ['--- DATA FEEDS ---', ...dataFeedLines, ''] : []),
    ...(wishLines.length > 0 ? ['--- WISH LIST ---', ...wishLines, ''] : []),
    ...(contactLines.length > 0 ? ['--- AI CONTACTS ---', ...contactLines, ''] : []),
  ];

  return sections.join('\n');
};

/* ─── Suggested questions ────────────────────────────────────────── */

/** Suggestions adapt to what's in the dataset. */
const buildSuggestions = (state: AppState | null): { label: string; q: string; section: string }[] => {
  const hasProjects = (state?.projects || []).length > 0;
  const hasMcp = (state?.mcpServers || []).length > 0;
  const hasCheckIns = (state?.weeklyCheckIns || []).length > 0;

  const list: { label: string; q: string; section: string }[] = [];

  if (hasProjects) {
    list.push(
      { section: 'Portfolio', label: '📊 Portfolio health snapshot', q: 'Give me a concise health snapshot of the project portfolio: active vs at-risk projects, top 3 blockers, and one chart breakdown.' },
      { section: 'Portfolio', label: '⚠️ At-risk projects', q: 'List projects that are overdue or at risk. For each, explain why in one sentence.' },
      { section: 'Portfolio', label: '🧑‍💻 Team workload analysis', q: 'Analyse team workload across active projects. Flag people who appear over-allocated.' },
    );
  }
  if (hasMcp) {
    list.push(
      { section: 'MCP', label: '🔌 MCP catalog synthesis', q: 'Synthesise the MCP catalog: number of servers, families, deploy maturity breakdown. Include a chart.' },
      { section: 'MCP', label: '🔎 Find MCP tools for...', q: 'Which MCP servers expose tools for searching, fetching, or summarising data? Group by purpose.' },
      { section: 'MCP', label: '🚦 MCPs not yet in production', q: 'Which MCP servers are still in dev or UAT? Tell me what is missing for them to reach prod.' },
      { section: 'MCP', label: '👥 MCP recommendations per team', q: 'For each user team, recommend the most relevant MCP servers based on use case and tools.' },
      { section: 'MCP', label: '📈 MCP family breakdown chart', q: 'Show me a bar chart of MCP servers grouped by family.' },
    );
  }
  if ((state?.agents || []).length > 0) {
    list.push(
      { section: 'Agents', label: '🤖 AI agents lifecycle snapshot', q: 'Give me a lifecycle snapshot of all AI agents: how many in idea/design/dev/testing/production. Include a chart.' },
      { section: 'Agents', label: '💰 Agent cost & performance', q: 'List agents in production with their monthly cost, invocations and success rate. Flag the worst ROI ones.' },
      { section: 'Agents', label: '🧩 Agents using MCP', q: 'Which agents depend on which MCP servers? Show as a list grouped by MCP server.' },
      { section: 'Agents', label: '🏗️ Agent stack inventory', q: 'Break down agents by LLM provider and framework. Include a bar chart.' },
    );
  }
  if (hasCheckIns) {
    list.push({ section: 'Team', label: '🌡️ Team mood summary', q: 'Summarise the latest team moods and flag any concerning patterns.' });
  }
  list.push({ section: 'Executive', label: '📋 Executive summary for leadership', q: 'Produce a one-page executive summary: portfolio status, MCP catalog maturity, top risks, recommendations.' });

  return list;
};

/* ─── Inline chart blocks ──────────────────────────────────────────
   The LLM can embed visualisations in its answers by emitting:

     ```chart
     { "type": "bar" | "donut" | "kpi", "title": "...",
       "data": [ { "label": "Foo", "value": 5, "color": "#FF3E00" }, ... ] }
     ```

   parseChartBlocks() splits a response into alternating markdown
   segments and chart blocks; ChartBlock renders the chart as inline SVG. */

const CHART_PALETTE = ['#FF3E00', '#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9'];

interface ChartDataPoint { label: string; value: number; color?: string }
interface ChartSpec {
  type: 'bar' | 'donut' | 'kpi';
  title?: string;
  data: ChartDataPoint[];
}

type ContentBlock =
  | { kind: 'md'; text: string }
  | { kind: 'chart'; spec: ChartSpec };

const parseChartBlocks = (content: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [];
  const regex = /```chart\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      blocks.push({ kind: 'md', text: content.slice(lastIndex, m.index) });
    }
    try {
      const spec = JSON.parse(m[1].trim()) as ChartSpec;
      if (spec && Array.isArray(spec.data) && spec.type) {
        blocks.push({ kind: 'chart', spec });
      } else {
        blocks.push({ kind: 'md', text: '```json\n' + m[1].trim() + '\n```' });
      }
    } catch {
      blocks.push({ kind: 'md', text: '```json\n' + m[1].trim() + '\n```' });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    blocks.push({ kind: 'md', text: content.slice(lastIndex) });
  }
  if (blocks.length === 0) blocks.push({ kind: 'md', text: content });
  return blocks;
};

const ChartBlock: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const data = spec.data.filter((d) => d && typeof d.value === 'number').slice(0, 20);
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const max = Math.max(...data.map((d) => d.value), 1);

  if (spec.type === 'bar') {
    return (
      <div className="my-3 border border-neutral-200 dark:border-ink-600 p-4 bg-neutral-50 dark:bg-ink-800">
        {spec.title && <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-3">{spec.title}</p>}
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-28 truncate text-right" title={d.label}>{d.label}</span>
              <div className="flex-1 bg-neutral-200 dark:bg-ink-700 h-4 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 transition-all"
                  style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color || CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold w-10 text-right tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (spec.type === 'donut') {
    const size = 140;
    const thickness = 20;
    const radius = (size - thickness) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return (
      <div className="my-3 border border-neutral-200 dark:border-ink-600 p-4 bg-neutral-50 dark:bg-ink-800 flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          {data.map((d, i) => {
            const len = (d.value / total) * circumference;
            const dash = `${len} ${circumference - len}`;
            const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length];
            const el = (
              <circle
                key={i} cx={cx} cy={cy} r={radius} fill="none"
                stroke={color} strokeWidth={thickness}
                strokeDasharray={dash} strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            offset += len;
            return el;
          })}
          <text x={cx} y={cy + 6} textAnchor="middle" className="text-[16px] font-black" fill="currentColor">{total}</text>
        </svg>
        <div className="flex-1 min-w-0">
          {spec.title && <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-2">{spec.title}</p>}
          <div className="space-y-1">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="inline-block w-3 h-3 shrink-0" style={{ backgroundColor: d.color || CHART_PALETTE[i % CHART_PALETTE.length] }} />
                <span className="flex-1 truncate" title={d.label}>{d.label}</span>
                <span className="font-mono font-bold tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (spec.type === 'kpi') {
    return (
      <div className="my-3">
        {spec.title && <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted mb-2">{spec.title}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.map((d, i) => {
            const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length];
            return (
              <div key={i} className="border border-neutral-200 dark:border-ink-600 p-3 bg-white dark:bg-ink-800" style={{ borderTopColor: color, borderTopWidth: 3 }}>
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted truncate" title={d.label}>{d.label}</p>
                <p className="text-2xl font-black mt-1 tabular-nums" style={{ color }}>{d.value}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

/* ─── Types ─────────────────────────────────────────────────────── */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  state: AppState | null;
  llmConfig: LlmConfig;
}

/* ─── Per-user history (last 3 requests, incl. generated output) ──── */

interface HistoryEntry {
  id: string;
  mode: 'chat' | 'canvas';
  title: string;
  prompt: string;
  output: string;   // assistant answer (chat) or full HTML (canvas)
  ts: number;
}

const histKey = (userId: string) => `doing_assistant_hist_v1_${userId}`;
const loadHistory = (userId: string): HistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(histKey(userId)) || '[]'); } catch { return []; }
};
const saveHistoryEntry = (userId: string, entry: HistoryEntry): HistoryEntry[] => {
  const next = [entry, ...loadHistory(userId).filter((e) => e.id !== entry.id)].slice(0, 3);
  try { localStorage.setItem(histKey(userId), JSON.stringify(next)); } catch { /* quota */ }
  return next;
};

/** Strip ```html / ``` fences an LLM sometimes wraps around generated code. */
const stripFences = (s: string) => s.replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

/** Make a generated HTML doc directly editable in the preview iframe. */
const makeEditable = (html: string): string =>
  /<body/i.test(html)
    ? html.replace(/<body([^>]*)>/i, '<body$1 contenteditable="true" style="outline:none">')
    : `<body contenteditable="true">${html}</body>`;

/* ─── Component ─────────────────────────────────────────────────── */

export const NexusAssistant: React.FC<Props> = ({ open, onClose, state, llmConfig }) => {
  const userId = state?.currentUserId || 'anon';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Layout + mode
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<'chat' | 'canvas'>('chat');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Canvas (intelligent report studio)
  const [canvasBrief, setCanvasBrief] = useState('');
  const [canvasHtml, setCanvasHtml] = useState('');
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasEditable, setCanvasEditable] = useState(false);
  const [canvasCopied, setCanvasCopied] = useState(false);
  const canvasRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { if (open) setHistory(loadHistory(userId)); }, [open, userId]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;

  const context = state ? buildContext(state) : 'No data available.';

  // ── Canvas: LLM-generated, self-contained, editable HTML report ───────
  const generateCanvas = async (brief?: string) => {
    const b = (brief ?? canvasBrief).trim();
    if (!b || canvasLoading) return;
    setCanvasBrief(b);
    setCanvasEditable(false);
    setCanvasLoading(true);
    setCanvasHtml('');
    const prompt = `You are DOINg.AI's report studio. Using ONLY the data provided below, produce a COMPLETE, self-contained, print-ready HTML document for this request:

"${b}"

STRICT REQUIREMENTS:
- A single <!DOCTYPE html> document. Inline CSS only. NO external resources, NO <script> tags.
- DOINg.AI brand: brand orange #FF3E00, near-black #050505 cover, clean system-ui typography, generous whitespace, ~820px centered content (A4-friendly).
- Structure: a bold cover header, an executive summary, then well-titled sections.
- Visualise the REAL numbers as INLINE SVG: bar charts, donut charts, KPI cards and simple infographics — computed from the data, not placeholders.
- Be genuinely insightful ("wow"): synthesise, compare, surface risks and concrete recommendations. Reference real names/figures.
- Return ONLY the HTML document. No markdown fences, no commentary.

DATA:
${context}`;
    try {
      const out = await runPrompt(prompt, llmConfig);
      const html = stripFences(out);
      setCanvasHtml(html);
      setHistory(saveHistoryEntry(userId, { id: crypto.randomUUID(), mode: 'canvas', title: b.slice(0, 70), prompt: b, output: html, ts: Date.now() }));
    } catch (e: any) {
      setCanvasHtml(`<body style="font-family:system-ui;padding:40px;color:#b00"><h2>Generation failed</h2><p>${e?.message || 'Check the local LLM in Settings.'}</p></body>`);
    } finally {
      setCanvasLoading(false);
    }
  };

  // Read the live document so manual inline edits are captured on export.
  const currentCanvasHtml = (): string => {
    const doc = canvasRef.current?.contentDocument;
    if (doc) {
      const clone = doc.documentElement.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
      return '<!DOCTYPE html>' + clone.outerHTML;
    }
    return canvasHtml;
  };
  const canvasExportPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(currentCanvasHtml()); w.document.close(); w.focus(); w.print();
  };
  const canvasOpenTab = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(currentCanvasHtml()); w.document.close();
  };
  const canvasDownload = () => {
    const blob = new Blob([currentCanvasHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `doing-ai-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  const canvasCopy = async () => {
    try { await navigator.clipboard.writeText(currentCanvasHtml()); setCanvasCopied(true); setTimeout(() => setCanvasCopied(false), 1600); } catch { /* ignore */ }
  };

  const reopenHistory = (e: HistoryEntry) => {
    setShowHistory(false);
    if (e.mode === 'canvas') {
      setMode('canvas'); setFull(true); setCanvasBrief(e.prompt); setCanvasHtml(e.output); setCanvasEditable(false);
    } else {
      setMode('chat');
      setMessages([
        { id: e.id + '_q', role: 'user', content: e.prompt, ts: e.ts },
        { id: e.id, role: 'assistant', content: e.output, ts: e.ts },
      ]);
    }
  };

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build conversation history for multi-turn context (last 6 messages)
      const history = [...messages, userMsg].slice(-6);
      const historyText = history
        .slice(0, -1)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const systemPrompt =
        `You are DOINg.AI, an expert AI Operations assistant for an AI project portfolio that also catalogs MCP (Model Context Protocol) servers.

YOU CAN ANSWER QUESTIONS ABOUT:
- Projects (status, progress, blockers, deadlines, owners, budget)
- Team (users, roles, workload, moods)
- Technologies & repositories
- Hackathons & working groups
- MCP servers (search by name/category/family/team/tag/use-case, list exposed tools)
- MCP tools (find which MCP exposes a given capability, e.g. "search", "fetch", "post message")
- MCP families and best practices
- Cross-cutting: maturity, deployment readiness, recommendations per team

STYLE:
- Be concrete: cite project names, MCP names, tool names, numbers, dates.
- Use markdown (bold, lists, tables, headers) to structure.
- Prefer short, scannable answers. Use bullet points and tables.

INLINE CHARTS — Whenever you compare quantities, show a distribution, or summarise stats, embed a chart block alongside the prose. Format (the JSON MUST be valid):

\`\`\`chart
{ "type": "bar", "title": "MCP servers by family", "data": [ { "label": "Data", "value": 5 }, { "label": "Comms", "value": 3 } ] }
\`\`\`

Chart types:
- "bar"   → horizontal bars (use for comparing counts across labels)
- "donut" → distribution / share of total
- "kpi"   → 2-4 headline metrics displayed as big numbers

Optional per-data-point "color" as a hex string (e.g. "#FF3E00"). Limit to 10 data points max.

SCOPE: Only use the data provided below — never invent projects, MCPs or tools that aren't listed.

${context}`;

      const fullPrompt = historyText
        ? `${systemPrompt}\n\n--- CONVERSATION HISTORY ---\n${historyText}\n\n--- CURRENT QUESTION ---\n${q}`
        : `${systemPrompt}\n\n${q}`;

      const out = await runPrompt(fullPrompt, llmConfig);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: out,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setHistory(saveHistoryEntry(userId, { id: assistantMsg.id, mode: 'chat', title: q.slice(0, 70), prompt: q, output: out, ts: Date.now() }));
    } catch (e: any) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error:** ${e.message}\n\nCheck your LLM configuration in Admin Settings.`,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const copy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const CANVAS_PRESETS = [
    'One-page executive portfolio review with KPI cards and a RAG chart',
    'Board deck: MCP & agent adoption, maturity charts and recommendations',
    'Data platform status report: feeds by status, consumers, risks',
    'Quarterly highlights infographic for leadership',
  ];

  return (
    <div className={`fixed inset-0 z-50 ${full ? '' : 'flex'}`}>
      {!full && <div className="flex-1 bg-black/40" onClick={onClose} />}

      {/* Panel */}
      <div className={`${full ? 'w-full' : 'w-full max-w-2xl border-l border-neutral-200 dark:border-ink-700'} h-full bg-white dark:bg-ink-900 flex flex-col shadow-2xl`}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-brand flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] truncate">DOINg Assistant</h2>
              <p className="text-[9px] text-muted uppercase tracking-[0.14em] truncate">
                {state ? `${(state.projects || []).length} projects · ${(state.mcpServers || []).length} MCP · ${(state.agents || []).length} agents` : 'No data'} · {llmConfig.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* mode toggle */}
            <div className="flex border border-neutral-300 dark:border-ink-600 overflow-hidden">
              <button onClick={() => setMode('chat')} className={`flex items-center gap-1 px-2.5 h-7 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors ${mode === 'chat' ? 'bg-brand text-white' : 'text-muted hover:text-brand'}`}><MessageSquare className="w-3 h-3" /> Chat</button>
              <button onClick={() => { setMode('canvas'); setFull(true); }} className={`flex items-center gap-1 px-2.5 h-7 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors ${mode === 'canvas' ? 'bg-brand text-white' : 'text-muted hover:text-brand'}`}><LayoutTemplate className="w-3 h-3" /> Canvas</button>
            </div>
            <div className="relative">
              <button onClick={() => setShowHistory((v) => !v)} title="Recent (last 3)" className={`w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-ink-600 transition-colors ${showHistory ? 'text-brand border-brand' : 'text-muted hover:text-brand'}`}><History className="w-3.5 h-3.5" /></button>
              {showHistory && (
                <div className="absolute right-0 mt-1 w-80 max-w-[80vw] surface border shadow-xl z-20">
                  <p className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted border-b border-neutral-200 dark:border-ink-600">Your last 3 requests</p>
                  {history.length === 0 ? (
                    <p className="px-3 py-4 text-[11px] text-muted italic">Nothing yet.</p>
                  ) : history.map((e) => (
                    <button key={e.id} onClick={() => reopenHistory(e)} className="w-full text-left px-3 py-2.5 hover:bg-neutral-100 dark:hover:bg-ink-700 border-b border-neutral-100 dark:border-ink-700 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[7px] font-bold uppercase ${e.mode === 'canvas' ? 'bg-brand/15 text-brand' : 'bg-neutral-200 dark:bg-ink-600 text-muted'}`}>{e.mode}</span>
                        <span className="text-[11px] font-semibold truncate flex-1">{e.title || 'Untitled'}</span>
                      </div>
                      <p className="text-[9px] text-muted mt-0.5">{new Date(e.ts).toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {mode === 'chat' && messages.length > 0 && (
              <button onClick={() => setMessages([])} title="Clear conversation" className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            )}
            <button onClick={() => setFull((v) => !v)} title={full ? 'Reduce' : 'Full screen'} className="w-7 h-7 flex items-center justify-center text-muted hover:text-brand transition-colors">{full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
            <button onClick={onClose} title="Close" className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {mode === 'chat' ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="py-6 max-w-2xl mx-auto w-full">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1">Ask anything — or switch to Canvas to build a report</p>
                    <p className="text-[10px] text-muted max-w-xs mx-auto">Powered by {llmConfig.provider} · {llmConfig.model}. Answers are scoped to what you can see.</p>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const suggestions = buildSuggestions(state);
                      const grouped = suggestions.reduce((acc, s) => { (acc[s.section] = acc[s.section] || []).push(s); return acc; }, {} as Record<string, typeof suggestions>);
                      return Object.entries(grouped).map(([section, items]) => (
                        <div key={section} className="space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted px-1">{section}</p>
                          {items.map((s) => (
                            <button key={s.label} onClick={() => send(s.q)} className="w-full text-left px-3 py-2.5 text-[11px] border border-neutral-200 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors bg-white dark:bg-ink-800 group">
                              <span className="text-brand mr-2 group-hover:mr-3 transition-all">›</span>{s.label}
                            </button>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className={full ? 'max-w-3xl mx-auto w-full space-y-4' : 'space-y-4'}>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-[8px] font-bold uppercase tracking-[0.14em] ${msg.role === 'user' ? 'text-brand' : 'text-muted'}`}>{msg.role === 'user' ? 'You' : 'DOINg AI'}</span>
                      <span className="text-[8px] text-muted">{fmtTime(msg.ts)}</span>
                    </div>
                    {msg.role === 'user' ? (
                      <div className="bg-brand text-white px-4 py-2.5 max-w-[85%] text-[12px] leading-relaxed">{msg.content}</div>
                    ) : (
                      <div className="group relative w-full max-w-[95%]">
                        <div className="bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 rounded-sm shadow-sm px-4 py-3.5 text-[12px] leading-relaxed">
                          {parseChartBlocks(msg.content).map((b, i) => b.kind === 'chart' ? <ChartBlock key={i} spec={b.spec} /> : <MarkdownView key={i} content={b.text} />)}
                        </div>
                        <button onClick={() => copy(msg.id, msg.content)} className="absolute -top-1 right-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 p-1" title="Copy raw text">
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-neutral-50 dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />
                      <span className="text-[10px] text-muted uppercase tracking-[0.14em]">Analyzing…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Chat input */}
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-ink-700 shrink-0 bg-white dark:bg-ink-900">
              <div className={`flex gap-2 items-end ${full ? 'max-w-3xl mx-auto' : ''}`}>
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
                  placeholder="Ask a question… (Enter to send, Shift+Enter for new line)" rows={2}
                  className="flex-1 resize-none text-[12px] border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 outline-none focus:border-brand transition-colors placeholder:text-muted disabled:opacity-50" />
                <button onClick={() => send()} disabled={loading || !input.trim()} className="w-10 h-10 flex items-center justify-center bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 shrink-0"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        ) : (
          /* ── CANVAS studio ──────────────────────────────────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-200 dark:border-ink-700 shrink-0">
              <div className="flex gap-2 items-end max-w-5xl mx-auto w-full">
                <textarea value={canvasBrief} onChange={(e) => setCanvasBrief(e.target.value)} disabled={canvasLoading}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generateCanvas(); } }}
                  placeholder="Describe the report or presentation to build… e.g. 'Board deck on MCP adoption with charts, risks and recommendations' (⌘/Ctrl+Enter)" rows={2}
                  className="flex-1 resize-none text-[12px] border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 outline-none focus:border-brand transition-colors placeholder:text-muted disabled:opacity-50" />
                <button onClick={() => generateCanvas()} disabled={canvasLoading || !canvasBrief.trim()} className="flex items-center gap-2 px-4 h-10 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 disabled:opacity-40 shrink-0">
                  {canvasLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{canvasHtml ? 'Regenerate' : 'Generate'}
                </button>
              </div>
              {!canvasHtml && !canvasLoading && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-5xl mx-auto">
                  {CANVAS_PRESETS.map((p) => (
                    <button key={p} onClick={() => generateCanvas(p)} className="px-2.5 py-1 text-[10px] border border-neutral-200 dark:border-ink-600 text-muted hover:border-brand hover:text-brand transition-colors">{p}</button>
                  ))}
                </div>
              )}
            </div>

            {/* toolbar */}
            {canvasHtml && !canvasLoading && (
              <div className="px-4 py-2 border-b border-neutral-200 dark:border-ink-700 flex items-center gap-2 shrink-0 bg-neutral-50 dark:bg-ink-800">
                <button onClick={() => { if (canvasEditable) setCanvasHtml(currentCanvasHtml()); setCanvasEditable((v) => !v); }} className={`flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border transition-colors ${canvasEditable ? 'border-brand text-brand bg-brand/5' : 'border-neutral-300 dark:border-ink-600 text-muted hover:border-brand hover:text-brand'}`}>
                  {canvasEditable ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />} {canvasEditable ? 'Editing — click to lock' : 'Edit text'}
                </button>
                <div className="flex-1" />
                <button onClick={canvasCopy} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand">{canvasCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} {canvasCopied ? 'Copied' : 'Copy HTML'}</button>
                <button onClick={canvasDownload} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand"><Download className="w-3.5 h-3.5" /> .html</button>
                <button onClick={canvasOpenTab} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand"><MessageSquare className="w-3.5 h-3.5" /> Open / Send</button>
                <button onClick={canvasExportPdf} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] bg-brand text-white hover:bg-brand/90"><Printer className="w-3.5 h-3.5" /> Export PDF</button>
              </div>
            )}

            {/* preview */}
            <div className="flex-1 overflow-hidden bg-neutral-200 dark:bg-ink-950">
              {canvasLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-brand mb-3" />
                  <p className="text-[11px] uppercase tracking-[0.16em]">Building your report with the local LLM…</p>
                </div>
              ) : canvasHtml ? (
                <iframe ref={canvasRef} title="DOINg Canvas" sandbox="allow-same-origin allow-modals"
                  srcDoc={canvasEditable ? makeEditable(canvasHtml) : canvasHtml}
                  className="w-full h-full bg-white border-0" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted px-6 text-center">
                  <LayoutTemplate className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-bold">Intelligent Canvas</p>
                  <p className="text-[11px] max-w-md mt-1">Describe a report or deck and DOINg.AI builds a complete, branded document — KPIs, charts and infographics from your real data. Edit the text inline, then export to PDF or send it.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
