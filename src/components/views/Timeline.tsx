import React, { useMemo, useState } from 'react';
import { Calendar, Flag, Filter } from 'lucide-react';
import { AppState, ProjectStatus } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface Props {
  state: AppState;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const Timeline: React.FC<Props> = ({ state }) => {
  const [includeDone, setIncludeDone] = useState(false);

  const visible = useMemo(
    () =>
      state.projects.filter(
        (p) => !p.isArchived && (includeDone || p.status !== ProjectStatus.DONE)
      ),
    [state.projects, includeDone]
  );

  const { min, max, totalDays } = useMemo(() => {
    if (visible.length === 0) {
      const now = Date.now();
      return { min: now, max: now + 90 * 86400000, totalDays: 90 };
    }
    const starts = visible.map((p) => new Date(p.startDate).getTime());
    const ends = visible.map((p) => new Date(p.deadline).getTime());
    const minTs = Math.min(...starts) - 7 * 86400000;
    const maxTs = Math.max(...ends) + 7 * 86400000;
    return {
      min: minTs,
      max: maxTs,
      totalDays: Math.max(30, (maxTs - minTs) / 86400000),
    };
  }, [visible]);

  const monthMarkers = useMemo(() => {
    const out: { label: string; pct: number }[] = [];
    const start = new Date(min);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor.getTime() < max) {
      const pct = ((cursor.getTime() - min) / (max - min)) * 100;
      out.push({ label: `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear().toString().slice(2)}`, pct });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [min, max]);

  const todayPct = ((Date.now() - min) / (max - min)) * 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Portfolio</p>
          <h1 className="display-xl">Timeline</h1>
          <p className="text-sm text-muted mt-2">
            High-level Gantt across {visible.length} projects · {Math.round(totalDays)} days span.
          </p>
        </div>
        <Button variant="outline" onClick={() => setIncludeDone((v) => !v)}>
          <Filter className="w-4 h-4 mr-2" />
          {includeDone ? 'Hide completed' : 'Show completed'}
        </Button>
      </div>

      <div className="surface border overflow-hidden">
        {/* Header row with month markers */}
        <div className="relative h-10 border-b border-neutral-200 dark:border-ink-600 px-3">
          {monthMarkers.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex items-center text-[10px] font-mono uppercase tracking-[0.16em] text-muted"
              style={{ left: `${m.pct}%` }}
            >
              <span className="ml-1">{m.label}</span>
              <span className="absolute top-0 bottom-0 w-px bg-neutral-200 dark:bg-ink-600" />
            </div>
          ))}
          {/* Today line */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-brand"
              style={{ left: `${todayPct}%` }}
              title="Today"
            />
          )}
        </div>

        {/* Project rows */}
        <div className="divide-y divide-neutral-200 dark:divide-ink-600">
          {visible.map((p) => {
            const startPct = ((new Date(p.startDate).getTime() - min) / (max - min)) * 100;
            const endPct = ((new Date(p.deadline).getTime() - min) / (max - min)) * 100;
            const width = Math.max(2, endPct - startPct);
            const overdue = new Date(p.deadline).getTime() < Date.now() && p.status !== 'Done';
            return (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center px-3 py-3">
                <div className="col-span-12 md:col-span-3 min-w-0">
                  <p className="text-sm font-bold uppercase tracking-tight truncate">{p.name}</p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                    {p.status}
                  </p>
                </div>
                <div className="col-span-12 md:col-span-9 relative h-10">
                  {/* Today line */}
                  {todayPct >= 0 && todayPct <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-brand/50 z-10 pointer-events-none"
                      style={{ left: `${todayPct}%` }}
                    />
                  )}
                  <div
                    className={`absolute top-2 h-6 ${
                      overdue ? 'bg-red-500/80' : p.status === 'Done' ? 'bg-emerald-500/70' : 'bg-brand/80'
                    } text-white text-[10px] font-bold uppercase tracking-[0.14em] flex items-center px-2 whitespace-nowrap overflow-hidden`}
                    style={{ left: `${Math.max(0, startPct)}%`, width: `${width}%` }}
                    title={`${new Date(p.startDate).toLocaleDateString()} → ${new Date(
                      p.deadline
                    ).toLocaleDateString()}`}
                  >
                    {Math.round(width) > 5 && <span className="truncate">{p.name}</span>}
                  </div>
                  {(p.milestones || []).map((m) => {
                    const mp = ((new Date(m.date).getTime() - min) / (max - min)) * 100;
                    if (mp < 0 || mp > 100) return null;
                    return (
                      <div
                        key={m.id}
                        className="absolute top-1.5 -translate-x-1/2"
                        style={{ left: `${mp}%` }}
                        title={`${m.label} (${new Date(m.date).toLocaleDateString()})`}
                      >
                        <Flag
                          className={`w-4 h-4 ${
                            m.done ? 'text-emerald-500 fill-emerald-500' : 'text-amber-500 fill-amber-500'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="text-center text-sm text-muted py-12">No projects in range.</p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-brand/80" /> On track
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500/80" /> Overdue
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-emerald-500/70" /> Done
        </span>
        <span className="flex items-center gap-2">
          <Flag className="w-3 h-3 text-amber-500 fill-amber-500" /> Milestone
        </span>
        <span className="flex items-center gap-2">
          <span className="w-px h-3 bg-brand" /> Today
        </span>
        <Badge tone="muted" className="ml-auto">
          <Calendar className="w-3 h-3 mr-1" />
          {new Date(min).toLocaleDateString()} — {new Date(max).toLocaleDateString()}
        </Badge>
      </div>
    </div>
  );
};
