import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Trash2, Loader2, Copy, Check, ChevronDown } from 'lucide-react';
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

  const sections: string[] = [
    `=== DOINg.AI CONTEXT (${new Date().toLocaleDateString('en-GB')} — ${projects.length} projects, ${users.length} users) ===`,
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
  ];

  return sections.join('\n');
};

/* ─── Suggested questions ────────────────────────────────────────── */

const SUGGESTIONS = [
  'What is the overall health of our project portfolio?',
  'Which projects are at risk or overdue?',
  'Give me a team workload analysis.',
  'What are the top blockers across all projects?',
  'Summarize recent team moods and flag concerns.',
  'Which technologies are we using the most?',
  'What milestones are coming up in the next 30 days?',
  'Give me an executive summary for leadership.',
];

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

/* ─── Component ─────────────────────────────────────────────────── */

export const NexusAssistant: React.FC<Props> = ({ open, onClose, state, llmConfig }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        `You are DOINg.AI, an expert AI Operations assistant. ` +
        `Answer questions precisely using ONLY the data provided below. ` +
        `When asked for charts or graphs, produce clean ASCII/Unicode diagrams or SVG-style text tables. ` +
        `When asked for analysis, be concrete and cite project names, numbers, and dates. ` +
        `Use markdown (bold, lists, tables) to structure your response clearly.\n\n` +
        `SCOPE: You only have access to the data shown below — do not speculate beyond it.\n\n` +
        `${context}`;

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

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl h-full bg-white dark:bg-ink-900 border-l border-neutral-200 dark:border-ink-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <path d="M12 17h.01"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em]">DOINg Assistant</h2>
              <p className="text-[9px] text-muted uppercase tracking-[0.14em]">
                {state ? `${(state.projects || []).length} projects · ${(state.users || []).length} users` : 'No data'} · {llmConfig.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-muted hover:text-red-500 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-neutral-900 dark:hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <path d="M12 17h.01"/>
                  </svg>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1">Ask anything about your portfolio</p>
                <p className="text-[10px] text-muted max-w-xs mx-auto">
                  Powered by {llmConfig.provider} · {llmConfig.model}. Answers are scoped to what you can see.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted px-1 mb-2">Suggested questions</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left px-3 py-2.5 text-[11px] border border-neutral-200 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors bg-white dark:bg-ink-800 group"
                  >
                    <span className="text-brand mr-2 group-hover:mr-3 transition-all">›</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <span className={`text-[8px] font-bold uppercase tracking-[0.14em] ${msg.role === 'user' ? 'text-brand' : 'text-muted'}`}>
                  {msg.role === 'user' ? 'You' : 'DOINg AI'}
                </span>
                <span className="text-[8px] text-muted">{fmtTime(msg.ts)}</span>
              </div>

              {msg.role === 'user' ? (
                <div className="bg-brand text-white px-4 py-2.5 max-w-[85%] text-[12px] leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="group relative w-full max-w-[95%]">
                  <div className="bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 rounded-sm shadow-sm px-4 py-3.5 text-[12px] leading-relaxed">
                    <MarkdownView content={msg.content} />
                  </div>
                  <button
                    onClick={() => copy(msg.id, msg.content)}
                    className="absolute -top-1 right-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 p-1"
                    title="Copy raw text"
                  >
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

        {/* Input */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-ink-700 shrink-0 bg-white dark:bg-ink-900">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="flex-1 resize-none text-[12px] border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 outline-none focus:border-brand transition-colors placeholder:text-muted disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 flex items-center justify-center bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[8px] text-muted mt-1.5 uppercase tracking-[0.12em]">
            Scoped to your access level · powered by {llmConfig.provider}
          </p>
        </div>
      </div>
    </div>
  );
};
