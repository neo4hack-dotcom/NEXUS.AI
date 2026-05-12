import React, { useState } from 'react';
import { Search, Plus, Code, Database, Box, Wrench, FileCode, Cloud, Trash2, X, ExternalLink } from 'lucide-react';
import { AppState, Technology, TechLayer, TechMaturity, User } from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { generateId } from '../../services/storage';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const ICONS: Record<Technology['category'], React.ComponentType<{ className?: string }>> = {
  framework: Code,
  library: Box,
  database: Database,
  tool: Wrench,
  language: FileCode,
  service: Cloud,
};

const MATURITY_TONE: Record<TechMaturity, 'green' | 'amber' | 'red' | 'muted'> = {
  adopted: 'green',
  evaluating: 'amber',
  hold: 'amber',
  deprecated: 'red',
};

const newTech = (): Technology => ({
  id: generateId(),
  name: 'New technology',
  category: 'framework',
  description: '',
  tags: [],
  createdAt: new Date().toISOString(),
});

export const Technologies: React.FC<Props> = ({ state, currentUser, update }) => {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Technology | null>(null);
  const canEdit = currentUser.role !== 'viewer';

  const filtered = state.technologies.filter((t) => {
    const lq = q.toLowerCase();
    return (
      t.name.toLowerCase().includes(lq) ||
      t.description.toLowerCase().includes(lq) ||
      (t.layer || '').toLowerCase().includes(lq) ||
      (t.maturityStatus || '').toLowerCase().includes(lq) ||
      (t.license || '').toLowerCase().includes(lq) ||
      (t.internalOwner || '').toLowerCase().includes(lq) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lq))
    );
  });

  const upsert = (t: Technology) =>
    update((s) => ({
      ...s,
      technologies: s.technologies.some((x) => x.id === t.id)
        ? s.technologies.map((x) => (x.id === t.id ? t : x))
        : [...s.technologies, t],
    }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">Stack</p>
          <h1 className="display-xl">Technologies</h1>
          <p className="text-sm text-muted mt-2">
            Catalog of frameworks, libraries, languages and services in use.
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
                const t = newTech();
                upsert(t);
                setEdit(t);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((t) => {
          const Icon = ICONS[t.category];
          return (
            <button
              key={t.id}
              onClick={() => canEdit && setEdit(t)}
              className="surface border p-5 text-left hover:border-brand transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 surface-flat border">
                  <Icon className="w-5 h-5 text-brand" />
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <Badge tone="muted">{t.category}</Badge>
                  {t.layer && <Badge tone="muted">{t.layer}</Badge>}
                  {t.maturityStatus && (
                    <Badge tone={MATURITY_TONE[t.maturityStatus]}>{t.maturityStatus}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-black uppercase tracking-tight text-lg">{t.name}</h3>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted hover:text-brand"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {t.version && (
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-brand mt-1">
                  v{t.version}
                </p>
              )}
              {t.license && (
                <p className="text-[10px] font-mono text-muted mt-0.5">{t.license}</p>
              )}
              <p className="text-xs text-muted mt-2 line-clamp-3">{t.description}</p>
              {t.internalOwner && (
                <p className="text-[10px] text-muted mt-2">
                  Owner: <span className="text-neutral-700 dark:text-neutral-300">{t.internalOwner}</span>
                </p>
              )}
              {t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {t.tags.map((tag) => (
                    <Badge key={tag} tone="muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="lg:col-span-3 text-center text-sm text-muted py-12">No technologies found.</p>
        )}
      </div>

      {edit && (
        <Editor
          t={edit}
          onClose={() => setEdit(null)}
          onSave={(t) => {
            upsert(t);
            setEdit(null);
          }}
          onDelete={() => {
            update((s) => ({ ...s, technologies: s.technologies.filter((x) => x.id !== edit.id) }));
            setEdit(null);
          }}
        />
      )}
    </div>
  );
};

const Editor: React.FC<{
  t: Technology;
  onClose: () => void;
  onSave: (t: Technology) => void;
  onDelete: () => void;
}> = ({ t, onClose, onSave, onDelete }) => {
  const [d, setD] = useState<Technology>(t);
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-xl animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Technology</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="label-xs">Name</label>
              <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Category</label>
              <Select
                value={d.category}
                onChange={(e) =>
                  setD({ ...d, category: e.target.value as Technology['category'] })
                }
              >
                <option value="framework">Framework</option>
                <option value="library">Library</option>
                <option value="database">Database</option>
                <option value="tool">Tool</option>
                <option value="language">Language</option>
                <option value="service">Service</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Layer</label>
              <Select
                value={d.layer || ''}
                onChange={(e) =>
                  setD({ ...d, layer: (e.target.value as TechLayer) || undefined })
                }
              >
                <option value="">— not set —</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="fullstack">Full-stack</option>
                <option value="data">Data</option>
                <option value="ml-ai">ML / AI</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="devops">DevOps / CI-CD</option>
                <option value="mobile">Mobile</option>
                <option value="security">Security</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Maturity status</label>
              <Select
                value={d.maturityStatus || ''}
                onChange={(e) =>
                  setD({ ...d, maturityStatus: (e.target.value as TechMaturity) || undefined })
                }
              >
                <option value="">— not set —</option>
                <option value="evaluating">Evaluating</option>
                <option value="adopted">Adopted</option>
                <option value="hold">Hold</option>
                <option value="deprecated">Deprecated</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Version</label>
              <Input value={d.version || ''} onChange={(e) => setD({ ...d, version: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">License</label>
              <Input
                value={d.license || ''}
                onChange={(e) => setD({ ...d, license: e.target.value })}
                placeholder="MIT, Apache 2.0, Proprietary…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">URL / docs</label>
              <Input value={d.url || ''} onChange={(e) => setD({ ...d, url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-xs">Internal owner / team</label>
              <Input
                value={d.internalOwner || ''}
                onChange={(e) => setD({ ...d, internalOwner: e.target.value })}
                placeholder="Platform team, John Doe…"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="label-xs">Description</label>
              <Textarea
                value={d.description}
                onChange={(e) => setD({ ...d, description: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="label-xs">Tags (comma-separated)</label>
              <Input
                value={d.tags.join(', ')}
                onChange={(e) =>
                  setD({
                    ...d,
                    tags: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
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
