import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  X,
  Plug,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Trash2,
  Edit2,
  Link,
  Shield,
  Palette,
  Users,
  Database,
  Layers,
  Settings2,
  FileDown,
  Printer,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  ScanLine,
  CheckSquare,
  Square,
  BookOpen,
  Wand2,
  AlertTriangle,
  ListChecks,
  Pin,
  PinOff,
  Upload,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  List,
  IdCard,
} from 'lucide-react';
import {
  AppState,
  McpServer,
  McpTool,
  McpFamily,
  McpDeployStatus,
  McpCodeAnalysis,
  McpCodeRecommendation,
  McpRecommendationSeverity,
  McpBestPractice,
  McpBestPracticeSource,
  User,
  LlmConfig,
} from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { runPrompt } from '../../services/llmService';
import { buildMcpReportHTML, exportMcpXlsx, exportMcpIdCard } from '../../services/exports';

interface Props {
  state: AppState;
  currentUser: User;
  update: (mutator: (s: AppState) => AppState) => void;
}

const CATEGORIES = ['Productivity', 'Data', 'Dev Tools', 'AI / ML', 'Communication', 'Utilities', 'Other'];

const DEPLOY_STATUS_STYLE: Record<McpDeployStatus, string> = {
  dev:        'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  uat:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  production: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const DEPLOY_STATUS_LABEL: Record<McpDeployStatus, string> = {
  dev: 'Dev',
  uat: 'UAT',
  production: 'Production',
};

const FAMILY_COLORS = [
  '#FF3E00', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
];

const SEVERITY_STYLE: Record<McpRecommendationSeverity, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-400',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-400',
  low:      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-400',
};

const SEVERITY_RANK: Record<McpRecommendationSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

/* ── AI Code Analysis prompt ── */
const buildCodeAnalysisPrompt = (mcpName: string, code: string): string => `You are a senior software engineer reviewing the source code of an MCP (Model Context Protocol) server.

MCP NAME: ${mcpName}

SOURCE CODE (English review required):
\`\`\`
${code}
\`\`\`

Produce a thorough technical code review covering:
- Code quality, structure, readability
- Security concerns (input validation, secrets handling, authentication)
- Performance / scalability hot spots
- Error handling and reliability
- Test coverage hints (if visible)
- MCP protocol compliance / tool registration patterns
- Maintainability

Respond with ONLY a valid JSON object (no markdown fences) in this schema:
{
  "language": "detected programming language (string)",
  "summary": "Multi-paragraph Markdown analysis in English. Use ## headings for sections (e.g., ## Overview, ## Security, ## Performance, ## Reliability, ## Maintainability).",
  "recommendations": [
    {
      "text": "Concise actionable recommendation in English (one line, imperative voice).",
      "category": "Security|Performance|Reliability|Maintainability|Compliance|Testing|DevX",
      "severity": "critical|high|medium|low"
    }
  ]
}

Rules:
- Be specific and reference the code where relevant.
- The recommendations array MUST be a flat checklist of 5-15 distinct items.
- Sort recommendations by severity (critical first).
- Output ONLY the JSON object.`;

const stripJsonFences = (s: string) =>
  s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();

const analyzeMcpCode = async (
  mcpName: string,
  code: string,
  llmConfig: LlmConfig
): Promise<McpCodeAnalysis> => {
  const prompt = buildCodeAnalysisPrompt(mcpName, code);
  const raw = await runPrompt(prompt, llmConfig);
  const cleaned = stripJsonFences(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('The AI did not return valid JSON. Try again.');
    parsed = JSON.parse(match[0]);
  }
  const recs: McpCodeRecommendation[] = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
    .map((r: any) => ({
      id: generateId(),
      text: String(r.text || '').trim(),
      category: r.category ? String(r.category) : undefined,
      severity: ['critical', 'high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium',
      done: false,
    } as McpCodeRecommendation))
    .filter((r: McpCodeRecommendation) => r.text)
    .sort((a: McpCodeRecommendation, b: McpCodeRecommendation) =>
      SEVERITY_RANK[a.severity!] - SEVERITY_RANK[b.severity!]
    );
  return {
    summary: String(parsed.summary || '').trim(),
    language: parsed.language ? String(parsed.language) : undefined,
    recommendations: recs,
    analyzedAt: new Date().toISOString(),
    inputSize: code.length,
  };
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={`space-y-1.5 ${className || ''}`}>
    <label className="label-xs">{label}</label>
    {children}
  </div>
);

const MetaRow: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 dark:border-ink-700 last:border-0">
      <span className="text-muted mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-0.5">{label}</p>
        <p className="text-xs text-neutral-800 dark:text-neutral-200">{value}</p>
      </div>
    </div>
  );
};

