import React, { useMemo } from 'react';
import {
  Target,
  Users,
  Cpu,
  Activity,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AppState, User, ProjectStatus, TaskStatus } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { TabId } from '../Sidebar';

interface Props {
  state: AppState;
  currentUser: User;
  setActiveTab: (t: TabId) => void;
  onOpenAi: () => void;
}

const projectHealth = (
  p: AppState['projects'][number]
): { label: string; tone: 'green' | 'amber' | 'red' | 'muted' } => {
  if (p.status === ProjectStatus.DONE) return { label: 'Done', tone: 'muted' };
  const blocked = (p.tasks || []).filter((t) => t.status === TaskStatus.BLOCKED).length;
  const overdue = new Date(p.deadline).getTime() < Date.now();
  if (overdue || blocked > 2) return { label: 'Off Track', tone: 'red' };
  const sevenDaysMs = 7 * 24 * 3600 * 1000;
  if (blocked > 0 || new Date(p.deadline).getTime() - Date.now() < sevenDaysMs)
    return { label: 'At Risk', tone: 'amber' };
  return { label: 'On Track', tone: 'green' };
};

export const Dashboard: React.FC<Props> = ({ state, currentUser, setActiveTab, onOpenAi }) => {
  const stats = useMemo(() => {
    const active = state.projects.filter((p) => p.status === ProjectStatus.ACTIVE).length;
    const tasks = state.projects.flatMap((p) => p.tasks || []);
    const inProgress = tasks.filter((t) => t.status === TaskStatus.ONGOING).length;
    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
    return {
      activeProjects: active,
      totalProjects: state.projects.length,
      contributors: state.users.length,
      technologies: state.technologies.length,
      tasks: tasks.length,
      tasksDone: done,
      tasksInProgress: inProgress,
      tasksBlocked: blocked,
      doneRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  }, [state]);

  const upcoming = useMemo(() => {
    const items: { name: string; date: string; project: string }[] = [];
    state.projects.forEach((p) => {
      (p.milestones || []).forEach((m) => {
        if (!m.done) items.push({ name: m.label, date: m.date, project: p.name });
      });
    });
    return items
      .filter((m) => new Date(m.date).getTime() > Date.now() - 86400000)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [state]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
            Welcome back, {currentUser.firstName}
          </p>
          <h1 className="display-xl">Global Dashboard</h1>
          <p className="text-sm text-muted mt-3 max-w-xl">
            Centralised operational view across all AI initiatives, contributors and technologies.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab('timeline')}>
            View Timeline
            <ArrowRight className="w-3 h-3 ml-2" />
          </Button>
          <Button onClick={onOpenAi}>
            <Sparkles className="w-4 h-4 mr-2" />
            AI Insight
          </Button>
        </div>
      </div>

      {/* Big KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Active Projects',
            value: stats.activeProjects,
            sub: `${stats.totalProjects} total`,
            icon: Target,
            accent: 'text-brand',
          },
          {
            label: 'Contributors',
            value: stats.contributors,
            sub: `${new Set(state.users.map((u) => u.team)).size} teams`,
            icon: Users,
            accent: 'text-emerald-500',
          },
          {
            label: 'Tasks in flight',
            value: stats.tasksInProgress,
            sub: `${stats.tasksBlocked} blocked · ${stats.tasksDone} done`,
            icon: Activity,
            accent: 'text-blue-400',
          },
          {
            label: 'Completion rate',
            value: `${stats.doneRate}%`,
            sub: `${stats.tasks} tasks tracked`,
            icon: CheckCircle2,
            accent: 'text-amber-400',
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="surface border p-5 flex items-start justify-between"
            >
              <div>
                <p className="label-xs mb-2">{s.label}</p>
                <p className="text-4xl font-black tracking-tighter">{s.value}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted mt-2">
                  {s.sub}
                </p>
              </div>
              <div className={`p-2 border surface-flat ${s.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Projects + Right column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 surface border">
          <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-ink-600">
            <div>
              <p className="label-xs">Portfolio</p>
              <h3 className="text-xl font-black uppercase tracking-tight">Recent Projects</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('projects')}>
              All projects
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-ink-600">
            {state.projects.slice(0, 6).map((p) => {
              const h = projectHealth(p);
              const tasks = p.tasks || [];
              const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
              const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTab('projects')}
                  className="w-full text-left p-5 hover:bg-neutral-50 dark:hover:bg-ink-800 transition-colors flex items-center gap-4"
                >
                  <div
                    className={`w-1 h-12 ${
                      h.tone === 'green'
                        ? 'bg-emerald-500'
                        : h.tone === 'amber'
                        ? 'bg-amber-500'
                        : h.tone === 'red'
                        ? 'bg-red-500'
                        : 'bg-neutral-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold uppercase tracking-tight truncate">{p.name}</p>
                      <Badge tone={h.tone}>{h.label}</Badge>
                      {p.isImportant && <Badge tone="brand">priority</Badge>}
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">{p.description}</p>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1 w-32">
                    <p className="text-xs font-mono">{pct}% complete</p>
                    <div className="w-full h-1 bg-neutral-200 dark:bg-ink-700 overflow-hidden">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted">
                      due {new Date(p.deadline).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              );
            })}
            {state.projects.length === 0 && (
              <p className="p-10 text-center text-sm text-muted">No projects yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Upcoming milestones */}
          <div className="surface border">
            <div className="p-4 border-b border-neutral-200 dark:border-ink-600">
              <p className="label-xs">Next Up</p>
              <h3 className="text-lg font-black uppercase tracking-tight">Milestones</h3>
            </div>
            <div className="p-2">
              {upcoming.length === 0 && (
                <p className="text-xs text-muted px-3 py-6 text-center">
                  No upcoming milestones.
                </p>
              )}
              {upcoming.map((m, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-ink-800"
                >
                  <div className="w-1.5 h-1.5 bg-brand mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight">{m.name}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted mt-0.5">
                      {m.project} • {new Date(m.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack snapshot */}
          <div className="surface border">
            <div className="p-4 border-b border-neutral-200 dark:border-ink-600">
              <p className="label-xs">Technology</p>
              <h3 className="text-lg font-black uppercase tracking-tight">Stack snapshot</h3>
            </div>
            <div className="p-4 space-y-2">
              {Object.entries(
                state.technologies.reduce<Record<string, number>>((acc, t) => {
                  acc[t.category] = (acc[t.category] || 0) + 1;
                  return acc;
                }, {})
              ).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted">{cat}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 mt-2 border-t border-neutral-200 dark:border-ink-600">
                <Cpu className="w-4 h-4 text-brand" />
                <span className="text-sm">{state.technologies.length} tracked</span>
                <GitBranch className="w-4 h-4 text-brand ml-auto" />
                <span className="text-sm">{state.repositories.length} repos</span>
              </div>
            </div>
          </div>

          {/* Risks */}
          <button
            onClick={() => setActiveTab('risk')}
            className="surface border w-full p-4 flex items-center gap-3 text-left hover:border-brand transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div className="flex-1">
              <p className="label-xs">Heatmap</p>
              <p className="text-sm font-bold">Open the RAG risk view</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted" />
          </button>
        </div>
      </div>
    </div>
  );
};
