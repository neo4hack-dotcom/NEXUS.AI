/**
 * Reports (#3) — periodic auto-generated portfolio digests.
 *
 * Compiles a structured snapshot of the portfolio (project RAG, recent
 * check-ins, new wishes, agents in production, OKR progress) and asks the
 * local LLM to turn it into an executive-grade Markdown digest. The user picks
 * a period (this week / this month) and generates on demand; the result can be
 * copied or downloaded as Markdown.
 *
 * "Scheduling" here is surfaced as guidance — the digest is deterministic from
 * current state, so re-running on a cadence reproduces the period's report.
 */

import React, { useMemo, useState } from 'react';
import { FileBarChart, Sparkles, Loader2, Copy, Check, Download, CalendarRange } from 'lucide-react';
import { AppState, User, ProjectStatus, TaskStatus } from '../../types';
import { runPrompt } from '../../services/llmService';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type Period = 'week' | 'month';

const periodStartMs = (p: Period): number => {
  const d = new Date();
  if (p === 'week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d.getTime();
};

const ragOf = (p: { isArchived?: boolean; status: ProjectStatus; deadline: string; tasks?: { status: TaskStatus }[] }): string => {
  if (p.isArchived || p.status === ProjectStatus.DONE) return 'Done';
  const blocked = (p.tasks || []).filter((t) => t.status === TaskStatus.BLOCKED).length;
  const overdue = new Date(p.deadline).getTime() < Date.now();
  if (overdue || blocked > 0) return 'Off Track';
  if (p.status === ProjectStatus.PAUSED) return 'At Risk';
  return 'On Track';
};

export const Reports: React.FC<Props> = ({ state }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const snapshot = useMemo(() => {
    const since = periodStartMs(period);
    const active = state.projects.filter((p) => !p.isArchived);
    const rag = { 'On Track': 0, 'At Risk': 0, 'Off Track': 0, Done: 0 } as Record<string, number>;
    active.forEach((p) => { rag[ragOf(p)]++; });
    const recentCheckins = state.weeklyCheckIns.filter((c) => new Date(c.updatedAt).getTime() >= since);
    const newWishes = (state.wishes ?? []).filter((w) => new Date(w.createdAt).getTime() >= since);
    const prodAgents = (state.agents ?? []).filter((a) => a.status === 'production');
    return { active, rag, recentCheckins, newWishes, prodAgents };
  }, [state, period]);

  const buildDataBlock = (): string => {
    const lines: string[] = [];
    lines.push(`PERIOD: last ${period}`);
    lines.push(`ACTIVE PROJECTS: ${snapshot.active.length}`);
    lines.push(`RAG: On Track ${snapshot.rag['On Track']}, At Risk ${snapshot.rag['At Risk']}, Off Track ${snapshot.rag['Off Track']}, Done ${snapshot.rag['Done']}`);
    lines.push('');
    lines.push('PROJECTS:');
    snapshot.active.slice(0, 40).forEach((p) => {
      lines.push(`- ${p.name} [${ragOf(p)}] status=${p.status} deadline=${p.deadline}`);
    });
    lines.push('');
    lines.push(`WEEKLY CHECK-INS THIS PERIOD: ${snapshot.recentCheckins.length}`);
    snapshot.recentCheckins.slice(0, 20).forEach((c) => {
      const u = state.users.find((x) => x.id === c.userId);
      lines.push(`- ${u ? u.firstName + ' ' + u.lastName : c.userId} [${c.mood}]: ${(c.accomplishments || '').slice(0, 120)}`);
    });
    lines.push('');
    lines.push(`NEW WISHES: ${snapshot.newWishes.length}`);
    snapshot.newWishes.slice(0, 15).forEach((w) => lines.push(`- ${w.title} (${w.category}, ${w.status})`));
    lines.push('');
    lines.push(`AGENTS IN PRODUCTION: ${snapshot.prodAgents.length}`);
    snapshot.prodAgents.slice(0, 15).forEach((a) => lines.push(`- ${a.name}`));
    return lines.join('\n');
  };

  const generate = async () => {
    setLoading(true); setError(''); setReport('');
    const prompt = `You are DOINg.AI, an executive operations assistant. Produce a concise, professional ${period === 'week' ? 'weekly' : 'monthly'} portfolio digest in English, formatted as clean Markdown with short sections and bullet points. Cover: overall health, projects needing attention, team sentiment from check-ins, notable new wishes, and agents shipped to production. Be specific and reference names. Do not invent data beyond what is given.\n\nDATA:\n${buildDataBlock()}`;
    try {
      const out = await runPrompt(prompt, state.llmConfig);
      setReport(out);
    } catch (e: any) {
      setError(e?.message || 'Generation failed. Check the LLM connection in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => { navigator.clipboard?.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `doing-ai-${period}-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div>
        <p className="label-xs">AI-generated</p>
        <h1 className="display-xl flex items-center gap-3"><FileBarChart className="w-7 h-7 text-brand" /> Reports</h1>
        <p className="text-sm text-muted mt-1">Compile an executive portfolio digest with your local LLM.</p>
      </div>

      <div className="surface border p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5 text-muted" />
            {(['week', 'month'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                  period === p ? 'bg-brand text-white border-brand'
                  : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'}`}>
                {p === 'week' ? 'This week' : 'This month'}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={loading}
            className="ml-auto flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 disabled:opacity-40">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate digest'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'On Track', value: snapshot.rag['On Track'], accent: 'text-emerald-600' },
            { label: 'At Risk', value: snapshot.rag['At Risk'], accent: 'text-amber-600' },
            { label: 'Off Track', value: snapshot.rag['Off Track'], accent: 'text-red-600' },
            { label: 'Check-ins', value: snapshot.recentCheckins.length, accent: 'text-brand' },
          ].map((k) => (
            <div key={k.label} className="border border-neutral-200 dark:border-ink-600 p-2">
              <p className={`text-xl font-black ${k.accent}`}>{k.value}</p>
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-muted">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="surface border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-[11px] text-red-600">{error}</div>
      )}

      {report && (
        <div className="surface border">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-ink-600">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{period === 'week' ? 'Weekly' : 'Monthly'} digest</span>
            <div className="flex gap-2">
              <button onClick={copy} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={download} className="flex items-center gap-1.5 px-2.5 h-8 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand">
                <Download className="w-3.5 h-3.5" /> .md
              </button>
            </div>
          </div>
          <pre className="p-5 text-[12px] leading-relaxed whitespace-pre-wrap font-sans">{report}</pre>
        </div>
      )}
    </div>
  );
};