export const McpHubView: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [showFamilyManager, setShowFamilyManager] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deployFilter, setDeployFilter] = useState<McpDeployStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'declarative' | 'url'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created' | 'tools'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [previewServer, setPreviewServer] = useState<McpServer | null>(null);
  const isAdmin = currentUser.role === 'admin';

  const mcpFamilies: McpFamily[] = state.mcpFamilies || [];

  // Extract unique categories from existing servers, sorted alphabetically.
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    (state.mcpServers || []).forEach((s) => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state.mcpServers]);

  // Count active filters (excluding search query) for the badge display.
  const activeFilterCount =
    (familyFilter !== null ? 1 : 0) +
    (categoryFilter !== null ? 1 : 0) +
    (deployFilter !== 'all' ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0) +
    (activeFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setFamilyFilter(null);
    setCategoryFilter(null);
    setDeployFilter('all');
    setSourceFilter('all');
    setActiveFilter('all');
  };

  const servers = useMemo(() => {
    const lq = q.toLowerCase();
    const filtered = (state.mcpServers || []).filter((s) => {
      const matchesQ =
        s.name.toLowerCase().includes(lq) ||
        (s.category || '').toLowerCase().includes(lq) ||
        s.description.toLowerCase().includes(lq) ||
        (s.useCase || '').toLowerCase().includes(lq) ||
        (s.teamIT || '').toLowerCase().includes(lq) ||
        (s.userTeams || []).some((t) => t.toLowerCase().includes(lq)) ||
        s.tags.some((t) => t.toLowerCase().includes(lq));
      const matchesFamily = familyFilter === null || s.familyId === familyFilter;
      const matchesCategory = categoryFilter === null || s.category === categoryFilter;
      const matchesDeploy = deployFilter === 'all' || s.deployStatus === deployFilter;
      const matchesSource = sourceFilter === 'all' || s.source === sourceFilter;
      const matchesActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && s.isActive) ||
        (activeFilter === 'inactive' && !s.isActive);
      return matchesQ && matchesFamily && matchesCategory && matchesDeploy && matchesSource && matchesActive;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'created':
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'updated':
          cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
          break;
        case 'tools':
          cmp = a.tools.length - b.tools.length;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [state.mcpServers, q, familyFilter, categoryFilter, deployFilter, sourceFilter, activeFilter, sortBy, sortDir]);

  const selected = (state.mcpServers || []).find((s) => s.id === selectedId) ?? null;
  const selectedFamily = selected?.familyId ? mcpFamilies.find((f) => f.id === selected.familyId) : null;

  const upsertServer = (srv: McpServer) => {
    update((s) => ({
      ...s,
      mcpServers: s.mcpServers.some((x) => x.id === srv.id)
        ? s.mcpServers.map((x) => (x.id === srv.id ? srv : x))
        : [...s.mcpServers, srv],
    }));
  };

  const deleteServer = (id: string) => {
    update((s) => ({ ...s, mcpServers: s.mcpServers.filter((x) => x.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const handleEnrich = async () => {
    if (!selected || !state.llmConfig?.provider) return;
    setEnriching(true);
    try {
      const prompt = `You are enriching documentation for an MCP (Model Context Protocol) server.
Server name: ${selected.name}
Description: ${selected.description}
Tools: ${JSON.stringify(selected.tools.map((t) => ({ name: t.name, description: t.description })))}

Generate:
1. An enriched server description (2-3 sentences, professional, explains the use case and value)
2. For each tool, an enriched description (1 sentence, explains what it does in plain language)

Respond as JSON: { "serverDescription": "...", "tools": [{ "name": "...", "enrichedDescription": "..." }] }`;
      const raw = await runPrompt(prompt, state.llmConfig);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        upsertServer({
          ...selected,
          enrichedDescription: parsed.serverDescription || selected.enrichedDescription,
          tools: selected.tools.map((t) => {
            const et = (parsed.tools || []).find((x: { name: string; enrichedDescription: string }) => x.name === t.name);
            return et ? { ...t, enrichedDescription: et.enrichedDescription } : t;
          }),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Enrichment failed', e);
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Integrations</p>
          <h1 className="display-xl">MCP Hub</h1>
          <p className="text-sm text-muted mt-2">
            Model Context Protocol server catalog — reference, manage, and enrich your MCP integrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => exportMcpXlsx(state.mcpServers || [], mcpFamilies)}
            title="Export MCP list to Excel"
            disabled={(state.mcpServers || []).length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export xlsx
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowReportModal(true)}
            disabled={(state.mcpServers || []).length === 0}
          >
            <FileDown className="w-4 h-4 mr-2" />
            AI PDF
          </Button>
          <Button variant="outline" size="md" onClick={() => setShowBestPractices(true)}>
            <BookOpen className="w-4 h-4 mr-2" />
            Best Practices
            {(state.mcpBestPractices || []).length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-brand text-white">
                {(state.mcpBestPractices || []).length}
              </span>
            )}
          </Button>
          {isAdmin && (
            <Button variant="outline" size="md" onClick={() => setShowFamilyManager(true)}>
              <Layers className="w-4 h-4 mr-2" />
              Families
            </Button>
          )}
          {/* View mode toggle */}
          <div className="flex border border-neutral-300 dark:border-ink-500">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-2 transition-colors ${
                viewMode === 'list' ? 'bg-brand text-white' : 'text-muted hover:text-brand'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-2 transition-colors ${
                viewMode === 'grid' ? 'bg-brand text-white' : 'text-muted hover:text-brand'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
      <div className="flex gap-6 min-h-[70vh]">
        {/* LEFT PANEL */}
        <aside className="w-72 shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search MCP servers…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Family filter chips */}
          {mcpFamilies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFamilyFilter(null)}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                  familyFilter === null ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand'
                }`}
              >
                All
              </button>
              {mcpFamilies.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFamilyFilter(familyFilter === f.id ? null : f.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                    familyFilter === f.id ? 'text-white border-transparent' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand'
                  }`}
                  style={familyFilter === f.id ? { backgroundColor: f.color, borderColor: f.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Filter / Sort / View toolbar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-brand text-brand bg-brand/5'
                  : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand'
              }`}
              title="Toggle advanced filters"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1 py-0 bg-brand text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="relative">
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [sb, sd] = e.target.value.split(':') as [typeof sortBy, typeof sortDir];
                  setSortBy(sb);
                  setSortDir(sd);
                }}
                className="appearance-none pl-6 pr-6 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-500 bg-transparent text-muted hover:text-brand hover:border-brand cursor-pointer transition-colors"
                title="Sort servers"
              >
                <option value="name:asc">Name A→Z</option>
                <option value="name:desc">Name Z→A</option>
                <option value="updated:desc">Recently updated</option>
                <option value="updated:asc">Oldest updated</option>
                <option value="created:desc">Newest first</option>
                <option value="created:asc">Oldest first</option>
                <option value="tools:desc">Most tools</option>
                <option value="tools:asc">Fewest tools</option>
              </select>
              <ArrowUpDown className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
          </div>

          {/* Collapsible advanced filters panel */}
          {showFilters && (
            <div className="border border-neutral-200 dark:border-ink-600 surface p-3 space-y-3 animate-fade-in">
              {/* Category */}
              {availableCategories.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Category</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        categoryFilter === null ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      All
                    </button>
                    {availableCategories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                          categoryFilter === c ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Deploy Status */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Deploy Status</p>
                <div className="flex gap-1">
                  {(['all', 'dev', 'uat', 'production'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setDeployFilter(s)}
                      className={`flex-1 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        deployFilter === s ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'production' ? 'Prod' : s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {/* Source */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Source</p>
                <div className="flex gap-1">
                  {(['all', 'declarative', 'url'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSourceFilter(s)}
                      className={`flex-1 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        sourceFilter === s ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'declarative' ? 'Decl.' : 'URL'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Active */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Status</p>
                <div className="flex gap-1">
                  {(['all', 'active', 'inactive'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveFilter(s)}
                      className={`flex-1 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        activeFilter === s ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="w-full text-[9px] font-bold uppercase tracking-[0.14em] text-brand hover:underline pt-1"
                >
                  Clear all filters ({activeFilterCount})
                </button>
              )}
            </div>
          )}

          {/* Results count */}
          <p className="text-[9px] uppercase tracking-[0.14em] text-muted px-1">
            {servers.length} {servers.length === 1 ? 'server' : 'servers'}
            {(state.mcpServers || []).length !== servers.length && (
              <span className="text-brand"> · filtered from {(state.mcpServers || []).length}</span>
            )}
          </p>

          {isAdmin && (
            <Button
              onClick={() => {
                setEditingServer(null);
                setShowEditor(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add MCP
            </Button>
          )}

          <div className="space-y-1 flex-1 overflow-y-auto">
            {servers.length === 0 && (
              <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-8 text-center text-muted">
                <Plug className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs uppercase tracking-[0.14em]">
                  {q || familyFilter ? 'No results' : 'No MCP servers yet'}
                </p>
                {isAdmin && !q && !familyFilter && (
                  <button
                    onClick={() => { setEditingServer(null); setShowEditor(true); }}
                    className="text-[10px] text-brand font-bold mt-2"
                  >
                    Add your first MCP →
                  </button>
                )}
              </div>
            )}
            {servers.map((srv) => {
              const fam = srv.familyId ? mcpFamilies.find((f) => f.id === srv.familyId) : null;
              return (
                <button
                  key={srv.id}
                  onClick={() => setSelectedId(srv.id)}
                  className={`w-full text-left border p-3 transition-colors ${
                    selectedId === srv.id
                      ? 'border-brand bg-brand/5'
                      : 'border-neutral-200 dark:border-ink-600 hover:border-brand surface'
                  }`}
                >
                  {fam && (
                    <div
                      className="w-full h-[3px] mb-2 -mx-3 -mt-3 px-3"
                      style={{ backgroundColor: fam.color, width: 'calc(100% + 24px)', marginLeft: '-12px', marginTop: '-12px' }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-tight truncate">{srv.name}</p>
                      {srv.category && (
                        <p className="text-[9px] text-brand font-bold uppercase tracking-[0.14em] mt-0.5">{srv.category}</p>
                      )}
                      {fam && (
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mt-0.5" style={{ color: fam.color }}>{fam.name}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {srv.deployStatus ? (
                        <span className={`px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] ${DEPLOY_STATUS_STYLE[srv.deployStatus]}`}>
                          {DEPLOY_STATUS_LABEL[srv.deployStatus]}
                        </span>
                      ) : (
                        <span className={`w-2 h-2 ${srv.isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} title={srv.isActive ? 'Active' : 'Inactive'} />
                      )}
                      <span className="text-[8px] font-mono text-muted">{srv.tools.length} tools</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <main className="flex-1 min-w-0 bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 text-muted">
              <Plug className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm uppercase tracking-[0.16em]">Select an MCP server</p>
              <p className="text-xs mt-2">Choose a server from the list to view details, tools, and enrichment options.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Family colour bar */}
              {selectedFamily && (
                <div className="-mx-6 -mt-6 h-1" style={{ backgroundColor: selectedFamily.color }} />
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Plug className="w-5 h-5 text-brand shrink-0" />
                    <h2 className="text-xl font-black uppercase tracking-tight">{selected.name}</h2>
                    {selected.deployStatus ? (
                      <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${DEPLOY_STATUS_STYLE[selected.deployStatus]}`}>
                        {DEPLOY_STATUS_LABEL[selected.deployStatus]}
                      </span>
                    ) : (
                      <span className={`w-2.5 h-2.5 shrink-0 ${selected.isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {selected.category && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">{selected.category}</span>
                    )}
                    {selectedFamily && (
                      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: selectedFamily.color }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedFamily.color }} />
                        {selectedFamily.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && state.llmConfig?.provider && (
                    <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching}>
                      {enriching ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enriching…</>
                      ) : (
                        <><Sparkles className="w-3 h-3 mr-1" /> Enrich with AI</>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewServer(selected)}
                    title="Open detailed preview & export ID card"
                  >
                    <IdCard className="w-3 h-3 mr-1" /> ID Card
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setEditingServer(selected); setShowEditor(true); }}>
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => { if (window.confirm(`Delete "${selected.name}"?`)) deleteServer(selected.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{selected.description}</p>
                {selected.enrichedDescription && (
                  <div className="mt-3 p-3 border-l-2 border-brand bg-brand/5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand mb-1">AI Enriched</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{selected.enrichedDescription}</p>
                  </div>
                )}
              </div>

              {/* Two-column metadata grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Column 1 — Context */}
                <div className="border border-neutral-200 dark:border-ink-600 p-4 space-y-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand mb-2">Context & Scope</p>
                  <MetaRow icon={<Settings2 className="w-3 h-3" />} label="Scope" value={selected.scope} />
                  <MetaRow icon={<Database className="w-3 h-3" />} label="Origin data" value={selected.originData} />
                  <MetaRow icon={<Layers className="w-3 h-3" />} label="Data scope" value={selected.dataScope} />
                  <MetaRow icon={<Database className="w-3 h-3" />} label="Data sources" value={selected.dataSourceUsed} />
                  <MetaRow icon={<Sparkles className="w-3 h-3" />} label="Use case" value={selected.useCase} />
                </div>
                {/* Column 2 — Teams */}
                <div className="border border-neutral-200 dark:border-ink-600 p-4 space-y-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand mb-2">Teams & Ownership</p>
                  <MetaRow icon={<Shield className="w-3 h-3" />} label="IT team" value={selected.teamIT} />
                  {(selected.userTeams || []).length > 0 && (
                    <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 dark:border-ink-700 last:border-0">
                      <Users className="w-3 h-3 text-muted mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">User teams</p>
                        <div className="flex flex-wrap gap-1">
                          {(selected.userTeams || []).map((t) => (
                            <span key={t} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* URL / token */}
                  {selected.url && (
                    <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 dark:border-ink-700 last:border-0">
                      <Link className="w-3 h-3 text-muted mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-0.5">URL</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-muted truncate">{selected.url}</span>
                          <button
                            onClick={() => { navigator.clipboard?.writeText(selected.url!); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 1500); }}
                            className="text-muted hover:text-brand transition-colors shrink-0"
                          >
                            {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 py-2">
                    <Shield className="w-3 h-3 text-muted shrink-0" />
                    {selected.token ? (
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">Token configured ✓</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">No token</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {(selected.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Tools list */}
              <div>
                <p className="label-xs mb-3">Tools ({selected.tools.length})</p>
                {selected.tools.length === 0 ? (
                  <p className="text-xs text-muted">No tools documented.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.tools.map((tool, i) => (
                      <div key={i} className="border border-neutral-200 dark:border-ink-600 p-3 surface-flat">
                        <p className="text-[11px] font-bold uppercase tracking-tight font-mono text-brand">{tool.name}</p>
                        <p className="text-xs text-muted mt-1">{tool.description}</p>
                        {tool.enrichedDescription && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 italic">{tool.enrichedDescription}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      ) : (
        /* ==================== GRID VIEW ==================== */
        <div className="min-h-[70vh] flex flex-col gap-4">
          {/* Horizontal toolbar */}
          <div className="flex flex-wrap items-center gap-3 p-4 border border-neutral-200 dark:border-ink-600 surface">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Search MCP servers…"
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
                  : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand hover:text-brand'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0 bg-brand text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="relative">
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [sb, sd] = e.target.value.split(':') as [typeof sortBy, typeof sortDir];
                  setSortBy(sb);
                  setSortDir(sd);
                }}
                className="appearance-none pl-8 pr-8 py-2 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-500 bg-transparent text-muted hover:text-brand hover:border-brand cursor-pointer transition-colors"
              >
                <option value="name:asc">Name A→Z</option>
                <option value="name:desc">Name Z→A</option>
                <option value="updated:desc">Recently updated</option>
                <option value="updated:asc">Oldest updated</option>
                <option value="created:desc">Newest first</option>
                <option value="created:asc">Oldest first</option>
                <option value="tools:desc">Most tools</option>
                <option value="tools:asc">Fewest tools</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
            {/* Family chips */}
            {mcpFamilies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Family:</span>
                <button
                  onClick={() => setFamilyFilter(null)}
                  className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                    familyFilter === null ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                  }`}
                >
                  All
                </button>
                {mcpFamilies.map((f) => (
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
              {servers.length} {servers.length === 1 ? 'server' : 'servers'}
              {(state.mcpServers || []).length !== servers.length && (
                <span className="text-brand"> · filtered</span>
              )}
            </p>
            {isAdmin && (
              <Button onClick={() => { setEditingServer(null); setShowEditor(true); }} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add MCP
              </Button>
            )}
          </div>

          {/* Collapsible advanced filters panel */}
          {showFilters && (
            <div className="border border-neutral-200 dark:border-ink-600 surface p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              {availableCategories.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Category</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        categoryFilter === null ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      All
                    </button>
                    {availableCategories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                          categoryFilter === c ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Deploy Status</p>
                <div className="flex gap-1">
                  {(['all', 'dev', 'uat', 'production'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setDeployFilter(s)}
                      className={`flex-1 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        deployFilter === s ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'production' ? 'Prod' : s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Source</p>
                <div className="flex gap-1">
                  {(['all', 'declarative', 'url'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSourceFilter(s)}
                      className={`flex-1 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        sourceFilter === s ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'declarative' ? 'Decl.' : 'URL'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1.5">Status</p>
                <div className="flex gap-1">
                  {(['all', 'active', 'inactive'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveFilter(s)}
                      className={`flex-1 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                        activeFilter === s ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <div className="md:col-span-2 lg:col-span-4">
                  <button
                    onClick={resetFilters}
                    className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand hover:underline"
                  >
                    Clear all filters ({activeFilterCount})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grid of cards */}
          {servers.length === 0 ? (
            <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-16 text-center text-muted">
              <Plug className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm uppercase tracking-[0.16em]">
                {q || activeFilterCount > 0 ? 'No results match the current filters' : 'No MCP servers yet'}
              </p>
              {isAdmin && !q && activeFilterCount === 0 && (
                <button
                  onClick={() => { setEditingServer(null); setShowEditor(true); }}
                  className="text-[11px] text-brand font-bold mt-3 uppercase tracking-[0.14em]"
                >
                  + Add your first MCP
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {servers.map((srv) => {
                const fam = srv.familyId ? mcpFamilies.find((f) => f.id === srv.familyId) : null;
                return (
                  <McpServerCard
                    key={srv.id}
                    server={srv}
                    family={fam || null}
                    onClick={() => setPreviewServer(srv)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Preview modal (used by grid view + ID Card button) */}
      {previewServer && (
        <McpPreviewModal
          server={previewServer}
          family={previewServer.familyId ? mcpFamilies.find((f) => f.id === previewServer.familyId) || null : null}
          isAdmin={isAdmin}
          llmConfig={state.llmConfig}
          onClose={() => setPreviewServer(null)}
          onEdit={() => {
            setEditingServer(previewServer);
            setShowEditor(true);
            setPreviewServer(null);
          }}
          onDelete={() => {
            if (window.confirm(`Delete "${previewServer.name}"?`)) {
              deleteServer(previewServer.id);
              setPreviewServer(null);
            }
          }}
        />
      )}

      {showEditor && (
        <McpEditorModal
          server={editingServer}
          families={mcpFamilies}
          llmConfig={state.llmConfig}
          onClose={() => { setShowEditor(false); setEditingServer(null); }}
          onSave={(srv) => {
            upsertServer(srv);
            setSelectedId(srv.id);
            setShowEditor(false);
            setEditingServer(null);
          }}
        />
      )}

      {showFamilyManager && (
        <McpFamilyManagerModal
          families={mcpFamilies}
          onClose={() => setShowFamilyManager(false)}
          onSave={(families) => update((s) => ({ ...s, mcpFamilies: families }))}
        />
      )}

      {showReportModal && (
        <McpReportModal
          allServers={state.mcpServers || []}
          families={mcpFamilies}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {showBestPractices && (
        <McpBestPracticesModal
          practices={state.mcpBestPractices || []}
          servers={state.mcpServers || []}
          llmConfig={state.llmConfig}
          canEdit={currentUser.role !== 'viewer'}
          onClose={() => setShowBestPractices(false)}
          onSave={(practices) => update((s) => ({ ...s, mcpBestPractices: practices }))}
        />
      )}
    </div>
  );
};

/* === MCP Server Card (grid view) === */

const McpServerCard: React.FC<{
  server: McpServer;
  family: McpFamily | null;
  onClick: () => void;
}> = ({ server, family, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group text-left border border-neutral-200 dark:border-ink-600 surface hover:border-brand hover:shadow-lg transition-all flex flex-col h-full"
    >
      {/* Family colour bar */}
      <div className="h-1 w-full" style={{ backgroundColor: family?.color || '#d4d4d4' }} />
      <div className="p-4 flex-1 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-tight truncate group-hover:text-brand transition-colors">{server.name}</p>
            {server.category && (
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand mt-0.5">{server.category}</p>
            )}
          </div>
          {server.deployStatus ? (
            <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${DEPLOY_STATUS_STYLE[server.deployStatus]} shrink-0`}>
              {DEPLOY_STATUS_LABEL[server.deployStatus]}
            </span>
          ) : (
            <span className={`w-2 h-2 ${server.isActive ? 'bg-emerald-500' : 'bg-neutral-400'} shrink-0 mt-1`} title={server.isActive ? 'Active' : 'Inactive'} />
          )}
        </div>
        <p className="text-xs text-muted line-clamp-3 flex-1">{server.description || 'No description.'}</p>
        {family && (
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: family.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: family.color }} />
            {family.name}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-neutral-100 dark:border-ink-700">
          <span className="text-[9px] font-mono text-muted">
            {server.tools.length} {server.tools.length === 1 ? 'tool' : 'tools'}
          </span>
          {server.tags && server.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center">
              {server.tags.slice(0, 2).map((t) => (
                <span key={t} className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted bg-neutral-100 dark:bg-ink-700 px-1 py-0.5">{t}</span>
              ))}
              {server.tags.length > 2 && (
                <span className="text-[8px] text-muted">+{server.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

/* === MCP Preview Modal (read-only detailed view) === */

const McpPreviewModal: React.FC<{
  server: McpServer;
  family: McpFamily | null;
  isAdmin: boolean;
  llmConfig: LlmConfig;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ server, family, isAdmin, llmConfig, onClose, onEdit, onDelete }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleIdCard = async () => {
    setGeneratingPdf(true);
    try {
      await exportMcpIdCard(server, family, llmConfig);
    } catch (e) {
      console.error('ID Card export failed', e);
      alert('Failed to generate ID Card. Check the console for details.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {family && <div className="h-1 w-full shrink-0" style={{ backgroundColor: family.color }} />}

        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-start justify-between gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Plug className="w-5 h-5 text-brand shrink-0" />
              <h2 className="text-xl font-black uppercase tracking-tight">{server.name}</h2>
              {server.deployStatus ? (
                <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${DEPLOY_STATUS_STYLE[server.deployStatus]}`}>
                  {DEPLOY_STATUS_LABEL[server.deployStatus]}
                </span>
              ) : (
                <span className={`w-2.5 h-2.5 shrink-0 ${server.isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[9px] font-bold uppercase tracking-[0.14em]">
              {server.category && <span className="text-brand">{server.category}</span>}
              {family && (
                <span className="flex items-center gap-1" style={{ color: family.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: family.color }} />
                  {family.name}
                </span>
              )}
              <span className="text-muted">· {server.source === 'declarative' ? 'Declarative' : 'URL/Discovery'}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{server.description || 'No description.'}</p>
            {server.enrichedDescription && (
              <div className="mt-3 p-3 border-l-2 border-brand bg-brand/5">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand mb-1">AI Enriched</p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{server.enrichedDescription}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-neutral-200 dark:border-ink-600 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand mb-2">Context & Scope</p>
              <MetaRow icon={<Settings2 className="w-3 h-3" />} label="Scope" value={server.scope} />
              <MetaRow icon={<Database className="w-3 h-3" />} label="Origin data" value={server.originData} />
              <MetaRow icon={<Layers className="w-3 h-3" />} label="Data scope" value={server.dataScope} />
              <MetaRow icon={<Database className="w-3 h-3" />} label="Data sources" value={server.dataSourceUsed} />
              <MetaRow icon={<Sparkles className="w-3 h-3" />} label="Use case" value={server.useCase} />
            </div>
            <div className="border border-neutral-200 dark:border-ink-600 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand mb-2">Teams & Connection</p>
              <MetaRow icon={<Shield className="w-3 h-3" />} label="IT team" value={server.teamIT} />
              {(server.userTeams || []).length > 0 && (
                <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 dark:border-ink-700 last:border-0">
                  <Users className="w-3 h-3 text-muted mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-1">User teams</p>
                    <div className="flex flex-wrap gap-1">
                      {(server.userTeams || []).map((t) => (
                        <span key={t} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {server.url && (
                <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 dark:border-ink-700 last:border-0">
                  <Link className="w-3 h-3 text-muted mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted mb-0.5">URL</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-muted truncate">{server.url}</span>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(server.url!); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 1500); }}
                        className="text-muted hover:text-brand transition-colors shrink-0"
                      >
                        {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 py-2">
                <Shield className="w-3 h-3 text-muted shrink-0" />
                {server.token ? (
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">Token configured ✓</span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">No token</span>
                )}
              </div>
            </div>
          </div>

          {(server.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {server.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">{t}</span>
              ))}
            </div>
          )}

          <div>
            <p className="label-xs mb-3">Tools ({server.tools.length})</p>
            {server.tools.length === 0 ? (
              <p className="text-xs text-muted">No tools documented.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {server.tools.map((tool, i) => (
                  <div key={i} className="border border-neutral-200 dark:border-ink-600 p-3 surface-flat">
                    <p className="text-[11px] font-bold uppercase tracking-tight font-mono text-brand">{tool.name}</p>
                    <p className="text-xs text-muted mt-1">{tool.description}</p>
                    {tool.enrichedDescription && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 italic">{tool.enrichedDescription}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleIdCard}
            disabled={generatingPdf || !llmConfig?.provider}
            title={!llmConfig?.provider ? 'Configure a local LLM first' : 'Export a slide-deck ID card as PDF'}
          >
            {generatingPdf ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
            ) : (
              <><IdCard className="w-3.5 h-3.5 mr-1.5" /> Export ID Card</>
            )}
          </Button>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* === MCP Editor Modal === */

const McpEditorModal: React.FC<{
  server: McpServer | null;
  families: McpFamily[];
  llmConfig: LlmConfig;
  onClose: () => void;
  onSave: (srv: McpServer) => void;
}> = ({ server, families, llmConfig, onClose, onSave }) => {
  const isNew = !server;
  const now = new Date().toISOString();
  const [mode, setMode] = useState<'declarative' | 'url'>(server?.source ?? 'declarative');
  const [name, setName] = useState(server?.name ?? '');
  const [description, setDescription] = useState(server?.description ?? '');
  const [category, setCategory] = useState(server?.category ?? '');
  const [tagsStr, setTagsStr] = useState((server?.tags || []).join(', '));
  const [url, setUrl] = useState(server?.url ?? '');
  const [token, setToken] = useState('');
  const [isActive, setIsActive] = useState(server?.isActive ?? true);
  const [tools, setTools] = useState<McpTool[]>(server?.tools ?? []);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');

  // Extended fields
  const [familyId, setFamilyId] = useState(server?.familyId ?? '');
  const [scope, setScope] = useState(server?.scope ?? '');
  const [originData, setOriginData] = useState(server?.originData ?? '');
  const [dataScope, setDataScope] = useState(server?.dataScope ?? '');
  const [dataSourceUsed, setDataSourceUsed] = useState(server?.dataSourceUsed ?? '');
  const [useCase, setUseCase] = useState(server?.useCase ?? '');
  const [teamIT, setTeamIT] = useState(server?.teamIT ?? '');
  const [userTeamsStr, setUserTeamsStr] = useState((server?.userTeams || []).join(', '));
  const [deployStatus, setDeployStatus] = useState<McpDeployStatus | ''>(server?.deployStatus ?? '');

  // AI Code Analysis
  const [codeAnalysis, setCodeAnalysis] = useState<McpCodeAnalysis | undefined>(server?.codeAnalysis);
  const [codeInput, setCodeInput] = useState('');
  const [codeFileName, setCodeFileName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleDiscover = async () => {
    if (!url.trim()) return;
    setDiscovering(true);
    setDiscoverError('');
    try {
      const res = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), authToken: token.trim() }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as { detail?: string }));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const discovered: McpTool[] = (data.tools || []).map((t: Record<string, string>) => ({
        name: t.name || '',
        description: t.description || '',
      }));
      setTools(discovered);
      if (discovered.length === 0) setDiscoverError('Connected but the server reported zero tools.');
    } catch (e: any) {
      setDiscoverError(`${e.message || 'Discovery failed'}. You can add tools manually.`);
    } finally {
      setDiscovering(false);
    }
  };

  const addTool = () => {
    if (!newToolName.trim()) return;
    setTools((t) => [...t, { name: newToolName.trim(), description: newToolDesc.trim() }]);
    setNewToolName('');
    setNewToolDesc('');
  };

  const removeTool = (i: number) => setTools((t) => t.filter((_, idx) => idx !== i));

  // ── AI Code Analysis ────────────────────────────────────────────────
  const handleCodeFileUpload = async (file: File) => {
    setCodeFileName(file.name);
    setAnalyzeError('');
    try {
      const text = await file.text();
      // Cap to 80k chars so the LLM context stays manageable
      setCodeInput(text.length > 80000 ? text.slice(0, 80000) : text);
      if (text.length > 80000) {
        setAnalyzeError(`File is large — truncated to first 80,000 chars (${text.length.toLocaleString()} total).`);
      }
    } catch (e: any) {
      setAnalyzeError(`Could not read file: ${e.message}`);
    }
  };

  const runAnalysis = async () => {
    if (!codeInput.trim()) {
      setAnalyzeError('Paste code or upload a file first.');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const analysis = await analyzeMcpCode(name || 'Unnamed MCP', codeInput, llmConfig);
      setCodeAnalysis(analysis);
    } catch (e: any) {
      setAnalyzeError(e.message || 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRecommendation = (id: string) => {
    if (!codeAnalysis) return;
    setCodeAnalysis({
      ...codeAnalysis,
      recommendations: codeAnalysis.recommendations.map((r) =>
        r.id === id
          ? { ...r, done: !r.done, fixedAt: !r.done ? new Date().toISOString() : undefined }
          : r
      ),
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const srv: McpServer = {
      id: server?.id ?? generateId(),
      name: name.trim(),
      description: description.trim(),
      enrichedDescription: server?.enrichedDescription,
      url: url.trim() || undefined,
      token: token.trim() || server?.token || undefined,
      source: mode,
      tools,
      category: category.trim() || undefined,
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
      isActive,
      familyId: familyId || undefined,
      scope: scope.trim() || undefined,
      originData: originData.trim() || undefined,
      dataScope: dataScope.trim() || undefined,
      dataSourceUsed: dataSourceUsed.trim() || undefined,
      useCase: useCase.trim() || undefined,
      teamIT: teamIT.trim() || undefined,
      userTeams: userTeamsStr.split(',').map((t) => t.trim()).filter(Boolean),
      deployStatus: deployStatus || undefined,
      codeAnalysis,
      createdAt: server?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(srv);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl max-h-[92vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-black uppercase tracking-tight">
            {isNew ? 'Add MCP Server' : `Edit — ${server?.name}`}
          </h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-4 flex gap-2 shrink-0">
          <button
            onClick={() => setMode('declarative')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${mode === 'declarative' ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'}`}
          >
            Declarative
          </button>
          <button
            onClick={() => setMode('url')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${mode === 'url' ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 text-muted hover:border-brand'}`}
          >
            URL / Discovery
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Section 1: Identity ── */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Identity</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Server name *">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack MCP" />
              </Field>
              <Field label="Family">
                <Select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
                  <option value="">— No family —</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">— None —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Deploy status">
                <Select value={deployStatus} onChange={(e) => setDeployStatus(e.target.value as McpDeployStatus | '')}>
                  <option value="">— Not set —</option>
                  <option value="dev">Dev</option>
                  <option value="uat">UAT</option>
                  <option value="production">Production</option>
                </Select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Description">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this MCP server do?" />
                </Field>
              </div>
              <Field label="Tags (comma-separated)">
                <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="e.g. slack, messaging" />
              </Field>
              <Field label="Status">
                <div className="flex items-center gap-2 h-10">
                  <button
                    onClick={() => setIsActive((v) => !v)}
                    className={`relative w-10 h-5 transition-colors ${isActive ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-ink-500'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </Field>
            </div>
          </div>

          {/* ── Section 2: Data & Scope ── */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Data & Scope</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Scope">
                <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Internal, External, Cross-team…" />
              </Field>
              <Field label="Origin data">
                <Input value={originData} onChange={(e) => setOriginData(e.target.value)} placeholder="Internal DB, Public API, Partner feed…" />
              </Field>
              <Field label="Data scope">
                <Input value={dataScope} onChange={(e) => setDataScope(e.target.value)} placeholder="Finance, HR, All, Europe…" />
              </Field>
              <Field label="Data sources used">
                <Input value={dataSourceUsed} onChange={(e) => setDataSourceUsed(e.target.value)} placeholder="PostgreSQL, Salesforce, SharePoint…" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Use case">
                  <Textarea value={useCase} onChange={(e) => setUseCase(e.target.value)} rows={2} placeholder="Describe the primary use case…" />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Section 3: Teams ── */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Teams</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="IT team (owner)">
                <Input value={teamIT} onChange={(e) => setTeamIT(e.target.value)} placeholder="Platform, Data Engineering…" />
              </Field>
              <Field label="User team(s) (comma-separated)">
                <Input value={userTeamsStr} onChange={(e) => setUserTeamsStr(e.target.value)} placeholder="Finance, Legal, Marketing…" />
              </Field>
            </div>
          </div>

          {/* ── Section 4: Connection ── */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Connection</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="URL (optional)">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Token (optional, stored securely)">
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={server?.token ? '••••••••' : 'API token or bearer key'}
                />
              </Field>
            </div>
            {mode === 'url' && (
              <div className="border border-neutral-200 dark:border-ink-600 p-3 space-y-2 mt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Auto-discover tools from endpoint</p>
                <Button variant="outline" size="sm" onClick={handleDiscover} disabled={!url.trim() || discovering}>
                  {discovering ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Discovering…</> : 'Discover tools'}
                </Button>
                {discoverError && <p className="text-[10px] text-amber-600 dark:text-amber-400">{discoverError}</p>}
              </div>
            )}
          </div>

          {/* ── Section 5: AI Code Analysis ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand">AI Code Analysis</p>
              {codeAnalysis && (
                <span className="text-[9px] font-mono text-muted">
                  Analyzed {new Date(codeAnalysis.analyzedAt).toLocaleDateString()} ·
                  {' '}{codeAnalysis.recommendations.filter((r) => r.done).length}/{codeAnalysis.recommendations.length} fixed
                </span>
              )}
            </div>

            <div className="space-y-3 border border-neutral-200 dark:border-ink-600 p-3 bg-neutral-50 dark:bg-ink-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="border border-dashed border-neutral-300 dark:border-ink-500 hover:border-brand p-3 text-center cursor-pointer transition-colors block">
                  <Upload className="w-4 h-4 mx-auto mb-1 text-muted" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Upload code file</p>
                  <p className="text-[9px] text-muted mt-0.5">{codeFileName || '.py .ts .js .go .rs .java …'}</p>
                  <input
                    type="file"
                    accept=".py,.ts,.tsx,.js,.jsx,.go,.rs,.java,.rb,.cs,.cpp,.c,.h,.swift,.kt,.php,.scala,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCodeFileUpload(f);
                    }}
                  />
                </label>
                <Textarea
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  rows={3}
                  placeholder="… or paste code directly here"
                  className="!text-[10px] !font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={runAnalysis}
                  disabled={analyzing || !codeInput.trim()}
                >
                  {analyzing ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing…</>
                  ) : (
                    <><ScanLine className="w-3 h-3 mr-1" /> {codeAnalysis ? 'Re-analyze' : 'Analyze with AI'}</>
                  )}
                </Button>
                {codeAnalysis && (
                  <Button size="sm" variant="outline" onClick={() => { setCodeAnalysis(undefined); setCodeInput(''); setCodeFileName(''); }}>
                    Clear
                  </Button>
                )}
                <span className="text-[9px] text-muted ml-auto">
                  {codeInput.length.toLocaleString()} chars
                </span>
              </div>

              {analyzeError && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <p className="text-[10px]">{analyzeError}</p>
                </div>
              )}

              {codeAnalysis && (
                <div className="space-y-3 mt-2">
                  {/* Summary */}
                  {codeAnalysis.summary && (
                    <details className="border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-900" open>
                      <summary className="cursor-pointer p-2.5 text-[10px] font-bold uppercase tracking-[0.14em] flex items-center gap-2">
                        <BookOpen className="w-3 h-3 text-brand" />
                        Analysis summary
                        {codeAnalysis.language && (
                          <span className="text-[9px] font-mono text-muted ml-auto">{codeAnalysis.language}</span>
                        )}
                      </summary>
                      <div className="px-3 pb-3 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {codeAnalysis.summary}
                      </div>
                    </details>
                  )}
                  {/* Recommendations checklist */}
                  {codeAnalysis.recommendations.length > 0 && (
                    <div className="border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-900">
                      <div className="p-2.5 border-b border-neutral-200 dark:border-ink-600 text-[10px] font-bold uppercase tracking-[0.14em] flex items-center gap-2">
                        <ListChecks className="w-3 h-3 text-brand" />
                        Recommendations ({codeAnalysis.recommendations.filter((r) => r.done).length}/{codeAnalysis.recommendations.length} done)
                      </div>
                      <div className="divide-y divide-neutral-100 dark:divide-ink-700">
                        {codeAnalysis.recommendations.map((rec) => (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => toggleRecommendation(rec.id)}
                            className="w-full text-left flex items-start gap-2 p-2.5 hover:bg-brand/5 transition-colors"
                          >
                            {rec.done ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${rec.done ? 'line-through text-muted' : ''}`}>{rec.text}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {rec.severity && (
                                  <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] border ${SEVERITY_STYLE[rec.severity]}`}>
                                    {rec.severity}
                                  </span>
                                )}
                                {rec.category && (
                                  <span className="text-[9px] text-muted">{rec.category}</span>
                                )}
                                {rec.fixedAt && (
                                  <span className="text-[9px] text-emerald-600">✓ {new Date(rec.fixedAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 6: Tools ── */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand mb-3">Tools ({tools.length})</p>
            <div className="space-y-2 mb-3">
              {tools.map((t, i) => (
                <div key={i} className="flex items-start gap-2 border border-neutral-200 dark:border-ink-600 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold font-mono text-brand">{t.name}</p>
                    <p className="text-xs text-muted mt-0.5">{t.description || '—'}</p>
                  </div>
                  <button onClick={() => removeTool(i)} className="text-muted hover:text-red-500 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 dark:border-ink-600 pt-3">
              <Input placeholder="Tool name" value={newToolName} onChange={(e) => setNewToolName(e.target.value)} />
              <div className="flex gap-1">
                <Input placeholder="Description" value={newToolDesc} onChange={(e) => setNewToolDesc(e.target.value)} className="flex-1" />
                <Button size="sm" variant="outline" onClick={addTool} disabled={!newToolName.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isNew ? 'Add Server' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* === MCP Family Manager Modal === */

const McpFamilyManagerModal: React.FC<{
  families: McpFamily[];
  onClose: () => void;
  onSave: (families: McpFamily[]) => void;
}> = ({ families, onClose, onSave }) => {
  // Auto-save pattern: every mutation persists immediately via onSave().
  // No local buffer of the families array → impossible to "lose" data by
  // closing the modal or pressing Escape. The local state only holds the
  // in-progress form fields (name/description/color) for the currently-edited entry.
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
    setEditingId('__new__');
    setName('');
    setDescription('');
    setColor(FAMILY_COLORS[families.length % FAMILY_COLORS.length]);
  };

  const openEdit = (f: McpFamily) => {
    setEditingId(f.id);
    setName(f.name);
    setDescription(f.description || '');
    setColor(f.color);
  };

  const saveEntry = () => {
    if (!name.trim()) return;
    let next: McpFamily[];
    if (editingId === '__new__') {
      const nf: McpFamily = {
        id: generateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        createdAt: new Date().toISOString(),
      };
      next = [...families, nf];
    } else {
      next = families.map((f) =>
        f.id === editingId
          ? { ...f, name: name.trim(), description: description.trim() || undefined, color }
          : f
      );
    }
    onSave(next);
    setEditingId(null);
  };

  const deleteFamily = (id: string) => {
    if (!window.confirm('Delete this family? Servers assigned to it will lose the link.')) return;
    onSave(families.filter((f) => f.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand" /> MCP Families
          </h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Auto-save notice */}
          <p className="text-[10px] text-muted uppercase tracking-[0.16em] flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Changes are saved automatically
          </p>

          {/* Family list */}
          <div className="space-y-2">
            {families.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No families yet. Create one below.</p>
            )}
            {families.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border border-neutral-200 dark:border-ink-600 p-3">
                <span className="w-4 h-4 shrink-0" style={{ backgroundColor: f.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase tracking-tight truncate">{f.name}</p>
                  {f.description && <p className="text-[10px] text-muted truncate">{f.description}</p>}
                </div>
                <button onClick={() => openEdit(f)} className="text-muted hover:text-brand transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteFamily(f.id)} className="text-muted hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Inline create/edit form */}
          {editingId !== null ? (
            <div className="border border-brand/30 bg-brand/5 p-4 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand">
                {editingId === '__new__' ? 'New family' : 'Edit family'}
              </p>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Family name" />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" />
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted flex items-center gap-1.5">
                  <Palette className="w-3 h-3" /> Colour
                </label>
                <div className="flex gap-2 flex-wrap">
                  {FAMILY_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-white' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 border-0 cursor-pointer"
                    title="Custom colour"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" onClick={saveEntry} disabled={!name.trim()}>
                  {editingId === '__new__' ? 'Create' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> New family
            </Button>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2 shrink-0">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

/* === MCP Report Modal === */

const McpReportModal: React.FC<{
  allServers: McpServer[];
  families: McpFamily[];
  onClose: () => void;
}> = ({ allServers, families, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(allServers.map((s) => s.id)));
  const [fullscreen, setFullscreen] = useState(false);
  const familyMap = new Map(families.map((f) => [f.id, f]));

  const DEPLOY_CHIP: Record<string, string> = {
    production: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    uat: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    dev: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  };

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const includedServers = allServers.filter((s) => selected.has(s.id));
  const html = buildMcpReportHTML(includedServers, families);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`surface border flex transition-all duration-200 ${fullscreen ? 'w-full h-full' : 'w-full max-w-7xl h-[94vh]'}`}>
        {/* Left sidebar — server picker */}
        <div className="w-64 shrink-0 flex flex-col border-r border-neutral-200 dark:border-ink-600">
          <div className="p-4 border-b border-neutral-200 dark:border-ink-600">
            <p className="text-[11px] font-black uppercase tracking-tight mb-1">Servers to include</p>
            <p className="text-[9px] font-mono text-muted">{selected.size} / {allServers.length} selected</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSelected(new Set(allServers.map((s) => s.id)))}
                className="text-[9px] font-bold uppercase tracking-[0.12em] text-brand hover:underline"
              >All</button>
              <span className="text-muted text-[9px]">·</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted hover:text-brand"
              >None</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {allServers.map((srv) => {
              const on = selected.has(srv.id);
              const fam = srv.familyId ? familyMap.get(srv.familyId) : undefined;
              return (
                <button
                  key={srv.id}
                  onClick={() => toggle(srv.id)}
                  className={`w-full text-left flex items-start gap-2 p-2.5 border transition-colors ${on ? 'border-brand bg-brand/5' : 'border-neutral-200 dark:border-ink-600 opacity-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(srv.id)}
                    className="mt-0.5 w-3.5 h-3.5 accent-brand shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-tight truncate">{srv.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {fam && <span className="text-[8px] font-bold" style={{ color: fam.color }}>{fam.name}</span>}
                      {srv.deployStatus && (
                        <span className={`px-1 py-px text-[7px] font-bold uppercase tracking-[0.08em] ${DEPLOY_CHIP[srv.deployStatus] || ''}`}>
                          {srv.deployStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — preview + toolbar */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileDown className="w-4 h-4 text-brand shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] truncate">MCP Hub Report</p>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-brand/10 text-brand border border-brand/20">
                {includedServers.length} servers
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setFullscreen((v) => !v)}
                className="w-8 h-8 flex items-center justify-center border border-neutral-300 dark:border-ink-500 text-muted hover:text-brand hover:border-brand transition-colors"
              >
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <div className="w-px h-5 bg-neutral-200 dark:bg-ink-600 mx-0.5" />
              <Button size="sm" onClick={handlePrint} disabled={includedServers.length === 0}>
                <Printer className="w-3 h-3 mr-1.5" />
                Print / Save PDF
              </Button>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted hover:text-red-500 transition-colors ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-ink-900">
            {includedServers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted gap-3">
                <Plug className="w-10 h-10 opacity-20" />
                <p className="text-xs uppercase tracking-[0.16em]">Select at least one server</p>
              </div>
            ) : (
              <iframe
                key={selected.size}
                ref={iframeRef}
                srcDoc={html}
                title="MCP Report Preview"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-same-origin allow-scripts allow-modals allow-popups"
              />
            )}
          </div>

          <div className="px-4 py-2 border-t border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 shrink-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted text-center">
              Click "Print / Save PDF" → choose "Save as PDF" in the browser print dialog
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* === MCP Best Practices Modal === */

type BestPracticeMode = 'list' | 'manual' | 'ai_scratch' | 'synthesize';

const BP_CATEGORIES = ['Security', 'Reliability', 'Performance', 'DevX', 'Compliance', 'Architecture', 'Testing', 'Documentation'];

const PRACTICE_SOURCE_LABEL: Record<McpBestPracticeSource, string> = {
  manual: 'Manual',
  ai_generated: 'AI generated',
  ai_rephrased: 'AI rephrased',
  synthesized: 'Synthesized',
};

const PRACTICE_SOURCE_STYLE: Record<McpBestPracticeSource, string> = {
  manual: 'bg-neutral-100 text-neutral-700 dark:bg-ink-700 dark:text-neutral-300',
  ai_generated: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ai_rephrased: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  synthesized: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const McpBestPracticesModal: React.FC<{
  practices: McpBestPractice[];
  servers: McpServer[];
  llmConfig: LlmConfig;
  canEdit: boolean;
  onClose: () => void;
  onSave: (practices: McpBestPractice[]) => void;
}> = ({ practices: initial, servers, llmConfig, canEdit, onClose, onSave }) => {
  const [practices, setPractices] = useState<McpBestPractice[]>(initial);
  const [mode, setMode] = useState<BestPracticeMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftTagsStr, setDraftTagsStr] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategory, setAiCategory] = useState('Security');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const upsertPractice = (p: McpBestPractice) =>
    setPractices((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => x.id === p.id ? p : x) : [p, ...prev];
    });

  const removePractice = (id: string) =>
    setPractices((prev) => prev.filter((p) => p.id !== id));

  const togglePin = (id: string) =>
    setPractices((prev) => prev.map((p) => p.id === id ? { ...p, pinned: !p.pinned, updatedAt: new Date().toISOString() } : p));

  const openEdit = (p: McpBestPractice) => {
    setEditingId(p.id);
    setDraftTitle(p.title);
    setDraftCategory(p.category || '');
    setDraftTagsStr(p.tags.join(', '));
    setDraftContent(p.content);
    setMode('manual');
  };

  const startNewManual = () => {
    setEditingId(null);
    setDraftTitle('');
    setDraftCategory('');
    setDraftTagsStr('');
    setDraftContent('');
    setMode('manual');
  };

  const saveDraft = (source: McpBestPracticeSource = 'manual') => {
    if (!draftTitle.trim() || !draftContent.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      upsertPractice({
        id: editingId,
        title: draftTitle.trim(),
        content: draftContent.trim(),
        source: (practices.find((p) => p.id === editingId)?.source) || source,
        category: draftCategory || undefined,
        tags: draftTagsStr.split(',').map((t) => t.trim()).filter(Boolean),
        pinned: practices.find((p) => p.id === editingId)?.pinned,
        createdAt: practices.find((p) => p.id === editingId)?.createdAt || now,
        updatedAt: now,
      });
    } else {
      upsertPractice({
        id: generateId(),
        title: draftTitle.trim(),
        content: draftContent.trim(),
        source,
        category: draftCategory || undefined,
        tags: draftTagsStr.split(',').map((t) => t.trim()).filter(Boolean),
        createdAt: now,
        updatedAt: now,
      });
    }
    setEditingId(null);
    setMode('list');
  };

  const rephraseWithAI = async () => {
    if (!draftContent.trim()) return;
    setGenerating(true);
    setAiError('');
    try {
      const prompt = `You are an expert technical writer. Rephrase the following best-practice draft so it is professional, concise, structured Markdown in English. Keep the substance intact, improve clarity, structure into ## sections when useful, and add concrete actionable items as bullet lists.

DRAFT:
${draftContent}

Respond ONLY with the polished Markdown (no commentary, no code fences).`;
      const raw = await runPrompt(prompt, llmConfig);
      setDraftContent(raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim());
    } catch (e: any) {
      setAiError(e.message || 'Rephrase failed.');
    } finally {
      setGenerating(false);
    }
  };

  const generateFromScratch = async () => {
    setGenerating(true);
    setAiError('');
    try {
      const prompt = `You are a principal engineer producing a best-practice guide for MCP (Model Context Protocol) servers.

CATEGORY: ${aiCategory}
USER FOCUS (optional): ${aiPrompt || '(no specific focus, cover the essentials)'}

Produce a high-quality best-practice document in English Markdown:
- Start with a one-sentence "Why it matters" intro.
- Then 4-8 concrete, actionable best-practice items as a bullet list.
- Then a short "Anti-patterns" section.
- Finish with "Quick checklist" — a 3-5 item checkable list.

Respond ONLY with the Markdown body (no fences, no preface).`;
      const raw = await runPrompt(prompt, llmConfig);
      const cleaned = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      const title = aiPrompt.trim() || `${aiCategory} best practices`;
      const now = new Date().toISOString();
      upsertPractice({
        id: generateId(),
        title,
        content: cleaned,
        source: 'ai_generated',
        category: aiCategory,
        tags: [aiCategory.toLowerCase()],
        createdAt: now,
        updatedAt: now,
      });
      setMode('list');
      setAiPrompt('');
    } catch (e: any) {
      setAiError(e.message || 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const synthesizeFromAnalyses = async () => {
    const serversWithAnalysis = servers.filter((s) => s.codeAnalysis && s.codeAnalysis.recommendations.length > 0);
    if (serversWithAnalysis.length === 0) {
      setAiError('No MCPs have an AI Code Analysis yet. Run "AI Code Analysis" on at least one MCP first.');
      return;
    }
    setGenerating(true);
    setAiError('');
    try {
      const corpus = serversWithAnalysis.map((s) => {
        const recs = (s.codeAnalysis?.recommendations || [])
          .map((r) => `  - [${r.severity}/${r.category || 'general'}] ${r.text}`)
          .join('\n');
        return `### ${s.name}\n${recs}`;
      }).join('\n\n');

      const prompt = `You are a senior platform architect. The team has run AI code reviews on multiple MCP (Model Context Protocol) servers. Below is the consolidated list of recommendations across all reviewed MCPs.

Your job: synthesize the most important RECURRING themes into a small set of reusable best-practice guides that the team should adopt across all future MCPs.

CONSOLIDATED RECOMMENDATIONS:
${corpus}

Produce 3 to 6 best-practice guides as a JSON array (no fences, no commentary). Schema:
[
  {
    "title": "Short title (e.g. 'Validate all tool inputs at the boundary')",
    "category": "Security|Reliability|Performance|DevX|Compliance|Architecture|Testing|Documentation",
    "content": "Markdown body: one-line 'Why it matters', then a bullet list of 3-6 concrete actions, then '### Anti-patterns' section, then '### Quick checklist' with 3-5 items.",
    "tags": ["tag1", "tag2"]
  }
]

Rules:
- Each guide must consolidate a recurring theme observed in MULTIPLE MCPs.
- Be specific and actionable. No generic platitudes.
- Output ONLY the JSON array.`;

      const raw = await runPrompt(prompt, llmConfig);
      const cleaned = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      let parsed: any[];
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('AI returned malformed output.');
        parsed = JSON.parse(match[0]);
      }
      const now = new Date().toISOString();
      const newPractices: McpBestPractice[] = (Array.isArray(parsed) ? parsed : []).map((p) => ({
        id: generateId(),
        title: String(p.title || 'Untitled').trim(),
        content: String(p.content || '').trim(),
        source: 'synthesized' as McpBestPracticeSource,
        category: p.category && BP_CATEGORIES.includes(p.category) ? p.category : undefined,
        tags: Array.isArray(p.tags) ? p.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
        appliesTo: serversWithAnalysis.map((s) => s.id),
        createdAt: now,
        updatedAt: now,
      })).filter((p) => p.title && p.content);
      setPractices((prev) => [...newPractices, ...prev]);
      setMode('list');
    } catch (e: any) {
      setAiError(e.message || 'Synthesis failed.');
    } finally {
      setGenerating(false);
    }
  };

  // Filter & sort: pinned first, then by updatedAt
  const visible = practices
    .filter((p) => !filterCategory || p.category === filterCategory)
    .filter((p) => {
      if (!search.trim()) return true;
      const lq = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(lq) ||
        p.content.toLowerCase().includes(lq) ||
        p.tags.some((t) => t.toLowerCase().includes(lq))
      );
    })
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-5xl h-[92vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">MCP Best Practices</h2>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
                {practices.length} guide{practices.length !== 1 ? 's' : ''} · {servers.filter((s) => s.codeAnalysis).length} MCP analyses available
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pt-4 flex gap-1 shrink-0 border-b border-neutral-200 dark:border-ink-600 -mb-px">
          {[
            { id: 'list' as const, label: 'Library', icon: BookOpen },
            { id: 'manual' as const, label: 'Manual', icon: Edit2 },
            { id: 'ai_scratch' as const, label: 'AI from scratch', icon: Wand2 },
            { id: 'synthesize' as const, label: 'Synthesize from analyses', icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setAiError(''); if (id === 'manual' && !editingId) startNewManual(); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] border-b-2 transition-colors ${
                mode === id ? 'text-brand border-brand' : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {aiError && (
            <div className="mb-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs">{aiError}</p>
            </div>
          )}

          {/* LIST MODE */}
          {mode === 'list' && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search practices…"
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="md:w-48">
                  <option value="">All categories</option>
                  {BP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>

              {visible.length === 0 ? (
                <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-12 text-center text-muted">
                  <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-xs uppercase tracking-[0.14em]">
                    {practices.length === 0 ? 'No best practices yet' : 'No match'}
                  </p>
                  <p className="text-[10px] text-muted mt-1">Use the tabs above to create or generate one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map((p) => (
                    <div key={p.id} className={`border ${p.pinned ? 'border-brand bg-brand/5' : 'border-neutral-200 dark:border-ink-600'} p-3`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.pinned && <Pin className="w-3 h-3 text-brand" />}
                            <h3 className="text-sm font-bold uppercase tracking-tight">{p.title}</h3>
                            <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${PRACTICE_SOURCE_STYLE[p.source]}`}>
                              {PRACTICE_SOURCE_LABEL[p.source]}
                            </span>
                            {p.category && (
                              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">{p.category}</span>
                            )}
                          </div>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.12em] text-muted hover:text-brand">
                              Show content
                            </summary>
                            <div className="mt-2 p-3 bg-neutral-50 dark:bg-ink-800 text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                              {p.content}
                            </div>
                          </details>
                          {p.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {p.tags.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.appliesTo && p.appliesTo.length > 0 && (
                            <p className="text-[9px] text-muted mt-1">
                              Synthesized from {p.appliesTo.length} MCP{p.appliesTo.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              onClick={() => togglePin(p.id)}
                              title={p.pinned ? 'Unpin' : 'Pin to top'}
                              className="text-muted hover:text-brand transition-colors"
                            >
                              {p.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => openEdit(p)} className="text-muted hover:text-brand transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removePractice(p.id)} className="text-muted hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MANUAL MODE */}
          {mode === 'manual' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Write your own best-practice guide in Markdown. Use the AI rephrase button to polish your draft.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Title (e.g. Secure secret handling)" />
                <Select value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)}>
                  <option value="">— Category —</option>
                  {BP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <Input value={draftTagsStr} onChange={(e) => setDraftTagsStr(e.target.value)} placeholder="Tags (comma-separated)" />
              <Textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={14}
                placeholder="Write your Markdown content here…"
                className="!font-mono !text-xs"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={rephraseWithAI} disabled={generating || !draftContent.trim()}>
                  {generating ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Rephrasing…</> : <><Wand2 className="w-3 h-3 mr-1" /> Rephrase with AI</>}
                </Button>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setMode('list'); setEditingId(null); }}>Cancel</Button>
                  <Button size="sm" onClick={() => saveDraft(editingId ? undefined : 'manual')} disabled={!draftTitle.trim() || !draftContent.trim()}>
                    {editingId ? 'Save changes' : 'Save practice'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* AI FROM SCRATCH */}
          {mode === 'ai_scratch' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Generate a fresh best-practice guide from scratch with the local LLM. Pick a category and optionally a specific focus.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-xs">Category</label>
                  <Select value={aiCategory} onChange={(e) => setAiCategory(e.target.value)}>
                    {BP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="label-xs">Focus (optional)</label>
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. handling rate limits, secret rotation…"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setMode('list')}>Cancel</Button>
                <Button size="sm" onClick={generateFromScratch} disabled={generating}>
                  {generating ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating…</> : <><Wand2 className="w-3 h-3 mr-1" /> Generate</>}
                </Button>
              </div>
            </div>
          )}

          {/* SYNTHESIZE */}
          {mode === 'synthesize' && (
            <div className="space-y-3">
              <div className="border-l-2 border-brand bg-brand/5 p-3">
                <p className="text-xs">
                  <strong>Methodology:</strong> the AI reads the recommendations checklists from every MCP that has an{' '}
                  <em>AI Code Analysis</em> saved, identifies recurring themes across them, and synthesizes a small set of
                  reusable best-practice guides the team should adopt for all future MCPs.
                </p>
                <p className="text-xs mt-2">
                  <strong>Coverage:</strong>{' '}
                  {servers.filter((s) => s.codeAnalysis).length} / {servers.length} MCPs analyzed (
                  {servers.reduce((n, s) => n + (s.codeAnalysis?.recommendations.length || 0), 0)} recommendations in the corpus).
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setMode('list')}>Cancel</Button>
                <Button size="sm" onClick={synthesizeFromAnalyses} disabled={generating || servers.filter((s) => s.codeAnalysis).length === 0}>
                  {generating ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Synthesizing…</> : <><Sparkles className="w-3 h-3 mr-1" /> Synthesize now</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between shrink-0">
          {mode === 'list' && canEdit ? (
            <Button variant="outline" size="sm" onClick={startNewManual}>
              <Plus className="w-3 h-3 mr-1" />
              New practice
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => { onSave(practices); onClose(); }}>Save library</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
