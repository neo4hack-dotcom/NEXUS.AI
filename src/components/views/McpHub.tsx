import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { AppState, McpServer, McpTool, McpFamily, McpDeployStatus, User } from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { runPrompt } from '../../services/llmService';

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
  const [enriching, setEnriching] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const isAdmin = currentUser.role === 'admin';

  const mcpFamilies: McpFamily[] = state.mcpFamilies || [];

  const servers = useMemo(() => {
    const lq = q.toLowerCase();
    return (state.mcpServers || []).filter((s) => {
      const matchesQ =
        s.name.toLowerCase().includes(lq) ||
        (s.category || '').toLowerCase().includes(lq) ||
        s.description.toLowerCase().includes(lq) ||
        (s.useCase || '').toLowerCase().includes(lq) ||
        (s.teamIT || '').toLowerCase().includes(lq) ||
        (s.userTeams || []).some((t) => t.toLowerCase().includes(lq)) ||
        s.tags.some((t) => t.toLowerCase().includes(lq));
      const matchesFamily = familyFilter === null || s.familyId === familyFilter;
      return matchesQ && matchesFamily;
    });
  }, [state.mcpServers, q, familyFilter]);

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
        {isAdmin && (
          <Button variant="outline" size="md" onClick={() => setShowFamilyManager(true)}>
            <Layers className="w-4 h-4 mr-2" />
            Families
          </Button>
        )}
      </div>

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

      {showEditor && (
        <McpEditorModal
          server={editingServer}
          families={mcpFamilies}
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
    </div>
  );
};

/* === MCP Editor Modal === */

const McpEditorModal: React.FC<{
  server: McpServer | null;
  families: McpFamily[];
  onClose: () => void;
  onSave: (srv: McpServer) => void;
}> = ({ server, families, onClose, onSave }) => {
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

          {/* ── Section 5: Tools ── */}
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
}> = ({ families: initial, onClose, onSave }) => {
  const [families, setFamilies] = useState<McpFamily[]>(initial);
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
    if (editingId === '__new__') {
      const nf: McpFamily = {
        id: generateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        createdAt: new Date().toISOString(),
      };
      setFamilies((prev) => [...prev, nf]);
    } else {
      setFamilies((prev) =>
        prev.map((f) => f.id === editingId ? { ...f, name: name.trim(), description: description.trim() || undefined, color } : f)
      );
    }
    setEditingId(null);
  };

  const deleteFamily = (id: string) => setFamilies((prev) => prev.filter((f) => f.id !== id));

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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(families); onClose(); }}>Save families</Button>
        </div>
      </div>
    </div>
  );
};
