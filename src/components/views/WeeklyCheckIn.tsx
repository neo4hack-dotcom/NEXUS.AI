import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Sparkles, Loader2, Save, Smile, AlertCircle, AlertTriangle, FileDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
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

const newDraftFor = (userId: string, week: string): CheckIn => ({
  id: generateId(),
  userId,
  weekOf: week,
  accomplishments: '',
  blockers: '',
  nextSteps: '',
  mood: 'green',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const formatWeek = (weekOf: string): string => {
  const d = new Date(weekOf + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const WeeklyCheckIn: React.FC<Props> = ({ state, currentUser, update }) => {
  const currentWeek = mondayOf();

  const isAdmin = currentUser.role === 'admin';

  // Build list of all weeks — admin sees all weeks, others only their own + current
  const allWeeks = useMemo(() => {
    const weeks = new Set<string>([currentWeek]);
    const source = isAdmin
      ? state.weeklyCheckIns
      : state.weeklyCheckIns.filter((c) => c.userId === currentUser.id);
    source.forEach((c) => weeks.add(c.weekOf));
    return Array.from(weeks).sort((a, b) => b.localeCompare(a));
  }, [state.weeklyCheckIns, currentWeek, isAdmin, currentUser.id]);

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const checkInForSelected = useMemo(
    () =>
      state.weeklyCheckIns.find(
        (c) => c.userId === currentUser.id && c.weekOf === selectedWeek
      ),
    [state.weeklyCheckIns, currentUser.id, selectedWeek]
  );

  const [draft, setDraft] = useState<CheckIn>(
    () => checkInForSelected ?? newDraftFor(currentUser.id, currentWeek)
  );

  // Reset draft whenever the selected week changes
  useEffect(() => {
    const existing = state.weeklyCheckIns.find(
      (c) => c.userId === currentUser.id && c.weekOf === selectedWeek
    );
    setDraft(existing ?? newDraftFor(currentUser.id, selectedWeek));
    setAiOutput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [selectedForAi, setSelectedForAi] = useState<Set<string>>(new Set());

  const save = () => {
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    update((s) => ({
      ...s,
      weeklyCheckIns: s.weeklyCheckIns.some((c) => c.id === updated.id)
        ? s.weeklyCheckIns.map((c) => (c.id === updated.id ? updated : c))
        : [...s.weeklyCheckIns, updated],
    }));
  };

  // Admin sees all team check-ins; others see only their own
  const teamCheckIns = useMemo(
    () =>
      state.weeklyCheckIns
        .filter((c) => c.weekOf === selectedWeek && (isAdmin || c.userId === currentUser.id))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [state.weeklyCheckIns, selectedWeek, isAdmin, currentUser.id]
  );

  // Reset selection when week changes
  useEffect(() => {
    setSelectedForAi(new Set());
  }, [selectedWeek]);

  const consolidate = async () => {
    setAiLoading(true);
    setAiOutput('');
    try {
      const toConsolidate =
        isAdmin && selectedForAi.size > 0
          ? teamCheckIns.filter((c) => selectedForAi.has(c.id))
          : teamCheckIns;
      const data = buildWeeklyCheckInData(toConsolidate, state.users);
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
    exportPDF(`Weekly Consolidation — Week of ${selectedWeek}`, [
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

  const isCurrentWeek = selectedWeek === currentWeek;
  const weekIdx = allWeeks.indexOf(selectedWeek);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Status</p>
          <h1 className="display-xl">Weekly Check-in</h1>
          <p className="text-sm text-muted mt-2">
            Week of <span className="font-mono text-brand">{selectedWeek}</span>.{' '}
            {isCurrentWeek ? 'Share your status to keep the team aligned.' : 'Viewing historical entry.'}
          </p>
        </div>
        <div className="flex gap-2">
          {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <>
              <Button onClick={consolidate} disabled={aiLoading || teamCheckIns.length === 0}>
                {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {isAdmin && selectedForAi.size > 0
                  ? `AI Consolidate (${selectedForAi.size})`
                  : 'AI Consolidate'}
              </Button>
              <Button variant="outline" onClick={toPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Week selector */}
        <div className="surface border">
          <div className="p-4 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-2">
            <History className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-black uppercase tracking-tight">History</h3>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-ink-600 max-h-[480px] overflow-y-auto">
            {allWeeks.map((week) => {
              const hasMyEntry = state.weeklyCheckIns.some(
                (c) => c.userId === currentUser.id && c.weekOf === week
              );
              const teamCount = state.weeklyCheckIns.filter((c) => c.weekOf === week).length;
              const isSelected = week === selectedWeek;
              return (
                <button
                  key={week}
                  onClick={() => setSelectedWeek(week)}
                  className={`w-full text-left p-3 transition-colors ${
                    isSelected
                      ? 'bg-brand text-white'
                      : 'hover:bg-neutral-50 dark:hover:bg-ink-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.12em]">
                      {formatWeek(week)}
                    </span>
                    {week === currentWeek && (
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 ${isSelected ? 'bg-white/20 text-white' : 'bg-brand/10 text-brand'}`}>
                        Now
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-[9px] uppercase tracking-[0.1em] ${isSelected ? 'text-white/70' : 'text-muted'}`}>
                    <span>{teamCount} submission{teamCount !== 1 ? 's' : ''}</span>
                    {hasMyEntry && <span>• mine ✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {allWeeks.length > 1 && (
            <div className="p-2 border-t border-neutral-200 dark:border-ink-600 flex gap-1">
              <button
                onClick={() => weekIdx > 0 && setSelectedWeek(allWeeks[weekIdx - 1])}
                disabled={weekIdx === 0}
                className="flex-1 h-8 flex items-center justify-center border border-neutral-300 dark:border-ink-500 disabled:opacity-30 hover:border-brand hover:text-brand transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => weekIdx < allWeeks.length - 1 && setSelectedWeek(allWeeks[weekIdx + 1])}
                disabled={weekIdx === allWeeks.length - 1}
                className="flex-1 h-8 flex items-center justify-center border border-neutral-300 dark:border-ink-500 disabled:opacity-30 hover:border-brand hover:text-brand transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* My check-in form */}
        <div className="lg:col-span-2 surface border">
          <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-brand" />
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">
                  My status — {currentUser.firstName}
                </h2>
                {!isCurrentWeek && (
                  <p className="text-[9px] uppercase tracking-[0.14em] text-amber-500 font-bold mt-0.5">
                    Editing past week
                  </p>
                )}
              </div>
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

        {/* Team check-ins for selected week */}
        <div className="surface border">
          <div className="p-4 border-b border-neutral-200 dark:border-ink-600">
            <p className="label-xs">{isAdmin ? 'Team' : 'My submission'}</p>
            <h3 className="text-lg font-black uppercase tracking-tight">This week</h3>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                {teamCheckIns.length} submission{teamCheckIns.length !== 1 ? 's' : ''}
              </p>
              {isAdmin && teamCheckIns.length > 0 && (
                <button
                  onClick={() =>
                    setSelectedForAi(
                      selectedForAi.size === teamCheckIns.length
                        ? new Set()
                        : new Set(teamCheckIns.map((c) => c.id))
                    )
                  }
                  className="text-[9px] font-bold uppercase tracking-[0.12em] text-brand hover:underline"
                >
                  {selectedForAi.size === teamCheckIns.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            {isAdmin && selectedForAi.size > 0 && (
              <p className="text-[9px] text-amber-500 font-bold uppercase tracking-[0.1em] mt-1">
                {selectedForAi.size} selected for AI
              </p>
            )}
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-ink-600 max-h-[600px] overflow-y-auto">
            {teamCheckIns.map((c) => {
              const u = state.users.find((x) => x.id === c.userId);
              const isSelected = selectedForAi.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`p-4 text-xs transition-colors ${isAdmin ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-ink-700' : ''} ${isAdmin && isSelected ? 'bg-brand/5 border-l-2 border-brand' : ''}`}
                  onClick={isAdmin ? () => {
                    const next = new Set(selectedForAi);
                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                    setSelectedForAi(next);
                  } : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <div className={`w-3.5 h-3.5 border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand border-brand' : 'border-neutral-300 dark:border-ink-500'}`}>
                          {isSelected && <span className="text-white text-[8px]">✓</span>}
                        </div>
                      )}
                      <p className="font-bold uppercase tracking-tight">
                        {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                      </p>
                    </div>
                    <Badge tone={c.mood === 'green' ? 'green' : c.mood === 'amber' ? 'amber' : 'red'}>
                      {c.mood}
                    </Badge>
                  </div>
                  <p className="text-muted line-clamp-2 ml-5">{c.accomplishments || '—'}</p>
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
          <p className="label-xs mb-2">AI Consolidation — Week of {selectedWeek}</p>
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
