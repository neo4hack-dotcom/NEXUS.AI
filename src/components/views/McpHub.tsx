import React, { useState } from 'react';
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
  Tag,
  Link,
  Shield,
} from 'lucide-react';
import { AppState, McpServer, McpTool, User } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';
import { runPrompt } from '../../services/llmService';

interface Props {
  state: AppState;
  currentUser: User;
  update: (mutator: (s: AppState) => AppState) => void;
}

const CATEGORIES = ['Productivity', 'Data', 'Dev Tools', 'AI / ML', 'Communication', 'Utilities', 'Other'];

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="label-xs">{label}</label>
    {children}
  </div>
);

export const McpHubView: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const isAdmin = currentUser.role === 'admin';

  const servers = (state.mcpServers || []).filter(
    (s) =>
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      (s.category || '').toLowerCase().includes(q.toLowerCase()) ||
      s.description.toLowerCase().includes(q.toLowerCase())
  );

  const selected = (state.mcpServers || []).find((s) => s.id === selectedId) ?? null;

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
      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const enriched: McpServer = {
          ...selected,
          enrichedDescription: parsed.serverDescription || selected.enrichedDescription,
          tools: selected.tools.map((t) => {
            const enrichedTool = (parsed.tools || []).find((et: { name: string; enrichedDescription: string }) => et.name === t.name);
            return enrichedTool ? { ...t, enrichedDescription: enrichedTool.enrichedDescription } : t;
          }),
          updatedAt: new Date().toISOString(),
        };
        upsertServer(enriched);
      }
    } catch (e) {
      console.error('Enrichment failed', e);
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="label-xs">Integrations</p>
        <h1 className="display-xl">MCP Hub</h1>
        <p className="text-sm text-muted mt-2">
          Model Context Protocol server catalog — reference, manage, and enrich your MCP integrations.
        </p>
      </div>

      <div className="flex gap-6 min-h-[70vh]">
        {/* LEFT PANEL — MCP list */}
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
                  {q ? 'No results' : 'No MCP servers yet'}
                </p>
                {isAdmin && !q && (
                  <button
                    onClick={() => { setEditingServer(null); setShowEditor(true); }}
                    className="text-[10px] text-brand font-bold mt-2"
                  >
                    Add your first MCP →
                  </button>
                )}
              </div>
            )}
            {servers.map((srv) => (
              <button
                key={srv.id}
                onClick={() => setSelectedId(srv.id)}
                className={`w-full text-left border p-3 transition-colors ${
                  selectedId === srv.id
                    ? 'border-brand bg-brand/5'
                    : 'border-neutral-200 dark:border-ink-600 hover:border-brand surface'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-tight truncate">{srv.name}</p>
                    {srv.category && (
                      <p className="text-[9px] text-brand font-bold uppercase tracking-[0.14em] mt-0.5">{srv.category}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`w-2 h-2 ${srv.isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} title={srv.isActive ? 'Active' : 'Inactive'} />
                    <span className="text-[8px] font-mono text-muted">{srv.tools.length} tools</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT PANEL — Detail */}
        <main className="flex-1 min-w-0 bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 text-muted">
              <Plug className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm uppercase tracking-[0.16em]">Select an MCP server</p>
              <p className="text-xs mt-2">Choose a server from the list to view details, tools, and enrichment options.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Plug className="w-5 h-5 text-brand shrink-0" />
                    <h2 className="text-xl font-black uppercase tracking-tight">{selected.name}</h2>
                    <span className={`w-2.5 h-2.5 shrink-0 ${selected.isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                  </div>
                  {selected.category && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand">{selected.category}</span>
                  )}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingServer(selected); setShowEditor(true); }}
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Delete "${selected.name}"?`)) deleteServer(selected.id);
                        }}
                      >
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

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 pb-4 border-b border-neutral-200 dark:border-ink-600">
                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] bg-neutral-100 dark:bg-ink-700 text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {/* URL */}
                {selected.url && (
                  <div className="flex items-center gap-2">
                    <Link className="w-3 h-3 text-muted" />
                    <span className="text-[10px] font-mono text-muted truncate max-w-[240px]">{selected.url}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(selected.url!);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 1500);
                      }}
                      className="text-muted hover:text-brand transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
                {/* Token indicator */}
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-muted" />
                  {selected.token ? (
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">Token configured ✓</span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">No token</span>
                  )}
                </div>
              </div>

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
          onClose={() => { setShowEditor(false); setEditingServer(null); }}
          onSave={(srv) => {
            upsertServer(srv);
            setSelectedId(srv.id);
            setShowEditor(false);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
};

/* === MCP Editor Modal === */

const McpEditorModal: React.FC<{
  server: McpServer | null;
  onClose: () => void;
  onSave: (srv: McpServer) => void;
}> = ({ server, onClose, onSave }) => {
  const isNew = !server;
  const now = new Date().toISOString();
  const [mode, setMode] = useState<'declarative' | 'url'>(server?.source ?? 'declarative');
  const [name, setName] = useState(server?.name ?? '');
  const [description, setDescription] = useState(server?.description ?? '');
  const [category, setCategory] = useState(server?.category ?? '');
  const [tagsStr, setTagsStr] = useState(server?.tags.join(', ') ?? '');
  const [url, setUrl] = useState(server?.url ?? '');
  const [token, setToken] = useState(''); // never pre-fill token
  const [isActive, setIsActive] = useState(server?.isActive ?? true);
  const [tools, setTools] = useState<McpTool[]>(server?.tools ?? []);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');

  const handleDiscover = async () => {
    if (!url.trim()) return;
    setDiscovering(true);
    setDiscoverError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token.trim()) headers['Authorization'] = `Bearer ${token.trim()}`;
      const res = await fetch(`${url.trim()}/tools/list`, { method: 'GET', headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const discovered: McpTool[] = (data.tools || data || []).map((t: Record<string, string>) => ({
        name: t.name || '',
        description: t.description || t.desc || '',
      }));
      setTools(discovered);
    } catch (e: any) {
      setDiscoverError(`Could not discover tools: ${e.message}. You can add them manually.`);
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
      createdAt: server?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(srv);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Server name *">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack MCP" />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— None —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What does this MCP server do?" />
              </Field>
            </div>
            <Field label="Tags (comma-separated)">
              <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="e.g. slack, messaging, notifications" />
            </Field>
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

          {/* URL discovery */}
          {mode === 'url' && (
            <div className="border border-neutral-200 dark:border-ink-600 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Auto-discover tools from endpoint</p>
              <Button variant="outline" size="sm" onClick={handleDiscover} disabled={!url.trim() || discovering}>
                {discovering ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Discovering…</> : 'Discover tools'}
              </Button>
              {discoverError && <p className="text-[10px] text-amber-600 dark:text-amber-400">{discoverError}</p>}
            </div>
          )}

          {/* Tools */}
          <div>
            <p className="label-xs mb-3">Tools ({tools.length})</p>
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
