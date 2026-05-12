import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, X, Target, Users, Cpu, GitBranch, Zap, Network,
  LayoutDashboard, Calendar, AlertTriangle, ClipboardList,
  Mail, Settings, ArrowRight, FileText,
} from 'lucide-react';
import { AppState } from '../types';
import type { TabId } from './Sidebar';

interface Result {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  state: AppState;
  setActiveTab: (t: TabId) => void;
  onOpenProject?: (id: string) => void;
}

export const CommandPalette: React.FC<Props> = ({ open, onClose, state, setActiveTab, onOpenProject }) => {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQ(''); setSelected(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  const NAV_ACTIONS: Result[] = [
    { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, action: () => { setActiveTab('dashboard'); onClose(); }, category: 'Navigate' },
    { id: 'nav-projects', label: 'Projects', icon: <Target className="w-4 h-4" />, action: () => { setActiveTab('projects'); onClose(); }, category: 'Navigate' },
    { id: 'nav-timeline', label: 'Timeline', icon: <Calendar className="w-4 h-4" />, action: () => { setActiveTab('timeline'); onClose(); }, category: 'Navigate' },
    { id: 'nav-risk', label: 'Risk Heatmap', icon: <AlertTriangle className="w-4 h-4" />, action: () => { setActiveTab('risk'); onClose(); }, category: 'Navigate' },
    { id: 'nav-contributors', label: 'Contributors', icon: <Users className="w-4 h-4" />, action: () => { setActiveTab('contributors'); onClose(); }, category: 'Navigate' },
    { id: 'nav-checkin', label: 'Weekly Check-in', icon: <ClipboardList className="w-4 h-4" />, action: () => { setActiveTab('checkin'); onClose(); }, category: 'Navigate' },
    { id: 'nav-comms', label: 'Communications', icon: <Mail className="w-4 h-4" />, action: () => { setActiveTab('communications'); onClose(); }, category: 'Navigate' },
    { id: 'nav-tech', label: 'Technologies', icon: <Cpu className="w-4 h-4" />, action: () => { setActiveTab('tech'); onClose(); }, category: 'Navigate' },
    { id: 'nav-repos', label: 'Repositories', icon: <GitBranch className="w-4 h-4" />, action: () => { setActiveTab('repos'); onClose(); }, category: 'Navigate' },
    { id: 'nav-hackathons', label: 'Hackathons', icon: <Zap className="w-4 h-4" />, action: () => { setActiveTab('hackathons'); onClose(); }, category: 'Navigate' },
    { id: 'nav-wg', label: 'Working Groups', icon: <Network className="w-4 h-4" />, action: () => { setActiveTab('workinggroups'); onClose(); }, category: 'Navigate' },
    { id: 'nav-settings', label: 'Admin Settings', icon: <Settings className="w-4 h-4" />, action: () => { setActiveTab('settings'); onClose(); }, category: 'Navigate' },
  ];

  const results = useMemo<Result[]>(() => {
    const lq = q.toLowerCase().trim();

    const projectResults: Result[] = state.projects
      .filter((p) => !p.isArchived && (p.name.toLowerCase().includes(lq) || p.description.toLowerCase().includes(lq)))
      .slice(0, 6)
      .map((p) => ({
        id: `p-${p.id}`,
        label: p.name,
        sublabel: `${p.status} · ${p.tasks?.length ?? 0} tasks`,
        icon: <Target className="w-4 h-4 text-brand" />,
        action: () => { setActiveTab('projects'); onOpenProject?.(p.id); onClose(); },
        category: 'Projects',
      }));

    const userResults: Result[] = state.users
      .filter((u) => `${u.firstName} ${u.lastName} ${u.team} ${u.email}`.toLowerCase().includes(lq))
      .slice(0, 4)
      .map((u) => ({
        id: `u-${u.id}`,
        label: `${u.firstName} ${u.lastName}`,
        sublabel: `${u.functionTitle} · ${u.team}`,
        icon: <Users className="w-4 h-4 text-blue-500" />,
        action: () => { setActiveTab('contributors'); onClose(); },
        category: 'Contributors',
      }));

    const techResults: Result[] = state.technologies
      .filter((t) => t.name.toLowerCase().includes(lq) || t.description.toLowerCase().includes(lq))
      .slice(0, 3)
      .map((t) => ({
        id: `t-${t.id}`,
        label: t.name,
        sublabel: `${t.category}${t.layer ? ' · ' + t.layer : ''}`,
        icon: <Cpu className="w-4 h-4 text-emerald-500" />,
        action: () => { setActiveTab('tech'); onClose(); },
        category: 'Technologies',
      }));

    const wgResults: Result[] = state.workingGroups
      .filter((wg) => wg.name.toLowerCase().includes(lq) || wg.description.toLowerCase().includes(lq))
      .slice(0, 3)
      .map((wg) => ({
        id: `wg-${wg.id}`,
        label: wg.name,
        sublabel: `${wg.status} · ${wg.members.length} members`,
        icon: <Network className="w-4 h-4 text-purple-500" />,
        action: () => { setActiveTab('workinggroups'); onClose(); },
        category: 'Working Groups',
      }));

    const hackResults: Result[] = state.hackathons
      .filter((h) => h.title.toLowerCase().includes(lq))
      .slice(0, 3)
      .map((h) => ({
        id: `h-${h.id}`,
        label: h.title,
        sublabel: h.status,
        icon: <Zap className="w-4 h-4 text-amber-500" />,
        action: () => { setActiveTab('hackathons'); onClose(); },
        category: 'Hackathons',
      }));

    // Tasks search
    const taskResults: Result[] = [];
    if (lq.length >= 2) {
      state.projects.forEach((p) => {
        (p.tasks || [])
          .filter((t) => t.title.toLowerCase().includes(lq))
          .slice(0, 2)
          .forEach((t) => {
            taskResults.push({
              id: `task-${t.id}`,
              label: t.title,
              sublabel: `Task in ${p.name} · ${t.status}`,
              icon: <FileText className="w-4 h-4 text-neutral-400" />,
              action: () => { setActiveTab('projects'); onOpenProject?.(p.id); onClose(); },
              category: 'Tasks',
            });
          });
      });
    }

    if (!lq) return NAV_ACTIONS.slice(0, 8);

    const dataResults = [...projectResults, ...userResults, ...techResults, ...wgResults, ...hackResults, ...taskResults];
    const navFiltered = NAV_ACTIONS.filter((n) => n.label.toLowerCase().includes(lq));
    return [...dataResults, ...navFiltered].slice(0, 12);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, state]);

  useEffect(() => { setSelected(0); }, [q]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) results[selected].action();
  };

  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const grouped: Record<string, Result[]> = {};
  results.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-600 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-ink-700">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search projects, contributors, tasks, navigate…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-muted hover:text-neutral-900 dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[9px] text-muted font-mono border border-neutral-300 dark:border-ink-500 px-1.5 py-0.5 rounded">ESC</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {results.length === 0 && (
            <p className="text-center py-10 text-[11px] text-muted uppercase tracking-[0.14em]">No results</p>
          )}
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="px-4 py-1.5 bg-neutral-50 dark:bg-ink-800 border-b border-neutral-100 dark:border-ink-700">
                <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted">{cat}</span>
              </div>
              {items.map((r, i) => {
                const globalIdx = results.indexOf(r);
                const isSelected = globalIdx === selected;
                return (
                  <button
                    key={r.id}
                    onClick={r.action}
                    onMouseEnter={() => setSelected(globalIdx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${isSelected ? 'bg-brand/10 dark:bg-brand/20' : 'hover:bg-neutral-50 dark:hover:bg-ink-800'}`}
                  >
                    <span className={`shrink-0 ${isSelected ? 'text-brand' : 'text-muted'}`}>{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-bold truncate ${isSelected ? 'text-brand' : ''}`}>{r.label}</p>
                      {r.sublabel && <p className="text-[10px] text-muted truncate">{r.sublabel}</p>}
                    </div>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-brand shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-neutral-100 dark:border-ink-700 flex items-center gap-4">
          <span className="text-[9px] text-muted font-mono">↑↓ navigate</span>
          <span className="text-[9px] text-muted font-mono">↵ open</span>
          <span className="text-[9px] text-muted font-mono">ESC close</span>
          <span className="text-[9px] text-muted ml-auto">⌘K to reopen</span>
        </div>
      </div>
    </div>
  );
};
