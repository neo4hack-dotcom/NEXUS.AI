import React, { useMemo, useState } from 'react';
import { ClipboardList, Sparkles, Loader2, Save, Smile, AlertCircle, AlertTriangle, FileDown } from 'lucide-react';
import { MarkdownView } from '../ui/MarkdownView';
import { AppState, User, WeeklyCheckIn as CheckIn } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea } from '../ui/Input';
import { generateId } from '../../services/storage';
import {
  DEFAULT_PROMPTS,
  buildWeeklyCheckInData,
  fillTemplate,
  runPrompt,
} from '../../services/llmService';
import { exportPDF } from '../../services/exports';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const mondayOf = (d = new Date()): string => {
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day + 1);
  return monday.toISOString().slice(0, 10);
};

export const WeeklyCheckIn: React.FC<Props> = ({ state, currentUser, update }) => {
  const weekOf = mondayOf();
  const existing = state.weeklyCheckIns.find(
    (c) => c.userId === currentUser.id && c.weekOf === weekOf
  );

  const [draft, setDraft] = useState<CheckIn>(
    existing || {
      id: generateId(),
      userId: currentUser.id,
      weekOf,
      accomplishments: '',
      blockers: '',
      nextSteps: '',
      mood: 'green',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');

  const save = () => {
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    update((s) => ({
      ...s,
      weeklyCheckIns: s.weeklyCheckIns.some((c) => c.id === updated.id)
        ? s.weeklyCheckIns.map((c) => (c.id === updated.id ? updated : c))
        : [...s.weeklyCheckIns, updated],
    }));
  };

  const teamCheckIns = useMemo(
    () =>
      state.weeklyCheckIns
        .filter((c) => c.weekOf === weekOf)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [state.weeklyCheckIns, weekOf]
  );

  const consolidate = async () => {
    setAiLoading(true);
    setAiOutput('');
    try {
      const data = buildWeeklyCheckInData(teamCheckIns, state.users);
      const tpl = state.prompts['weekly_consolidation'] || DEFAULT_PROMPTS.weekly_consolidation;
      const out = await runPrompt(fillTemplate(tpl, { DATA: data }), state.llmConfig);
      setAiOutput(out);
    } catch (e: any) {
      setAiOutput(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const toPDF = () => {
    exportPDF(`Weekly Consolidation — Week of ${weekOf}`, [
      {
        heading: 'Submissions',
        body: buildWeeklyCheckInData(teamCheckIns, state.users)
          .split('\n\n')
          .map((s) => s.replace(/\n/g, '\n\n'))
          .join('\n\n---\n\n'),
      },
      ...(aiOutput ? [{ heading: 'AI Consolidation', body: aiOutput }] : []),
    ]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Status</p>
          <h1 className="display-xl">Weekly Check-in</h1>
          <p className="text-sm text-muted mt-2">
            Week of <span className="font-mono text-brand">{weekOf}</span>. Share your status to keep the
            team aligned.
          </p>
        </div>
        <div className="flex gap-2">
          {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <>
              <Button onClick={consolidate} disabled={aiLoading || teamCheckIns.length === 0}>
                {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                AI Consolidate
              </Button>
              <Button variant="outline" onClick={toPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My check-in form */}
        <div className="lg:col-span-2 surface border">
          <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-black uppercase tracking-tight">
                My status — {currentUser.firstName}
              </h2>
            </div>
            <MoodSelector value={draft.mood} onChange={(m) => setDraft({ ...draft, mood: m })} />
          </div>
          <div className="p-5 space-y-4">
            <Field label="Accomplishments">
              <Textarea
                value={draft.accomplishments}
                onChange={(e) => setDraft({ ...draft, accomplishments: e.target.value })}
                placeholder="What did you ship or move forward this week?"
              />
            </Field>
            <Field label="Blockers">
              <Textarea
                value={draft.blockers}
                onChange={(e) => setDraft({ ...draft, blockers: e.target.value })}
                placeholder="What is in your way?"
              />
            </Field>
            <Field label="Next steps">
              <Textarea
                value={draft.nextSteps}
                onChange={(e) => setDraft({ ...draft, nextSteps: e.target.value })}
                placeholder="Where do you focus next week?"
              />
            </Field>
          </div>
          <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end">
            <Button onClick={save}>
              <Save className="w-4 h-4 mr-2" />
              Save check-in
            </Button>
          </div>
        </div>

        {/* Team check-ins */}
        <div className="surface border">
          <div className="p-4 border-b border-neutral-200 dark:border-ink-600">
            <p className="label-xs">Team</p>
            <h3 className="text-lg font-black uppercase tracking-tight">This week</h3>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted mt-1">
              {teamCheckIns.length} submission{teamCheckIns.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-ink-600 max-h-[600px] overflow-y-auto">
            {teamCheckIns.map((c) => {
              const u = state.users.find((x) => x.id === c.userId);
              return (
                <div key={c.id} className="p-4 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold uppercase tracking-tight">
                      {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                    </p>
                    <Badge tone={c.mood === 'green' ? 'green' : c.mood === 'amber' ? 'amber' : 'red'}>
                      {c.mood}
                    </Badge>
                  </div>
                  <p className="text-muted line-clamp-2">{c.accomplishments || '—'}</p>
                </div>
              );
            })}
            {teamCheckIns.length === 0 && (
              <p className="p-6 text-center text-xs text-muted">No submissions yet.</p>
            )}
          </div>
        </div>
      </div>

      {aiOutput && (
        <div className="surface-flat border p-5">
          <p className="label-xs mb-2">AI Consolidation</p>
          <MarkdownView content={aiOutput} />
        </div>
      )}
    </div>
  );
};

const MoodSelector: React.FC<{
  value: CheckIn['mood'];
  onChange: (m: CheckIn['mood']) => void;
}> = ({ value, onChange }) => {
  const moods: { v: CheckIn['mood']; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
    { v: 'green', icon: Smile, tone: 'text-emerald-500 border-emerald-500' },
    { v: 'amber', icon: AlertCircle, tone: 'text-amber-500 border-amber-500' },
    { v: 'red', icon: AlertTriangle, tone: 'text-red-500 border-red-500' },
  ];
  return (
    <div className="flex items-center gap-1">
      {moods.map(({ v, icon: Icon, tone }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`w-9 h-9 flex items-center justify-center border transition-all ${
            value === v ? tone : 'border-neutral-300 dark:border-ink-500 text-muted hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="label-xs">{label}</label>
    {children}
  </div>
);
