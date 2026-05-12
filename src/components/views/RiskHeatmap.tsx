import React, { useMemo, useState } from 'react';
import { AlertTriangle, Sparkles, Loader2, FileDown } from 'lucide-react';
import { AppState, Project, ProjectStatus, TaskStatus, User } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DEFAULT_PROMPTS, fillTemplate, runPrompt, buildPortfolioSummaryData } from '../../services/llmService';
import { exportPDF } from '../../services/exports';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type RAG = 'green' | 'amber' | 'red';

const ragFor = (p: Project): { rag: RAG; reasons: string[] } => {
  const reasons: string[] = [];
  let rag: RAG = 'green';
  const now = Date.now();
  const tasks = p.tasks || [];
  const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
  const overdue = new Date(p.deadline).getTime() < now && p.status !== ProjectStatus.DONE;
  const lateTasks = tasks.filter(
    (t) => t.status !== TaskStatus.DONE && new Date(t.currentEta || t.originalEta).getTime() < now
  ).length;
  const stale =
    now - new Date(p.updatedAt).getTime() > 14 * 24 * 3600 * 1000 && p.status === ProjectStatus.ACTIVE;

  if (overdue) {
    rag = 'red';
    reasons.push('Past deadline');
  } else if (blocked > 2) {
    rag = 'red';
    reasons.push(`${blocked} blocked tasks`);
  } else if (lateTasks > 0) {
    rag = 'amber';
    reasons.push(`${lateTasks} late tasks`);
  } else if (blocked > 0) {
    rag = 'amber';
    reasons.push(`${blocked} blocked`);
  }
  if (stale && rag === 'green') {
    rag = 'amber';
    reasons.push('No update in 14+ days');
  }

  if (rag === 'green') reasons.push('On track');
  return { rag, reasons };
};

export const RiskHeatmap: React.FC<Props> = ({ state }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');

  const scored = useMemo(
    () =>
      state.projects
        .filter((p) => !p.isArchived)
        .map((p) => ({ p, ...ragFor(p) })),
    [state.projects]
  );

  const counts = useMemo(
    () => ({
      green: scored.filter((s) => s.rag === 'green').length,
      amber: scored.filter((s) => s.rag === 'amber').length,
      red: scored.filter((s) => s.rag === 'red').length,
    }),
    [scored]
  );

  const generateAssessment = async () => {
    setAiLoading(true);
    setAiOutput('');
    try {
      const data =
        buildPortfolioSummaryData(state) +
        '\n\nRAG SUMMARY: ' +
        `Green=${counts.green}, Amber=${counts.amber}, Red=${counts.red}`;
      const tpl = state.prompts['risk_assessment'] || DEFAULT_PROMPTS.risk_assessment;
      const out = await runPrompt(fillTemplate(tpl, { DATA: data }), state.llmConfig);
      setAiOutput(out);
    } catch (e: any) {
      setAiOutput(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const toPDF = () => {
    exportPDF('Portfolio Risk Heatmap', [
      {
        heading: 'RAG Distribution',
        body: `**Green:** ${counts.green}\n\n**Amber:** ${counts.amber}\n\n**Red:** ${counts.red}\n\n`,
      },
      {
        heading: 'Projects',
        body: scored
          .map(
            (s) =>
              `- **${s.p.name}** — ${s.rag.toUpperCase()} — ${s.reasons.join(', ')}`
          )
          .join('\n'),
      },
      ...(aiOutput ? [{ heading: 'AI Risk Assessment', body: aiOutput }] : []),
    ]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Portfolio Risk</p>
          <h1 className="display-xl">Heatmap</h1>
          <p className="text-sm text-muted mt-2">
            RAG status by project. {state.projects.length} tracked.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateAssessment} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Risk Assessment
          </Button>
          <Button variant="outline" onClick={toPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Green" count={counts.green} total={scored.length} color="bg-emerald-500" />
        <Tile label="Amber" count={counts.amber} total={scored.length} color="bg-amber-500" />
        <Tile label="Red" count={counts.red} total={scored.length} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {scored
          .sort((a, b) => (a.rag === 'red' ? -1 : b.rag === 'red' ? 1 : a.rag === 'amber' ? -1 : 1))
          .map((s) => {
            const tone = s.rag === 'green' ? 'green' : s.rag === 'amber' ? 'amber' : 'red';
            return (
              <div
                key={s.p.id}
                className={`surface border p-4 border-l-4 ${
                  s.rag === 'green'
                    ? 'border-l-emerald-500'
                    : s.rag === 'amber'
                    ? 'border-l-amber-500'
                    : 'border-l-red-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-black uppercase tracking-tight">{s.p.name}</h3>
                  <Badge tone={tone}>{s.rag}</Badge>
                </div>
                <ul className="mt-3 space-y-1">
                  {s.reasons.map((r) => (
                    <li
                      key={r}
                      className="flex items-center gap-2 text-xs text-muted"
                    >
                      <AlertTriangle
                        className={`w-3 h-3 ${
                          s.rag === 'red'
                            ? 'text-red-500'
                            : s.rag === 'amber'
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between mt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
                  <span>{s.p.status}</span>
                  <span>due {new Date(s.p.deadline).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
      </div>

      {aiOutput && (
        <div className="surface-flat border p-5">
          <p className="label-xs mb-2">AI Assessment</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {aiOutput}
          </pre>
        </div>
      )}
    </div>
  );
};

const Tile: React.FC<{ label: string; count: number; total: number; color: string }> = ({
  label,
  count,
  total,
  color,
}) => {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="surface border p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs">{label}</p>
        <span className={`w-3 h-3 ${color}`} />
      </div>
      <p className="text-4xl font-black mt-2">{count}</p>
      <div className="w-full h-1 bg-neutral-200 dark:bg-ink-700 mt-3 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted mt-2">
        {pct}% of portfolio
      </p>
    </div>
  );
};
