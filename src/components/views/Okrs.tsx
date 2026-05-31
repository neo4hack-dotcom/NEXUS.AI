/**
 * OKRs (#4) — objectives & key results.
 *
 * Each Objective groups Key Results. A KR is one of:
 *  - percent / number: manual current vs target → progress = current/target
 *  - linked_projects: progress = % of linked projects marked Done (auto)
 *
 * Objective progress = average of its KR progresses. A manual status override
 * is shown alongside the computed progress. Create / edit / delete inline.
 */

import React, { useMemo, useState } from 'react';
import {
  Goal, Plus, Pencil, Trash2, X, Save, Target as TargetIcon, Link2, Hash, Percent,
} from 'lucide-react';
import {
  AppState, User, Objective, KeyResult, KeyResultKind, OkrStatus, ProjectStatus,
} from '../../types';
import { generateId } from '../../services/storage';
import { useEditingLock } from '../../hooks/useEditingLock';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const STATUS_META: Record<OkrStatus, { label: string; style: string }> = {
  on_track:  { label: 'On Track',  style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  at_risk:   { label: 'At Risk',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  off_track: { label: 'Off Track', style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  done:      { label: 'Done',      style: 'bg-brand/15 text-brand' },
};

const krProgress = (kr: KeyResult, state: AppState): number => {
  if (kr.kind === 'linked_projects') {
    const ids = kr.linkedProjectIds || [];
    if (ids.length === 0) return 0;
    const done = state.projects.filter((p) => ids.includes(p.id) && p.status === ProjectStatus.DONE).length;
    return Math.round((done / ids.length) * 100);
  }
  const t = kr.target ?? 0;
  if (!t) return 0;
  return Math.min(100, Math.round(((kr.current ?? 0) / t) * 100));
};

const objProgress = (o: Objective, state: AppState): number => {
  if (o.keyResults.length === 0) return 0;
  return Math.round(o.keyResults.reduce((s, kr) => s + krProgress(kr, state), 0) / o.keyResults.length);
};

const blankObjective = (): Objective => ({
  id: generateId(), title: '', description: '', period: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
  status: 'on_track', keyResults: [], tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

export const Okrs: React.FC<Props> = ({ state, currentUser, update }) => {
  const okrs = state.okrs ?? [];
  const [editing, setEditing] = useState<Objective | null>(null);
  const [isNew, setIsNew] = useState(false);
  useEditingLock(editing !== null);

  const periods = useMemo(() => {
    const set = new Set(okrs.map((o) => o.period));
    return ['all', ...Array.from(set).sort().reverse()];
  }, [okrs]);
  const [period, setPeriod] = useState('all');

  const visible = period === 'all' ? okrs : okrs.filter((o) => o.period === period);

  const save = (o: Objective) => {
    const saved = { ...o, updatedAt: new Date().toISOString() };
    update((s) => ({
      ...s,
      okrs: isNew ? [...(s.okrs ?? []), saved] : (s.okrs ?? []).map((x) => (x.id === saved.id ? saved : x)),
    }));
    setEditing(null);
  };
  const remove = (id: string) => {
    if (!window.confirm('Delete this objective?')) return;
    update((s) => ({ ...s, okrs: (s.okrs ?? []).filter((o) => o.id !== id) }));
  };

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">Objectives & Key Results</p>
          <h1 className="display-xl flex items-center gap-3"><Goal className="w-7 h-7 text-brand" /> OKRs</h1>
          <p className="text-sm text-muted mt-1">Set quarterly objectives; track progress automatically from linked projects.</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(blankObjective()); setIsNew(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-[11px] font-bold uppercase tracking-[0.16em] hover:bg-brand/90">
            <Plus className="w-4 h-4" /> New objective
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {periods.map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
              period === p ? 'bg-brand text-white border-brand'
              : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'}`}>
            {p === 'all' ? 'All periods' : p}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="surface border border-dashed p-16 text-center">
          <Goal className="w-10 h-10 mx-auto mb-4 opacity-20" />
          <p className="text-sm text-muted">No objectives yet. {canEdit ? 'Create one to start tracking outcomes.' : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((o) => {
            const prog = objProgress(o, state);
            const owner = state.users.find((u) => u.id === o.ownerUserId);
            return (
              <div key={o.id} className="surface border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted">{o.period}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${STATUS_META[o.status].style}`}>{STATUS_META[o.status].label}</span>
                    </div>
                    <h2 className="text-lg font-black tracking-tight">{o.title || 'Untitled objective'}</h2>
                    {o.description && <p className="text-[11px] text-muted mt-1">{o.description}</p>}
                    {owner && <p className="text-[10px] text-muted mt-1">Owner: {owner.firstName} {owner.lastName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-black text-brand">{prog}%</p>
                    {canEdit && (
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <button onClick={() => { setEditing({ ...o }); setIsNew(false); }} className="w-7 h-7 flex items-center justify-center text-muted hover:text-brand"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(o.id)} className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-neutral-200 dark:bg-ink-700 overflow-hidden mt-3 mb-4">
                  <div className="h-full bg-brand transition-all" style={{ width: `${prog}%` }} />
                </div>
                <div className="space-y-2">
                  {o.keyResults.map((kr) => {
                    const kp = krProgress(kr, state);
                    const Icon = kr.kind === 'linked_projects' ? Link2 : kr.kind === 'percent' ? Percent : Hash;
                    return (
                      <div key={kr.id} className="flex items-center gap-3">
                        <Icon className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span className="text-[11px] flex-1 min-w-0 truncate">{kr.title}</span>
                        {kr.kind !== 'linked_projects' && (
                          <span className="text-[10px] font-mono text-muted">{kr.current ?? 0}/{kr.target ?? 0}{kr.unit || ''}</span>
                        )}
                        <div className="w-28 h-2 bg-neutral-100 dark:bg-ink-700 overflow-hidden shrink-0">
                          <div className="h-full bg-emerald-500" style={{ width: `${kp}%` }} />
                        </div>
                        <span className="text-[10px] font-bold w-9 text-right">{kp}%</span>
                      </div>
                    );
                  })}
                  {o.keyResults.length === 0 && <p className="text-[10px] text-muted italic">No key results.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <OkrEditor objective={editing} isNew={isNew} state={state}
          onSave={save} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

const OkrEditor: React.FC<{
  objective: Objective; isNew: boolean; state: AppState;
  onSave: (o: Objective) => void; onClose: () => void;
}> = ({ objective, isNew, state, onSave, onClose }) => {
  const [form, setForm] = useState<Objective>(objective);
  const set = <K extends keyof Objective>(k: K, v: Objective[K]) => setForm((p) => ({ ...p, [k]: v }));

  const input = 'w-full h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand';

  const addKr = () => set('keyResults', [...form.keyResults, {
    id: generateId(), title: '', kind: 'percent' as KeyResultKind, current: 0, target: 100, unit: '%', linkedProjectIds: [],
  }]);
  const updKr = (id: string, patch: Partial<KeyResult>) =>
    set('keyResults', form.keyResults.map((kr) => (kr.id === id ? { ...kr, ...patch } : kr)));
  const delKr = (id: string) => set('keyResults', form.keyResults.filter((kr) => kr.id !== id));

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 sticky top-0 z-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-2"><Goal className="w-4 h-4 text-brand" />{isNew ? 'New objective' : 'Edit objective'}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Title *</label>
            <input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus placeholder="e.g. Become the reference AI platform internally" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Description</label>
            <textarea rows={2} className="w-full px-3 py-2 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand resize-none" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Period</label>
              <input className={input} value={form.period} onChange={(e) => set('period', e.target.value)} placeholder="Q1 2026" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Status</label>
              <select className={input} value={form.status} onChange={(e) => set('status', e.target.value as OkrStatus)}>
                {(Object.entries(STATUS_META) as [OkrStatus, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Owner</label>
              <select className={input} value={form.ownerUserId ?? ''} onChange={(e) => set('ownerUserId', e.target.value || undefined)}>
                <option value="">—</option>
                {state.users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-ink-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Key Results</span>
              <button onClick={addKr} className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add KR</button>
            </div>
            <div className="space-y-3">
              {form.keyResults.map((kr) => (
                <div key={kr.id} className="border border-neutral-200 dark:border-ink-700 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className={input} value={kr.title} onChange={(e) => updKr(kr.id, { title: e.target.value })} placeholder="Key result title" />
                    <button onClick={() => delKr(kr.id)} className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className={input + ' max-w-[150px]'} value={kr.kind} onChange={(e) => updKr(kr.id, { kind: e.target.value as KeyResultKind })}>
                      <option value="percent">Percent</option>
                      <option value="number">Number</option>
                      <option value="linked_projects">Linked projects</option>
                    </select>
                    {kr.kind !== 'linked_projects' ? (
                      <>
                        <input type="number" className={input + ' max-w-[90px]'} value={kr.current ?? 0} onChange={(e) => updKr(kr.id, { current: Number(e.target.value) })} placeholder="current" />
                        <span className="text-[10px] text-muted">/</span>
                        <input type="number" className={input + ' max-w-[90px]'} value={kr.target ?? 0} onChange={(e) => updKr(kr.id, { target: Number(e.target.value) })} placeholder="target" />
                        <input className={input + ' max-w-[70px]'} value={kr.unit ?? ''} onChange={(e) => updKr(kr.id, { unit: e.target.value })} placeholder="unit" />
                      </>
                    ) : (
                      <select multiple className="flex-1 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand min-h-[60px]"
                        value={kr.linkedProjectIds ?? []}
                        onChange={(e) => updKr(kr.id, { linkedProjectIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                        {state.projects.filter((p) => !p.isArchived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
              {form.keyResults.length === 0 && <p className="text-[10px] text-muted italic">No key results yet.</p>}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
          <button onClick={onClose} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-neutral-400">Cancel</button>
          <button onClick={() => form.title.trim() && onSave(form)} disabled={!form.title.trim()}
            className="flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 disabled:opacity-40">
            <Save className="w-3.5 h-3.5" />{isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
