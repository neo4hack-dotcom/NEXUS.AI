import React, { useState } from 'react';
import { GitBranch, ExternalLink, Plus, Trash2, X, Search, Download, Loader2, Check } from 'lucide-react';
import { AppState, Repository, RepoProvider, User } from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { generateId } from '../../services/storage';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const PROVIDER_BASE: Record<RepoProvider, string> = {
  bitbucket: 'https://bitbucket.org/',
  github: 'https://github.com/',
  gitlab: 'https://gitlab.com/',
  azure: 'https://dev.azure.com/',
  other: 'https://',
};

const PROVIDER_LABEL: Record<RepoProvider, string> = {
  bitbucket: 'Bitbucket',
  github: 'GitHub',
  gitlab: 'GitLab',
  azure: 'Azure DevOps',
  other: 'Other',
};

const newRepo = (): Repository => ({
  id: generateId(),
  name: 'new-repo',
  provider: 'bitbucket',
  url: 'https://bitbucket.org/org/repo',
  description: '',
  visibility: 'private',
  projectIds: [],
  createdAt: new Date().toISOString(),
});

export const Repositories: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Repository | null>(null);
  const [showBitbucketImport, setShowBitbucketImport] = useState(false);
  const canEdit = currentUser.role !== 'viewer';
  const canAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const filtered = state.repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(q.toLowerCase())
  );

  const upsert = (r: Repository) =>
    update((s) => ({
      ...s,
      repositories: s.repositories.some((x) => x.id === r.id)
        ? s.repositories.map((x) => (x.id === r.id ? r : x))
        : [...s.repositories, r],
    }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Source</p>
          <h1 className="display-xl">Code Repositories</h1>
          <p className="text-sm text-muted mt-2">
            {state.repositories.length} repos linked across the portfolio.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {canAdmin && (
            <Button variant="outline" onClick={() => setShowBitbucketImport(true)}>
              <Download className="w-4 h-4 mr-2" />
              Import Bitbucket
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={() => {
                const r = newRepo();
                upsert(r);
                setEdit(r);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add repo
            </Button>
          )}
        </div>
      </div>

      <div className="surface border">
        <div className="divide-y divide-neutral-200 dark:divide-ink-600">
          {filtered.map((r) => {
            const linked = state.projects.filter((p) => r.projectIds.includes(p.id));
            return (
              <div
                key={r.id}
                className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-neutral-50 dark:hover:bg-ink-800"
              >
                <div className="p-2 surface-flat border">
                  <GitBranch className="w-4 h-4 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold uppercase tracking-tight">{r.name}</p>
                    {r.provider && r.provider !== 'other' && (
                      <Badge tone="muted">{PROVIDER_LABEL[r.provider]}</Badge>
                    )}
                    <Badge tone={r.visibility === 'public' ? 'green' : 'muted'}>
                      {r.visibility}
                    </Badge>
                    {r.language && <Badge tone="brand">{r.language}</Badge>}
                  </div>
                  <p className="text-xs text-muted line-clamp-1">{r.description || r.url}</p>
                  {linked.length > 0 && (
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted mt-1">
                      Used by: {linked.map((p) => p.name).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 flex items-center justify-center border border-neutral-300 dark:border-ink-500 hover:border-brand hover:text-brand"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setEdit(r)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted py-12">No repositories.</p>
          )}
        </div>
      </div>

      {edit && (
        <RepoEditor
          r={edit}
          state={state}
          onClose={() => setEdit(null)}
          onSave={(r) => {
            upsert(r);
            setEdit(null);
          }}
          onDelete={() => {
            update((s) => ({ ...s, repositories: s.repositories.filter((x) => x.id !== edit.id) }));
            setEdit(null);
          }}
        />
      )}
      {showBitbucketImport && (
        <BitbucketImportModal
          existingUrls={state.repositories.map((r) => r.url)}
          onClose={() => setShowBitbucketImport(false)}
          onImport={(repos) => {
            update((s) => ({ ...s, repositories: [...s.repositories, ...repos] }));
            setShowBitbucketImport(false);
          }}
        />
      )}
    </div>
  );
};

const RepoEditor: React.FC<{
  r: Repository;
  state: AppState;
  onClose: () => void;
  onSave: (r: Repository) => void;
  onDelete: () => void;
}> = ({ r, state, onClose, onSave, onDelete }) => {
  const [d, setD] = useState<Repository>(r);

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleProviderChange = (p: RepoProvider) => {
    const base = PROVIDER_BASE[p];
    setD({ ...d, provider: p, url: d.url.startsWith('http') ? base : d.url });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-xl animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Repository</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="label-xs">Platform</label>
              <Select
                value={d.provider || 'bitbucket'}
                onChange={(e) => handleProviderChange(e.target.value as RepoProvider)}
              >
                {(Object.keys(PROVIDER_LABEL) as RepoProvider[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Visibility</label>
              <Select
                value={d.visibility}
                onChange={(e) => setD({ ...d, visibility: e.target.value as Repository['visibility'] })}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="internal">Internal</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Name</label>
            <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">URL</label>
            <Input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Description</label>
            <Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Language</label>
            <Input value={d.language || ''} onChange={(e) => setD({ ...d, language: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-xs">Linked projects</label>
            <div className="flex flex-wrap gap-2">
              {state.projects.map((p) => {
                const on = d.projectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setD({
                        ...d,
                        projectIds: on
                          ? d.projectIds.filter((x) => x !== p.id)
                          : [...d.projectIds, p.id],
                      })
                    }
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                      on ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-500 hover:border-brand'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between">
          <Button variant="danger" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onSave(d)}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===== Bitbucket Import Modal ===== */

interface BitbucketRepoPreview {
  name: string;
  url: string;
  description: string;
  language?: string;
  visibility: 'public' | 'private' | 'internal';
  alreadyExists: boolean;
  selected: boolean;
}

const BitbucketImportModal: React.FC<{
  existingUrls: string[];
  onClose: () => void;
  onImport: (repos: Repository[]) => void;
}> = ({ existingUrls, onClose, onImport }) => {
  const [mode, setMode] = useState<'cloud' | 'server'>('server');
  const [baseUrl, setBaseUrl] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<BitbucketRepoPreview[]>([]);
  const [fetched, setFetched] = useState(false);

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const toggleAll = () => {
    const available = previews.filter((p) => !p.alreadyExists);
    const allSelected = available.every((p) => p.selected);
    setPreviews(previews.map((p) => p.alreadyExists ? p : { ...p, selected: !allSelected }));
  };

  const fetchRepos = async () => {
    setLoading(true);
    setError('');
    setPreviews([]);
    setFetched(false);
    try {
      const headers: Record<string, string> = {};
      if (username && token) {
        headers['Authorization'] = `Basic ${btoa(`${username}:${token}`)}`;
      } else if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let repos: BitbucketRepoPreview[] = [];

      if (mode === 'cloud') {
        // Bitbucket Cloud: GET /2.0/repositories/{workspace}
        const ws = workspace || username;
        const url = `https://api.bitbucket.org/2.0/repositories/${ws}?pagelen=100&sort=-updated_on`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Bitbucket API error: HTTP ${res.status}`);
        const data = await res.json();
        const values = data.values || [];
        repos = values.map((r: any) => ({
          name: r.slug || r.name,
          url: r.links?.html?.href || `https://bitbucket.org/${ws}/${r.slug}`,
          description: r.description || '',
          language: r.language || undefined,
          visibility: r.is_private ? 'private' : 'public',
          alreadyExists: false,
          selected: true,
        }));
      } else {
        // Bitbucket Server / Data Center
        const base = baseUrl.replace(/\/$/, '');
        const url = projectKey
          ? `${base}/rest/api/1.0/projects/${projectKey}/repos?limit=100`
          : `${base}/rest/api/1.0/repos?limit=100`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Bitbucket Server error: HTTP ${res.status}`);
        const data = await res.json();
        const values = data.values || [];
        repos = values.map((r: any) => {
          const cloneLinks: any[] = r.links?.clone || [];
          const httpClone = cloneLinks.find((l: any) => l.name === 'http')?.href;
          const browseHref = r.links?.self?.[0]?.href || httpClone || `${base}/projects/${r.project?.key}/repos/${r.slug}`;
          return {
            name: r.slug || r.name,
            url: browseHref,
            description: r.description || '',
            language: undefined,
            visibility: r.public ? 'public' : 'private',
            alreadyExists: false,
            selected: true,
          };
        });
      }

      const withExists = repos.map((r) => ({
        ...r,
        alreadyExists: existingUrls.some((u) => u === r.url || u.includes(r.name)),
        selected: !existingUrls.some((u) => u === r.url || u.includes(r.name)),
      }));
      setPreviews(withExists);
      setFetched(true);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch repositories.');
    } finally {
      setLoading(false);
    }
  };

  const doImport = () => {
    const toImport: Repository[] = previews
      .filter((p) => p.selected && !p.alreadyExists)
      .map((p) => ({
        id: generateId(),
        name: p.name,
        provider: mode === 'cloud' ? 'bitbucket' : 'bitbucket',
        url: p.url,
        description: p.description,
        language: p.language,
        visibility: p.visibility,
        projectIds: [],
        createdAt: new Date().toISOString(),
      }));
    onImport(toImport);
  };

  const selectedCount = previews.filter((p) => p.selected && !p.alreadyExists).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl max-h-[92vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Import from Bitbucket</h2>
            <p className="text-xs text-muted mt-0.5">Fetch repositories automatically from your Bitbucket instance</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === 'server' ? 'primary' : 'outline'} onClick={() => setMode('server')}>
              Bitbucket Server / DC
            </Button>
            <Button variant={mode === 'cloud' ? 'primary' : 'outline'} onClick={() => setMode('cloud')}>
              Bitbucket Cloud
            </Button>
          </div>

          {mode === 'server' && (
            <>
              <div className="space-y-1.5">
                <label className="label-xs">Base URL</label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://bitbucket.company.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-xs">Project Key (optional — leave empty for all)</label>
                <Input
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                  placeholder="PROJ"
                />
              </div>
            </>
          )}

          {mode === 'cloud' && (
            <div className="space-y-1.5">
              <label className="label-xs">Workspace</label>
              <Input
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="my-workspace-slug"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="label-xs">{mode === 'cloud' ? 'Username' : 'Username (optional)'}</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">{mode === 'cloud' ? 'App Password' : 'Personal Access Token'}</label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 surface-flat border border-red-300 p-3">{error}</p>
          )}

          <Button className="w-full" onClick={fetchRepos} disabled={loading}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fetching…</>
              : <><GitBranch className="w-4 h-4 mr-2" />Fetch Repositories</>
            }
          </Button>

          {fetched && previews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label-xs">{previews.length} repositories found</p>
                <button
                  onClick={toggleAll}
                  className="text-[9px] font-bold uppercase tracking-[0.12em] text-brand hover:underline"
                >
                  Toggle all
                </button>
              </div>
              <div className="surface-flat border divide-y divide-neutral-200 dark:divide-ink-600 max-h-64 overflow-y-auto">
                {previews.map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 text-xs ${p.alreadyExists ? 'opacity-50' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-ink-700'}`}
                    onClick={p.alreadyExists ? undefined : () =>
                      setPreviews(previews.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))
                    }
                  >
                    <div className={`w-4 h-4 border-2 flex items-center justify-center shrink-0 ${p.selected && !p.alreadyExists ? 'bg-brand border-brand' : 'border-neutral-300 dark:border-ink-500'}`}>
                      {(p.selected && !p.alreadyExists) && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold uppercase tracking-tight truncate">{p.name}</p>
                      <p className="text-muted truncate">{p.description || p.url}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.language && <Badge tone="brand">{p.language}</Badge>}
                      <Badge tone={p.visibility === 'public' ? 'green' : 'muted'}>{p.visibility}</Badge>
                      {p.alreadyExists && <Badge tone="muted">already in DOINg</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fetched && previews.length === 0 && (
            <p className="text-center text-sm text-muted py-6">No repositories found.</p>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between items-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
            {selectedCount > 0 ? `${selectedCount} repo${selectedCount > 1 ? 's' : ''} to import` : 'None selected'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={doImport} disabled={selectedCount === 0}>
              <Download className="w-4 h-4 mr-2" />
              Import {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
