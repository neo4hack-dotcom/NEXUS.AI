import React, { useState } from 'react';
import { GitBranch, ExternalLink, Plus, Trash2, X, Search } from 'lucide-react';
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
  const canEdit = currentUser.role !== 'viewer';

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
