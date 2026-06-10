/**
 * KnowledgeGraph (#8) — relationship explorer across entities.
 *
 * Renders an SVG radial graph of every connection DOINg.AI already tracks,
 * reusing the links stored *inside* each object:
 *   project ─ family        (project.familyId)
 *   project ─ technology     (project.technologyIds)
 *   project ─ repository     (project.repoIds)
 *   project ─ mcp server     (project.mcpServerIds)
 *   project ─ agent          (project.agentIds)
 *   project ─ data feed      (project.dataFeedIds)
 *   project ─ project        (project.dependsOnProjectIds — dependency)
 *   agent   ─ mcp server     (agent.mcpServerIds)
 *   datafeed─ mcp server     (dataFeed.mcpServerIds)
 *
 * Click a node to focus it (neighbours highlighted + side panel). Pan by
 * dragging, zoom with the wheel or the +/−/fit controls, and export the whole
 * view to a print-ready PDF. Pure read view over the filtered state.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Share2, Target, Cpu, GitBranch, Bot, Plug, Folders, DatabaseZap, X, ZoomIn, ZoomOut, Maximize2, Printer } from 'lucide-react';
import { AppState, User } from '../../types';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type NodeType = 'project' | 'technology' | 'repository' | 'agent' | 'mcp' | 'datafeed' | 'family';
type EdgeKind = 'family' | 'technology' | 'repository' | 'mcp' | 'agent' | 'datafeed' | 'dependency';

interface GNode { id: string; type: NodeType; label: string; }
interface GEdge { a: string; b: string; kind: EdgeKind; }

const TYPE_META: Record<NodeType, { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string }> = {
  project:    { color: '#FF3E00', icon: Target,      label: 'Project' },
  technology: { color: '#3B82F6', icon: Cpu,         label: 'Technology' },
  repository: { color: '#10B981', icon: GitBranch,   label: 'Repository' },
  agent:      { color: '#D946EF', icon: Bot,         label: 'Agent' },
  mcp:        { color: '#06B6D4', icon: Plug,        label: 'MCP Server' },
  datafeed:   { color: '#14B8A6', icon: DatabaseZap, label: 'Data Feed' },
  family:     { color: '#F59E0B', icon: Folders,     label: 'Family' },
};

const EDGE_COLOR: Record<EdgeKind, string> = {
  family: '#F59E0B', technology: '#3B82F6', repository: '#10B981',
  mcp: '#06B6D4', agent: '#D946EF', datafeed: '#14B8A6', dependency: '#FF3E00',
};

export const KnowledgeGraph: React.FC<Props> = ({ state }) => {
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<NodeType>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);

  // ── viewport (zoom + pan) ──────────────────────────────────────────────
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];
    const seen = new Set<string>();
    const add = (id: string, type: NodeType, label: string) => {
      const key = `${type}:${id}`;
      if (!seen.has(key)) { seen.add(key); nodes.push({ id: key, type, label }); }
      return key;
    };
    const projById = new Map(state.projects.map((p) => [p.id, p] as const));

    state.projects.filter((p) => !p.isArchived).forEach((p) => {
      const pk = add(p.id, 'project', p.name);
      if (p.familyId) {
        const fam = state.projectFamilies?.find((f) => f.id === p.familyId);
        if (fam) edges.push({ a: pk, b: add(fam.id, 'family', fam.name), kind: 'family' });
      }
      (p.technologyIds || []).forEach((tid) => {
        const t = state.technologies.find((x) => x.id === tid);
        if (t) edges.push({ a: pk, b: add(t.id, 'technology', t.name), kind: 'technology' });
      });
      (p.repoIds || []).forEach((rid) => {
        const r = state.repositories.find((x) => x.id === rid);
        if (r) edges.push({ a: pk, b: add(r.id, 'repository', r.name), kind: 'repository' });
      });
      (p.mcpServerIds || []).forEach((mid) => {
        const m = state.mcpServers.find((x) => x.id === mid);
        if (m) edges.push({ a: pk, b: add(m.id, 'mcp', m.name), kind: 'mcp' });
      });
      (p.agentIds || []).forEach((aid) => {
        const ag = (state.agents || []).find((x) => x.id === aid);
        if (ag) edges.push({ a: pk, b: add(ag.id, 'agent', ag.name), kind: 'agent' });
      });
      (p.dataFeedIds || []).forEach((did) => {
        const d = (state.dataFeeds || []).find((x) => x.id === did);
        if (d) edges.push({ a: pk, b: add(d.id, 'datafeed', d.platformName), kind: 'datafeed' });
      });
      (p.dependsOnProjectIds || []).forEach((dep) => {
        const other = projById.get(dep);
        if (other && !other.isArchived) edges.push({ a: pk, b: add(other.id, 'project', other.name), kind: 'dependency' });
      });
    });

    (state.agents || []).forEach((a) => {
      const ak = add(a.id, 'agent', a.name);
      (a.mcpServerIds || []).forEach((mid) => {
        const m = state.mcpServers.find((x) => x.id === mid);
        if (m) edges.push({ a: ak, b: add(m.id, 'mcp', m.name), kind: 'mcp' });
      });
    });

    (state.dataFeeds || []).forEach((d) => {
      const dk = add(d.id, 'datafeed', d.platformName);
      (d.mcpServerIds || []).forEach((mid) => {
        const m = state.mcpServers.find((x) => x.id === mid);
        if (m) edges.push({ a: dk, b: add(m.id, 'mcp', m.name), kind: 'mcp' });
      });
    });

    return { nodes, edges };
  }, [state]);

  const visibleNodes = useMemo(
    () => nodes.filter((n) => !hidden.has(n.type))
      // cluster by type so same-coloured nodes sit together on the ring
      .slice().sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label)),
    [nodes, hidden]
  );
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleIds.has(e.a) && visibleIds.has(e.b));

  // Radial layout — deterministic ring placement.
  const W = 1000, H = 680, cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 70;
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    visibleNodes.forEach((n, i) => {
      const angle = (i / Math.max(visibleNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      m.set(n.id, { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
    });
    return m;
  }, [visibleNodes]);

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

  // ── zoom / pan handlers ────────────────────────────────────────────────
  const clampScale = (s: number) => Math.min(4, Math.max(0.4, s));
  const zoomBy = (factor: number) => setView((v) => ({ ...v, scale: clampScale(v.scale * factor) }));
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 });
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, tx: drag.current!.tx + (e.clientX - drag.current!.x), ty: drag.current!.ty + (e.clientY - drag.current!.y) }));
  };
  const onPointerUp = () => { drag.current = null; };

  // ── export to print-ready PDF ──────────────────────────────────────────
  const exportPdf = () => {
    const svg = svgRef.current;
    if (!svg) return;
    // Clone, strip the pan/zoom transform so the export is fully fit to page.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const g = clone.querySelector('#viewport') as SVGGElement | null;
    if (g) g.removeAttribute('transform');
    clone.removeAttribute('style');
    clone.setAttribute('width', '100%');
    const svgStr = new XMLSerializer().serializeToString(clone);
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const legend = (Object.keys(TYPE_META) as NodeType[])
      .map((t) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:9pt"><span style="width:10px;height:10px;border-radius:50%;background:${TYPE_META[t].color};display:inline-block"></span>${TYPE_META[t].label} (${counts[t]})</span>`)
      .join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>DOINg.AI — Knowledge Graph</title>
<style>@media print{@page{size:A4 landscape;margin:12mm}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#111;margin:0;padding:24px}
.cover{background:#050505;color:#fff;padding:20px 24px;margin:-24px -24px 16px}.brand{font-size:22pt;font-weight:900}.brand span{color:#FF3E00}
svg{width:100%;height:auto;max-height:165mm}</style></head><body>
<div class="cover"><div style="font-size:8pt;letter-spacing:.25em;text-transform:uppercase;color:#FF3E00;margin-bottom:8px">Knowledge Graph · ${today}</div><div class="brand">DOINg<span>.AI</span></div></div>
<div style="margin-bottom:12px">${legend}</div>
${svgStr}
<div style="margin-top:12px;font-size:7pt;color:#888;text-align:right">DOINg.AI · ${visibleNodes.length} entities · ${visibleEdges.length} links · Generated ${today}</div>
</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="label-xs">Relationships</p>
          <h1 className="display-xl flex items-center gap-3"><Share2 className="w-7 h-7 text-brand" /> Knowledge Graph</h1>
          <p className="text-sm text-muted mt-1">How projects, tech, repos, agents, MCP servers & data feeds connect. Drag to pan, scroll to zoom, click a node to focus.</p>
        </div>
        <button onClick={exportPdf} disabled={visibleNodes.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] border border-brand text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-40">
          <Printer className="w-4 h-4" /> Export PDF
        </button>
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
        <div className="flex-1 surface border overflow-hidden relative">
          {/* zoom controls */}
          {visibleNodes.length > 0 && (
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
              <button onClick={() => zoomBy(1.2)} title="Zoom in" className="w-8 h-8 flex items-center justify-center surface border hover:border-brand hover:text-brand"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out" className="w-8 h-8 flex items-center justify-center surface border hover:border-brand hover:text-brand"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={resetView} title="Reset view" className="w-8 h-8 flex items-center justify-center surface border hover:border-brand hover:text-brand"><Maximize2 className="w-4 h-4" /></button>
            </div>
          )}
          {visibleNodes.length === 0 ? (
            <div className="p-16 text-center">
              <Share2 className="w-10 h-10 mx-auto mb-4 opacity-20" />
              <p className="text-sm text-muted">No relationships to show yet. Link technologies, repos, MCP servers, agents or data feeds to your projects.</p>
            </div>
          ) : (
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none"
              style={{ maxHeight: '72vh', cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none' }}
              onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
              <g id="viewport" transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
                {visibleEdges.map((e, i) => {
                  const pa = pos.get(e.a)!, pb = pos.get(e.b)!;
                  const active = focus && (e.a === focus || e.b === focus);
                  return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                    stroke={active ? EDGE_COLOR[e.kind] : 'currentColor'}
                    strokeWidth={active ? 2 : 0.6}
                    strokeDasharray={e.kind === 'dependency' ? '4 3' : undefined}
                    className={active ? '' : 'text-neutral-300 dark:text-ink-600'}
                    opacity={focus && !active ? 0.12 : 0.55} />;
                })}
                {visibleNodes.map((n) => {
                  const p = pos.get(n.id)!;
                  const meta = TYPE_META[n.type];
                  const dim = focus && n.id !== focus && !neighbours.has(n.id);
                  const isFocus = n.id === focus;
                  const label = n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label;
                  return (
                    <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer"
                      opacity={dim ? 0.2 : 1} onClick={(ev) => { ev.stopPropagation(); setFocus(isFocus ? null : n.id); }}>
                      <circle r={isFocus ? 10 : 6.5} fill={meta.color} stroke="#fff" strokeWidth={isFocus ? 2.5 : 1.2} />
                      <text x={p.x > cx ? 13 : -13} y={4} fontSize="10"
                        textAnchor={p.x > cx ? 'start' : 'end'} className="fill-neutral-700 dark:fill-neutral-300"
                        style={{ fontWeight: isFocus ? 800 : 400, paintOrder: 'stroke', stroke: 'var(--kg-halo, transparent)' }}>
                        {label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {focusNode && (
          <div className="w-72 surface border p-4 shrink-0 self-start">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: TYPE_META[focusNode.type].color }}>{TYPE_META[focusNode.type].label}</span>
              <button onClick={() => setFocus(null)} className="w-6 h-6 flex items-center justify-center text-muted hover:text-brand"><X className="w-3.5 h-3.5" /></button>
            </div>
            <h3 className="text-sm font-bold mb-3">{focusNode.label}</h3>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-2">{neighbours.size} connection{neighbours.size !== 1 ? 's' : ''}</p>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
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
