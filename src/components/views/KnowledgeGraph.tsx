/**
 * KnowledgeGraph (#8) — relationship explorer across entities.
 *
 * Renders an SVG force-free radial graph of the connections DOINg.AI already
 * tracks:
 *   project ─ technology   (project.technologyIds)
 *   project ─ repository   (project.repoIds)
 *   agent   ─ mcp server   (agent.mcpServerIds)
 *   project ─ family       (project.familyId)
 *
 * Click a node to focus it: its neighbours are highlighted and a side panel
 * lists the direct relations. Pure read view over the filtered state — no
 * external graph library, just deterministic layout maths.
 */

import React, { useMemo, useState } from 'react';
import { Share2, Target, Cpu, GitBranch, Bot, Plug, Folders, X } from 'lucide-react';
import { AppState, User } from '../../types';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type NodeType = 'project' | 'technology' | 'repository' | 'agent' | 'mcp' | 'family';

interface GNode { id: string; type: NodeType; label: string; }
interface GEdge { a: string; b: string; }

const TYPE_META: Record<NodeType, { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string }> = {
  project:    { color: '#FF3E00', icon: Target,    label: 'Project' },
  technology: { color: '#3B82F6', icon: Cpu,       label: 'Technology' },
  repository: { color: '#10B981', icon: GitBranch, label: 'Repository' },
  agent:      { color: '#D946EF', icon: Bot,       label: 'Agent' },
  mcp:        { color: '#06B6D4', icon: Plug,      label: 'MCP Server' },
  family:     { color: '#F59E0B', icon: Folders,   label: 'Family' },
};

