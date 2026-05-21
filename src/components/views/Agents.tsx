/**
 * Agents view — tracks the lifecycle of internal AI agents (design → production).
 *
 * Mirrors the MCP Hub UI patterns (list/grid toggle, filters, preview modal)
 * but adds AI-specific signals: framework, LLM stack, version, evaluations
 * and operational metrics. Agents can declaratively depend on MCP servers
 * registered in the MCP Hub.
 */
import React, { useMemo, useState } from 'react';
import {
  Plus, Search, X, Bot, Edit2, Trash2, Layers, SlidersHorizontal,
  ArrowUpDown, ChevronDown, LayoutGrid, List, Activity, Sparkles,
  GitBranch, Database, Users, Wrench, Plug, BookOpen, Gauge,
} from 'lucide-react';
import {
  AppState, User, Agent, AgentFamily, AgentStatus, AgentFramework,
  AgentTool, AgentToolSource, McpServer,
} from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { canCreate, canEdit } from '../../services/permissions';

interface Props {
  state: AppState;
  currentUser: User;
  update: (mutator: (s: AppState) => AppState) => void;
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idea: 'IDEA',
  design: 'DESIGN',
  dev: 'DEV',
  testing: 'TESTING',
  production: 'PROD',
  deprecated: 'DEPRECATED',
};