export const KnowledgeGraph: React.FC<Props> = ({ state }) => {
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<NodeType>>(new Set());

  const { nodes, edges } = useMemo(() => {
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];
    const seen = new Set<string>();
    const add = (id: string, type: NodeType, label: string) => {
      const key = `${type}:${id}`;
      if (!seen.has(key)) { seen.add(key); nodes.push({ id: key, type, label }); }
      return key;
    };

    state.projects.filter((p) => !p.isArchived).forEach((p) => {
      const pk = add(p.id, 'project', p.name);
      if (p.familyId) {
        const fam = state.projectFamilies?.find((f) => f.id === p.familyId);
        if (fam) edges.push({ a: pk, b: add(fam.id, 'family', fam.name) });
      }
      (p.technologyIds || []).forEach((tid) => {
        const t = state.technologies.find((x) => x.id === tid);
        if (t) edges.push({ a: pk, b: add(t.id, 'technology', t.name) });
      });
      (p.repoIds || []).forEach((rid) => {
        const r = state.repositories.find((x) => x.id === rid);
        if (r) edges.push({ a: pk, b: add(r.id, 'repository', r.name) });
      });
    });

    (state.agents || []).forEach((a) => {
      const ak = add(a.id, 'agent', a.name);
      (a.mcpServerIds || []).forEach((mid) => {
        const m = state.mcpServers.find((x) => x.id === mid);
        if (m) edges.push({ a: ak, b: add(m.id, 'mcp', m.name) });
      });
    });

    return { nodes, edges };
  }, [state]);

  const visibleNodes = nodes.filter((n) => !hidden.has(n.type));
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleIds.has(e.a) && visibleIds.has(e.b));

  // Radial layout — deterministic ring placement.
  const W = 900, H = 620, cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 60;
  const pos = new Map<string, { x: number; y: number }>();
  visibleNodes.forEach((n, i) => {
    const angle = (i / Math.max(visibleNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
  });

  const neighbours = useMemo(() => {
    if (!focus) return new Set<string>();
    const s = new Set<string>();
    visibleEdges.forEach((e) => {
      if (e.a === focus) s.add(e.b);
      if (e.b === focus) s.add(e.a);
    });
    return s;
  }, [focus, visibleEdges]);

  const focusNode = focus ? nodes.find((n) => n.id === focus) : null;
  const toggleType = (t: NodeType) => setHidden((h) => { const n = new Set(h); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const counts = useMemo(() => {
    const c = {} as Record<NodeType, number>;
    (Object.keys(TYPE_META) as NodeType[]).forEach((t) => { c[t] = nodes.filter((n) => n.type === t).length; });
    return c;
  }, [nodes]);

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div>
        <p className="label-xs">Relationships</p>
        <h1 className="display-xl flex items-center gap-3"><Share2 className="w-7 h-7 text-brand" /> Knowledge Graph</h1>
        <p className="text-sm text-muted mt-1">How your projects, tech, repos, agents and MCP servers connect. Click a node to focus.</p>
      </div>

      {/* legend / type toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(TYPE_META) as NodeType[]).map((t) => {
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          const off = hidden.has(t);
          return (
            <button key={t} onClick={() => toggleType(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                off ? 'opacity-40 border-neutral-300 dark:border-ink-600' : 'border-neutral-300 dark:border-ink-600'}`}
              style={off ? {} : { borderColor: meta.color, color: meta.color }}>
              <Icon className="w-3 h-3" /> {meta.label} <span className="opacity-60">{counts[t]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 surface border overflow-hidden">
          {visibleNodes.length === 0 ? (
            <div className="p-16 text-center">
              <Share2 className="w-10 h-10 mx-auto mb-4 opacity-20" />
              <p className="text-sm text-muted">No relationships to show yet. Link technologies/repos to projects, or MCP servers to agents.</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '70vh' }}>
              {visibleEdges.map((e, i) => {
                const pa = pos.get(e.a)!, pb = pos.get(e.b)!;
                const active = focus && (e.a === focus || e.b === focus);
                return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={active ? '#FF3E00' : 'currentColor'}
                  strokeWidth={active ? 1.5 : 0.5}
                  className={active ? '' : 'text-neutral-300 dark:text-ink-600'}
                  opacity={focus && !active ? 0.15 : 0.6} />;
              })}
              {visibleNodes.map((n) => {
                const p = pos.get(n.id)!;
                const meta = TYPE_META[n.type];
                const dim = focus && n.id !== focus && !neighbours.has(n.id);
                const isFocus = n.id === focus;
                return (
                  <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer"
                    opacity={dim ? 0.25 : 1} onClick={() => setFocus(isFocus ? null : n.id)}>
                    <circle r={isFocus ? 9 : 6} fill={meta.color} stroke="#fff" strokeWidth={isFocus ? 2 : 1} />
                    <text x={p.x > cx ? 12 : -12} y={4} fontSize="9"
                      textAnchor={p.x > cx ? 'start' : 'end'} className="fill-neutral-700 dark:fill-neutral-300"
                      style={{ fontWeight: isFocus ? 700 : 400 }}>
                      {n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {focusNode && (
          <div className="w-72 surface border p-4 shrink-0 self-start">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">{TYPE_META[focusNode.type].label}</span>
              <button onClick={() => setFocus(null)} className="w-6 h-6 flex items-center justify-center text-muted hover:text-brand"><X className="w-3.5 h-3.5" /></button>
            </div>
            <h3 className="text-sm font-bold mb-3">{focusNode.label}</h3>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-2">{neighbours.size} connection{neighbours.size !== 1 ? 's' : ''}</p>
            <div className="space-y-1.5">
              {Array.from(neighbours).map((nid) => {
                const nn = nodes.find((x) => x.id === nid);
                if (!nn) return null;
                const meta = TYPE_META[nn.type];
                const Icon = meta.icon;
                return (
                  <button key={nid} onClick={() => setFocus(nid)} className="w-full flex items-center gap-2 text-left p-1.5 hover:bg-neutral-100 dark:hover:bg-ink-700 transition-colors">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                    <span className="text-[11px] truncate">{nn.label}</span>
                  </button>
                );
              })}
              {neighbours.size === 0 && <p className="text-[10px] text-muted italic">No direct connections.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