const STATUS_STYLE: Record<AgentStatus, string> = {
  idea:        'bg-neutral-200 text-neutral-700 dark:bg-ink-700 dark:text-neutral-300',
  design:      'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  dev:         'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  testing:     'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  production:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  deprecated:  'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const FAMILY_COLORS = ['#FF3E00', '#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9'];

/* ─── Main view ──────────────────────────────────────────────────── */

export const Agents: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [frameworkFilter, setFrameworkFilter] = useState<AgentFramework | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created' | 'status'>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [preview, setPreview] = useState<Agent | null>(null);
  const [showFamilyMgr, setShowFamilyMgr] = useState(false);

  // Role-aware helpers — see src/services/permissions.ts.
  const canCreateAgent = canCreate('agent', currentUser);
  const canManageFamilies = currentUser.role === 'admin' || currentUser.role === 'manager';
  const canEditAgent = (a: Agent) => canEdit(a, 'agent', currentUser);

  const agents = state.agents || [];
  const families = state.agentFamilies || [];
  const mcpServers = state.mcpServers || [];

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (familyFilter !== null ? 1 : 0) +
    (frameworkFilter !== 'all' ? 1 : 0);

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    const list = agents.filter((a) => {
      const matchQ =
        a.name.toLowerCase().includes(lq) ||
        (a.description || '').toLowerCase().includes(lq) ||
        (a.category || '').toLowerCase().includes(lq) ||
        (a.llmModel || '').toLowerCase().includes(lq) ||
        a.tags.some((t) => t.toLowerCase().includes(lq)) ||
        a.tools.some((t) => t.name.toLowerCase().includes(lq));
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchFamily = familyFilter === null || a.familyId === familyFilter;
      const matchFw = frameworkFilter === 'all' || a.framework === frameworkFilter;
      return matchQ && matchStatus && matchFamily && matchFw;
    });
    const STATUS_ORDER: Record<AgentStatus, number> = { idea: 0, design: 1, dev: 2, testing: 3, production: 4, deprecated: 5 };
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'created') cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      else if (sortBy === 'updated') cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      else if (sortBy === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [agents, q, statusFilter, familyFilter, frameworkFilter, sortBy, sortDir]);

  const upsert = (a: Agent) => {
    // Stamp the current user as owner on first save so contributors/viewers
    // can later edit "their own" agents under the new role matrix.
    update((s) => {
      const exists = s.agents.some((x) => x.id === a.id);
      const stamped: Agent = exists
        ? a
        : { ...a, ownerUserId: a.ownerUserId ?? currentUser.id };
      return {
        ...s,
        agents: exists
          ? s.agents.map((x) => (x.id === a.id ? stamped : x))
          : [...s.agents, stamped],
      };
    });
  };
  const remove = (id: string) => update((s) => ({ ...s, agents: s.agents.filter((x) => x.id !== id) }));

  const resetFilters = () => {
    setStatusFilter('all');
    setFamilyFilter(null);
    setFrameworkFilter('all');
  };

  // Aggregate stats for the header
  const statsByStatus = useMemo(() => {
    const map: Partial<Record<AgentStatus, number>> = {};
    agents.forEach((a) => { map[a.status] = (map[a.status] || 0) + 1; });
    return map;
  }, [agents]);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">AI Operations</p>
          <h1 className="display-xl">AI Agents</h1>
          <p className="text-sm text-muted mt-2">
            Track the lifecycle of your internal AI agents — from idea to production.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageFamilies && (
            <Button variant="outline" size="md" onClick={() => setShowFamilyMgr(true)}>
              <Layers className="w-4 h-4 mr-2" /> Families
            </Button>
          )}
          <div className="flex border border-neutral-300 dark:border-ink-500">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'list' ? 'bg-brand text-white' : 'text-muted hover:text-brand'}`}
              title="List view"
            ><List className="w-4 h-4" /></button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'grid' ? 'bg-brand text-white' : 'text-muted hover:text-brand'}`}
              title="Grid view"
            ><LayoutGrid className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      {agents.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {(Object.keys(STATUS_LABEL) as AgentStatus[]).map((st) => {
            const n = statsByStatus[st] || 0;
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(isActive ? 'all' : st)}
                className={`border p-3 text-left transition-colors ${
                  isActive ? 'border-brand bg-brand/5' : 'border-neutral-200 dark:border-ink-600 hover:border-brand'
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">{STATUS_LABEL[st]}</p>
                <p className="text-2xl font-black mt-1 tabular-nums">{n}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border border-neutral-200 dark:border-ink-600 surface mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search agents (name, model, tool, tag…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-brand text-brand bg-brand/5'
              : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0 bg-brand text-white text-[9px] font-bold">{activeFilterCount}</span>
          )}
        </button>
        <div className="relative">
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [sb, sd] = e.target.value.split(':') as [typeof sortBy, typeof sortDir];
              setSortBy(sb); setSortDir(sd);
            }}
            className="appearance-none pl-8 pr-8 py-2 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-500 bg-transparent text-muted hover:text-brand cursor-pointer transition-colors"
          >
            <option value="updated:desc">Recently updated</option>
            <option value="created:desc">Newest first</option>
            <option value="name:asc">Name A→Z</option>
            <option value="status:asc">Status (idea → prod)</option>
            <option value="status:desc">Status (prod → idea)</option>
          </select>
          <ArrowUpDown className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
        {/* Family chips */}
        {families.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Family:</span>
            <button
              onClick={() => setFamilyFilter(null)}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                familyFilter === null ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
              }`}
            >All</button>
            {families.map((f) => (
              <button
                key={f.id}
                onClick={() => setFamilyFilter(familyFilter === f.id ? null : f.id)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                  familyFilter === f.id ? 'text-white border-transparent' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                }`}
                style={familyFilter === f.id ? { backgroundColor: f.color, borderColor: f.color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                {f.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
          {filtered.length} agent{filtered.length === 1 ? '' : 's'}
          {agents.length !== filtered.length && <span className="text-brand"> · filtered</span>}
        </p>
        {canCreateAgent && (
          <Button onClick={() => { setEditing(null); setShowEditor(true); }} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Agent
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="border border-neutral-200 dark:border-ink-600 surface p-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 animate-fade-in">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Framework</p>
            <div className="flex flex-wrap gap-1">
              {(['all', 'langchain', 'llamaindex', 'crewai', 'autogen', 'n8n', 'custom', 'other'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrameworkFilter(f)}
                  className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                    frameworkFilter === f ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                  }`}
                >{f === 'all' ? 'All' : f}</button>
              ))}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="md:col-span-2">
              <button onClick={resetFilters} className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand hover:underline">
                Clear all filters ({activeFilterCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state or grid/list */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-16 text-center text-muted">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm uppercase tracking-[0.16em]">
            {q || activeFilterCount > 0 ? 'No agents match the current filters' : 'No agents yet'}
          </p>
          {canCreateAgent && !q && activeFilterCount === 0 && (
            <button onClick={() => { setEditing(null); setShowEditor(true); }} className="text-[11px] text-brand font-bold mt-3 uppercase tracking-[0.14em]">
              + Add your first agent
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              family={a.familyId ? families.find((f) => f.id === a.familyId) || null : null}
              onClick={() => setPreview(a)}
            />
          ))}
        </div>
      ) : (
        <div className="border border-neutral-200 dark:border-ink-600 surface">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-neutral-200 dark:border-ink-600 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
            <div className="col-span-3">Agent</div>
            <div className="col-span-2">Family / Category</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Version</div>
            <div className="col-span-2">Stack</div>
            <div className="col-span-2">Owner</div>
            <div className="col-span-1 text-right">Tools</div>
          </div>
          {filtered.map((a) => {
            const fam = a.familyId ? families.find((f) => f.id === a.familyId) || null : null;
            const owner = a.ownerUserId ? state.users.find((u) => u.id === a.ownerUserId) : null;
            return (
              <button
                key={a.id}
                onClick={() => setPreview(a)}
                className="w-full grid grid-cols-12 gap-3 px-4 py-3 border-b border-neutral-100 dark:border-ink-700 last:border-0 hover:bg-neutral-50 dark:hover:bg-ink-800 text-left transition-colors"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className="w-2 h-8 shrink-0" style={{ backgroundColor: fam?.color || '#d4d4d4' }} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold truncate">{a.name}</p>
                    <p className="text-[10px] text-muted truncate">{a.description || '—'}</p>
                  </div>
                </div>
                <div className="col-span-2 text-[10px] min-w-0">
                  {fam && <p className="font-bold uppercase tracking-[0.1em] truncate" style={{ color: fam.color }}>{fam.name}</p>}
                  {a.category && <p className="text-muted truncate">{a.category}</p>}
                </div>
                <div className="col-span-1">
                  <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
                <div className="col-span-1 text-[10px] font-mono">{a.version || '—'}</div>
                <div className="col-span-2 text-[10px] min-w-0">
                  <p className="font-bold truncate">{a.llmProvider || '—'}</p>
                  <p className="text-muted truncate">{a.llmModel || ''} {a.framework && `· ${a.framework}`}</p>
                </div>
                <div className="col-span-2 text-[10px] text-muted truncate">
                  {owner ? `${owner.firstName} ${owner.lastName}` : a.teamIT || '—'}
                </div>
                <div className="col-span-1 text-right text-[10px] font-mono text-muted">{a.tools.length}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showEditor && (
        <AgentEditorModal
          agent={editing}
          families={families}
          mcpServers={mcpServers}
          users={state.users || []}
          onClose={() => { setShowEditor(false); setEditing(null); }}
          onSave={(a) => { upsert(a); setShowEditor(false); setEditing(null); setPreview(a); }}
        />
      )}

      {preview && (
        <AgentPreviewModal
          agent={preview}
          family={preview.familyId ? families.find((f) => f.id === preview.familyId) || null : null}
          owner={preview.ownerUserId ? state.users.find((u) => u.id === preview.ownerUserId) || null : null}
          mcpServers={mcpServers}
          canEdit={canEditAgent(preview)}
          onClose={() => setPreview(null)}
          onEdit={() => { setEditing(preview); setShowEditor(true); setPreview(null); }}
          onDelete={() => { if (window.confirm(`Delete "${preview.name}"?`)) { remove(preview.id); setPreview(null); } }}
        />
      )}

      {showFamilyMgr && (
        <AgentFamilyManagerModal
          families={families}
          onClose={() => setShowFamilyMgr(false)}
          onSave={(next) => update((s) => ({ ...s, agentFamilies: next }))}
        />
      )}
    </div>
  );
};

/* ─── Card (grid) ─────────────────────────────────────────────────── */

const AgentCard: React.FC<{ agent: Agent; family: AgentFamily | null; onClick: () => void }> = ({ agent, family, onClick }) => (
  <button
    onClick={onClick}
    className="group text-left border border-neutral-200 dark:border-ink-600 surface hover:border-brand hover:shadow-lg transition-all flex flex-col h-full"
  >
    <div className="h-1 w-full" style={{ backgroundColor: family?.color || '#d4d4d4' }} />
    <div className="p-4 flex-1 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Bot className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-tight truncate group-hover:text-brand transition-colors">{agent.name}</p>
            {agent.category && <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand mt-0.5">{agent.category}</p>}
          </div>
        </div>
        <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] shrink-0 ${STATUS_STYLE[agent.status]}`}>
          {STATUS_LABEL[agent.status]}
        </span>
      </div>
      <p className="text-xs text-muted line-clamp-3 flex-1">{agent.description || 'No description.'}</p>
      {family && (
        <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: family.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: family.color }} />
          {family.name}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1 mt-1 text-[9px] text-muted">
        {agent.llmModel && <div className="flex items-center gap-1 truncate"><Sparkles className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{agent.llmModel}</span></div>}
        {agent.framework && <div className="flex items-center gap-1 truncate"><GitBranch className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{agent.framework}</span></div>}
        {agent.version && <div className="flex items-center gap-1 truncate font-mono"><span>v{agent.version}</span></div>}
        <div className="flex items-center gap-1"><Wrench className="w-2.5 h-2.5" /><span>{agent.tools.length} tools</span></div>
      </div>
    </div>
  </button>
);

/* ─── Preview modal (read-only) ───────────────────────────────────── */

const AgentPreviewModal: React.FC<{
  agent: Agent;
  family: AgentFamily | null;
  owner: User | null;
  mcpServers: McpServer[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ agent, family, owner, mcpServers, canEdit, onClose, onEdit, onDelete }) => {
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const linkedMcps = mcpServers.filter((s) => agent.mcpServerIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {family && <div className="h-1 w-full shrink-0" style={{ backgroundColor: family.color }} />}
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-start justify-between gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Bot className="w-5 h-5 text-brand shrink-0" />
              <h2 className="text-xl font-black uppercase tracking-tight">{agent.name}</h2>
              <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${STATUS_STYLE[agent.status]}`}>
                {STATUS_LABEL[agent.status]}
              </span>
              {agent.version && <span className="text-[9px] font-mono text-muted">v{agent.version}</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[9px] font-bold uppercase tracking-[0.14em]">
              {agent.category && <span className="text-brand">{agent.category}</span>}
              {family && (
                <span className="flex items-center gap-1" style={{ color: family.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: family.color }} />
                  {family.name}
                </span>
              )}
              {agent.framework && <span className="text-muted">· {agent.framework}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{agent.description || 'No description.'}</p>
          {agent.enrichedDescription && (
            <div className="p-3 border-l-2 border-brand bg-brand/5">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand mb-1">AI Enriched</p>
              <p className="text-sm leading-relaxed">{agent.enrichedDescription}</p>
            </div>
          )}

          {/* Technical stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-neutral-200 dark:border-ink-600 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand mb-2">Stack</p>
              <table className="w-full text-[10px]">
                <tbody>
                  <Row label="LLM provider" value={agent.llmProvider} />
                  <Row label="LLM model" value={agent.llmModel} />
                  <Row label="Framework" value={agent.framework} />
                  <Row label="Context window" value={agent.contextWindow ? `${agent.contextWindow.toLocaleString()} tokens` : undefined} />
                  <Row label="Repo" value={agent.repoUrl} link />
                  <Row label="Docs" value={agent.docsUrl} link />
                </tbody>
              </table>
            </div>
            <div className="border border-neutral-200 dark:border-ink-600 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand mb-2">Ownership & Adoption</p>
              <table className="w-full text-[10px]">
                <tbody>
                  <Row label="Owner" value={owner ? `${owner.firstName} ${owner.lastName}` : undefined} />
                  <Row label="IT team" value={agent.teamIT} />
                  <Row label="User teams" value={agent.userTeams.length > 0 ? agent.userTeams.join(', ') : undefined} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrics */}
          {agent.metrics && (agent.metrics.monthlyInvocations || agent.metrics.costPerMonthEur || agent.metrics.successRatePct || agent.metrics.userSatisfaction) && (
            <div>
              <p className="label-xs mb-2 flex items-center gap-1"><Gauge className="w-3 h-3" /> Operations</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {agent.metrics.monthlyInvocations !== undefined && <Metric label="Invocations/mo" value={agent.metrics.monthlyInvocations.toLocaleString()} />}
                {agent.metrics.successRatePct !== undefined && <Metric label="Success rate" value={`${agent.metrics.successRatePct}%`} color="#22c55e" />}
                {agent.metrics.avgResponseTimeMs !== undefined && <Metric label="Avg latency" value={`${agent.metrics.avgResponseTimeMs}ms`} />}
                {agent.metrics.costPerMonthEur !== undefined && <Metric label="Cost/mo" value={`€${agent.metrics.costPerMonthEur.toLocaleString()}`} color="#f59e0b" />}
                {agent.metrics.userSatisfaction !== undefined && <Metric label="Satisfaction" value={`${agent.metrics.userSatisfaction}/5`} color="#6366f1" />}
              </div>
            </div>
          )}

          {/* Tools */}
          <div>
            <p className="label-xs mb-2 flex items-center gap-1"><Wrench className="w-3 h-3" /> Tools ({agent.tools.length})</p>
            {agent.tools.length === 0 ? (
              <p className="text-xs text-muted">No tools defined.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {agent.tools.map((t, i) => (
                  <div key={i} className="border border-neutral-200 dark:border-ink-600 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[11px] font-bold font-mono text-brand truncate">{t.name}</p>
                      {t.source && (
                        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted bg-neutral-100 dark:bg-ink-700 px-1.5 py-0.5">
                          {t.source}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{t.description || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MCP servers linked */}
          {linkedMcps.length > 0 && (
            <div>
              <p className="label-xs mb-2 flex items-center gap-1"><Plug className="w-3 h-3" /> Linked MCP servers ({linkedMcps.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedMcps.map((m) => (
                  <span key={m.id} className="px-2 py-1 text-[10px] font-bold bg-neutral-100 dark:bg-ink-700">{m.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge bases */}
          {agent.knowledgeBases.length > 0 && (
            <div>
              <p className="label-xs mb-2 flex items-center gap-1"><Database className="w-3 h-3" /> Knowledge bases</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.knowledgeBases.map((k, i) => (
                  <span key={i} className="px-2 py-1 text-[10px] bg-neutral-100 dark:bg-ink-700">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* System prompt */}
          {agent.systemPrompt && (
            <div>
              <p className="label-xs mb-2 flex items-center gap-1"><BookOpen className="w-3 h-3" /> System prompt</p>
              <pre className="border border-neutral-200 dark:border-ink-600 p-3 text-[10px] font-mono whitespace-pre-wrap bg-neutral-50 dark:bg-ink-800 max-h-48 overflow-y-auto">
                {agent.systemPrompt}
              </pre>
            </div>
          )}

          {/* Releases */}
          {agent.releases.length > 0 && (
            <div>
              <p className="label-xs mb-2 flex items-center gap-1"><Activity className="w-3 h-3" /> Release history</p>
              <div className="space-y-1.5">
                {agent.releases.slice().reverse().slice(0, 5).map((r, i) => (
                  <div key={i} className="border-l-2 border-brand pl-3 py-1">
                    <p className="text-[10px] font-bold font-mono">v{r.version} · {new Date(r.date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted">{r.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {agent.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2 shrink-0">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit}><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>
              <Button variant="danger" size="sm" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
            </>
          )}
          <Button size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value?: string; link?: boolean }> = ({ label, value, link }) =>
  value ? (
    <tr className="border-b border-neutral-100 dark:border-ink-700 last:border-0">
      <td className="py-1.5 text-muted w-2/5">{label}</td>
      <td className="py-1.5 font-bold">
        {link ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate block">{value}</a>
        ) : value}
      </td>
    </tr>
  ) : null;

const Metric: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#FF3E00' }) => (
  <div className="border border-neutral-200 dark:border-ink-600 p-3" style={{ borderTopColor: color, borderTopWidth: 3 }}>
    <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted truncate">{label}</p>
    <p className="text-xl font-black mt-1 tabular-nums" style={{ color }}>{value}</p>
  </div>
);

/* ─── Editor modal ───────────────────────────────────────────────── */

const AgentEditorModal: React.FC<{
  agent: Agent | null;
  families: AgentFamily[];
  mcpServers: McpServer[];
  users: User[];
  onClose: () => void;
  onSave: (a: Agent) => void;
}> = ({ agent, families, mcpServers, users, onClose, onSave }) => {
  const isNew = !agent;
  const now = new Date().toISOString();

  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [category, setCategory] = useState(agent?.category ?? '');
  const [familyId, setFamilyId] = useState(agent?.familyId ?? '');
  const [status, setStatus] = useState<AgentStatus>(agent?.status ?? 'idea');
  const [version, setVersion] = useState(agent?.version ?? '0.1.0');
  const [isActive, setIsActive] = useState(agent?.isActive ?? true);
  const [tagsStr, setTagsStr] = useState((agent?.tags || []).join(', '));

  const [llmProvider, setLlmProvider] = useState(agent?.llmProvider ?? '');
  const [llmModel, setLlmModel] = useState(agent?.llmModel ?? '');
  const [framework, setFramework] = useState<AgentFramework | ''>(agent?.framework ?? '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? '');
  const [contextWindow, setContextWindow] = useState<string>(agent?.contextWindow ? String(agent.contextWindow) : '');

  const [ownerUserId, setOwnerUserId] = useState(agent?.ownerUserId ?? '');
  const [teamIT, setTeamIT] = useState(agent?.teamIT ?? '');
  const [userTeamsStr, setUserTeamsStr] = useState((agent?.userTeams || []).join(', '));

  const [tools, setTools] = useState<AgentTool[]>(agent?.tools ?? []);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [newToolSource, setNewToolSource] = useState<AgentToolSource>('native');

  const [mcpIds, setMcpIds] = useState<string[]>(agent?.mcpServerIds ?? []);
  const [kbsStr, setKbsStr] = useState((agent?.knowledgeBases || []).join(', '));

  const [repoUrl, setRepoUrl] = useState(agent?.repoUrl ?? '');
  const [docsUrl, setDocsUrl] = useState(agent?.docsUrl ?? '');

  const [monthlyInvocations, setMonthlyInvocations] = useState<string>(agent?.metrics?.monthlyInvocations ? String(agent.metrics.monthlyInvocations) : '');
  const [successRatePct, setSuccessRatePct] = useState<string>(agent?.metrics?.successRatePct ? String(agent.metrics.successRatePct) : '');
  const [costPerMonth, setCostPerMonth] = useState<string>(agent?.metrics?.costPerMonthEur ? String(agent.metrics.costPerMonthEur) : '');
  const [avgResponseTime, setAvgResponseTime] = useState<string>(agent?.metrics?.avgResponseTimeMs ? String(agent.metrics.avgResponseTimeMs) : '');
  const [userSatisfaction, setUserSatisfaction] = useState<string>(agent?.metrics?.userSatisfaction ? String(agent.metrics.userSatisfaction) : '');

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const addTool = () => {
    if (!newToolName.trim()) return;
    setTools((t) => [...t, { name: newToolName.trim(), description: newToolDesc.trim(), source: newToolSource }]);
    setNewToolName(''); setNewToolDesc('');
  };
  const removeTool = (i: number) => setTools((t) => t.filter((_, idx) => idx !== i));
  const toggleMcp = (id: string) => setMcpIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const handleSave = () => {
    if (!name.trim()) return;
    const numOrUndef = (s: string) => s.trim() ? Number(s) : undefined;
    const built: Agent = {
      id: agent?.id ?? generateId(),
      name: name.trim(),
      description: description.trim(),
      enrichedDescription: agent?.enrichedDescription,
      category: category.trim() || undefined,
      familyId: familyId || undefined,
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
      status,
      isActive,
      version: version.trim() || '0.1.0',
      llmProvider: llmProvider.trim() || undefined,
      llmModel: llmModel.trim() || undefined,
      framework: framework || undefined,
      systemPrompt: systemPrompt.trim() || undefined,
      contextWindow: numOrUndef(contextWindow),
      tools,
      mcpServerIds: mcpIds,
      knowledgeBases: kbsStr.split(',').map((k) => k.trim()).filter(Boolean),
      ownerUserId: ownerUserId || undefined,
      teamIT: teamIT.trim() || undefined,
      userTeams: userTeamsStr.split(',').map((t) => t.trim()).filter(Boolean),
      metrics: {
        monthlyInvocations: numOrUndef(monthlyInvocations),
        successRatePct: numOrUndef(successRatePct),
        costPerMonthEur: numOrUndef(costPerMonth),
        avgResponseTimeMs: numOrUndef(avgResponseTime),
        userSatisfaction: numOrUndef(userSatisfaction),
      },
      releases: agent?.releases ?? [],
      evaluations: agent?.evaluations ?? [],
      repoUrl: repoUrl.trim() || undefined,
      docsUrl: docsUrl.trim() || undefined,
      createdAt: agent?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(built);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl max-h-[92vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-black uppercase tracking-tight">{isNew ? 'Add AI Agent' : `Edit — ${agent?.name}`}</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identity */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Identity</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support Triage Agent" /></Field>
              <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Customer Support, DevOps…" /></Field>
              <Field label="Family">
                <Select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
                  <option value="">— No family —</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </Field>
              <Field label="Version"><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" /></Field>
              <div className="md:col-span-2">
                <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this agent do?" /></Field>
              </div>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as AgentStatus)}>
                  <option value="idea">Idea</option><option value="design">Design</option><option value="dev">Dev</option>
                  <option value="testing">Testing</option><option value="production">Production</option><option value="deprecated">Deprecated</option>
                </Select>
              </Field>
              <Field label="Tags (comma-separated)"><Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="rag, classification, real-time" /></Field>
            </div>
          </div>

          {/* Technical stack */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Technical Stack</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="LLM provider"><Input value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)} placeholder="OpenAI, Anthropic, Ollama…" /></Field>
              <Field label="LLM model"><Input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} placeholder="gpt-4o, claude-haiku-4-5…" /></Field>
              <Field label="Framework">
                <Select value={framework} onChange={(e) => setFramework(e.target.value as AgentFramework | '')}>
                  <option value="">— None —</option>
                  <option value="langchain">LangChain</option><option value="llamaindex">LlamaIndex</option>
                  <option value="crewai">CrewAI</option><option value="autogen">AutoGen</option>
                  <option value="n8n">n8n</option><option value="custom">Custom</option><option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Context window (tokens)"><Input value={contextWindow} onChange={(e) => setContextWindow(e.target.value)} placeholder="128000" type="number" /></Field>
              <div className="md:col-span-2">
                <Field label="System prompt"><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} placeholder="You are an assistant that…" /></Field>
              </div>
              <Field label="Repo URL"><Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/…" /></Field>
              <Field label="Docs URL"><Input value={docsUrl} onChange={(e) => setDocsUrl(e.target.value)} placeholder="https://…" /></Field>
            </div>
          </div>

          {/* Ownership */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Ownership & Adoption</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Owner">
                <Select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </Select>
              </Field>
              <Field label="IT team"><Input value={teamIT} onChange={(e) => setTeamIT(e.target.value)} placeholder="Platform, Data Eng…" /></Field>
              <div className="md:col-span-2">
                <Field label="User teams (comma-separated)"><Input value={userTeamsStr} onChange={(e) => setUserTeamsStr(e.target.value)} placeholder="Support, Sales, Legal…" /></Field>
              </div>
            </div>
          </div>

          {/* Tools */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Tools ({tools.length})</p>
            <div className="space-y-2 mb-3">
              {tools.map((t, i) => (
                <div key={i} className="flex items-center gap-2 border border-neutral-200 dark:border-ink-600 px-3 py-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 px-1.5 py-0.5">{t.source || 'native'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold font-mono truncate">{t.name}</p>
                    {t.description && <p className="text-[10px] text-muted truncate">{t.description}</p>}
                  </div>
                  <button onClick={() => removeTool(i)} className="text-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <Input className="md:col-span-3" value={newToolName} onChange={(e) => setNewToolName(e.target.value)} placeholder="tool name" />
              <Input className="md:col-span-6" value={newToolDesc} onChange={(e) => setNewToolDesc(e.target.value)} placeholder="description" />
              <Select className="md:col-span-2" value={newToolSource} onChange={(e) => setNewToolSource(e.target.value as AgentToolSource)}>
                <option value="native">Native</option><option value="mcp">MCP</option><option value="custom">Custom</option>
              </Select>
              <Button onClick={addTool} size="sm" className="md:col-span-1"><Plus className="w-3.5 h-3.5" /></Button>
            </div>
          </div>

          {/* MCP servers */}
          {mcpServers.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Linked MCP servers ({mcpIds.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {mcpServers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMcp(m.id)}
                    className={`px-2 py-1 text-[10px] font-bold border transition-colors ${
                      mcpIds.includes(m.id) ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                    }`}
                  >{m.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge bases */}
          <div>
            <Field label="Knowledge bases (comma-separated)">
              <Input value={kbsStr} onChange={(e) => setKbsStr(e.target.value)} placeholder="confluence, github-wiki, product-docs…" />
            </Field>
          </div>

          {/* Metrics */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Operational Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Field label="Invocations/mo"><Input type="number" value={monthlyInvocations} onChange={(e) => setMonthlyInvocations(e.target.value)} placeholder="0" /></Field>
              <Field label="Success rate %"><Input type="number" value={successRatePct} onChange={(e) => setSuccessRatePct(e.target.value)} placeholder="0-100" /></Field>
              <Field label="Avg latency (ms)"><Input type="number" value={avgResponseTime} onChange={(e) => setAvgResponseTime(e.target.value)} placeholder="ms" /></Field>
              <Field label="Cost/mo (€)"><Input type="number" value={costPerMonth} onChange={(e) => setCostPerMonth(e.target.value)} placeholder="€" /></Field>
              <Field label="Satisfaction /5"><Input type="number" step="0.1" value={userSatisfaction} onChange={(e) => setUserSatisfaction(e.target.value)} placeholder="0-5" /></Field>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>{isNew ? 'Create' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">{label}</label>
    {children}
  </div>
);

/* ─── Family manager (auto-save pattern, same as MCP) ────────────── */

const AgentFamilyManagerModal: React.FC<{
  families: AgentFamily[];
  onClose: () => void;
  onSave: (families: AgentFamily[]) => void;
}> = ({ families, onClose, onSave }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(FAMILY_COLORS[0]);

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const openNew = () => {
    setEditingId('__new__'); setName(''); setDescription('');
    setColor(FAMILY_COLORS[families.length % FAMILY_COLORS.length]);
  };
  const openEdit = (f: AgentFamily) => {
    setEditingId(f.id); setName(f.name); setDescription(f.description || ''); setColor(f.color);
  };
  const saveEntry = () => {
    if (!name.trim()) return;
    const next = editingId === '__new__'
      ? [...families, { id: generateId(), name: name.trim(), description: description.trim() || undefined, color, createdAt: new Date().toISOString() }]
      : families.map((f) => f.id === editingId ? { ...f, name: name.trim(), description: description.trim() || undefined, color } : f);
    onSave(next);
    setEditingId(null);
  };
  const removeFamily = (id: string) => {
    if (!window.confirm('Delete this family? Agents linked to it will lose the reference.')) return;
    onSave(families.filter((f) => f.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><Layers className="w-5 h-5 text-brand" /> Agent Families</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-[10px] text-muted uppercase tracking-[0.16em] flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Changes are saved automatically
          </p>
          <div className="space-y-2">
            {families.length === 0 && <p className="text-sm text-muted text-center py-6">No families yet.</p>}
            {families.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border border-neutral-200 dark:border-ink-600 p-3">
                <span className="w-4 h-4 shrink-0" style={{ backgroundColor: f.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase tracking-tight truncate">{f.name}</p>
                  {f.description && <p className="text-[10px] text-muted truncate">{f.description}</p>}
                </div>
                <button onClick={() => openEdit(f)} className="text-muted hover:text-brand"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeFamily(f.id)} className="text-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          {editingId !== null ? (
            <div className="border border-brand/30 bg-brand/5 p-4 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand">{editingId === '__new__' ? 'New family' : 'Edit family'}</p>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Family name" />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
              <div className="flex gap-2 flex-wrap">
                {FAMILY_COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-7 h-7 transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-white' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 border-0 cursor-pointer" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" onClick={saveEntry} disabled={!name.trim()}>{editingId === '__new__' ? 'Create' : 'Save'}</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> New family</Button>
          )}
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end shrink-0">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};
