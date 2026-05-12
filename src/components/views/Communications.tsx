import React, { useState } from 'react';
import {
  Mail,
  Sparkles,
  Loader2,
  Copy,
  Check,
  FileDown,
  LayoutTemplate,
  Users as UsersIcon,
  Plus,
  Trash2,
  Download,
  Send,
} from 'lucide-react';
import {
  AppState,
  EmailTemplate,
  MailingList,
  Communication,
  User,
} from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { generateId } from '../../services/storage';
import {
  DEFAULT_PROMPTS,
  fillTemplate,
  runPrompt,
  buildPortfolioSummaryData,
  buildProjectBriefData,
} from '../../services/llmService';
import { exportEML, exportCommunicationPDF } from '../../services/exports';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

type Tab = 'generate' | 'templates' | 'lists' | 'history';

export const Communications: React.FC<Props> = ({ state, currentUser, update }) => {
  const [tab, setTab] = useState<Tab>('generate');
  const canEdit = currentUser.role !== 'viewer';

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <p className="label-xs">Channel</p>
        <h1 className="display-xl">Communications</h1>
        <p className="text-sm text-muted mt-2">
          AI-generated drafts, Outlook-ready emails, and audience management.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-ink-600">
        {(
          [
            { id: 'generate', label: 'Generate', icon: Sparkles },
            { id: 'templates', label: 'Templates', icon: LayoutTemplate },
            { id: 'lists', label: 'Mailing Lists', icon: UsersIcon },
            { id: 'history', label: 'History', icon: Mail },
          ] as { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] -mb-px border-b-2 transition-colors ${
              tab === id
                ? 'text-brand border-brand'
                : 'text-muted border-transparent hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'generate' && <Generator state={state} currentUser={currentUser} update={update} />}
      {tab === 'templates' && <Templates state={state} update={update} canEdit={canEdit} />}
      {tab === 'lists' && <Lists state={state} update={update} canEdit={canEdit} />}
      {tab === 'history' && <History state={state} currentUser={currentUser} />}
    </div>
  );
};

/* === Generator === */

const Generator: React.FC<{
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}> = ({ state, currentUser, update }) => {
  const [type, setType] = useState<'weekly' | 'newsletter' | 'exco'>('weekly');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [extra, setExtra] = useState('');
  const [mailingListId, setMailingListId] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const promptKey =
    type === 'weekly' ? 'weekly_email' : type === 'newsletter' ? 'newsletter' : 'exco_update';

  const generate = async () => {
    setLoading(true);
    setOutput('');
    try {
      const project = state.projects.find((p) => p.id === projectId);
      const dataBlock = project
        ? buildProjectBriefData(project, state.users)
        : buildPortfolioSummaryData(state);
      const author = `${currentUser.firstName} ${currentUser.lastName}`;
      const tpl = state.prompts[promptKey] || DEFAULT_PROMPTS[promptKey];
      const prompt =
        fillTemplate(tpl, {
          DATA: `${dataBlock}\n\nADDITIONAL CONTEXT FROM AUTHOR:\n${extra}`,
          TITLE: title || project?.name || 'Portfolio',
          AUTHOR: author,
        });
      const out = await runPrompt(prompt, state.llmConfig);
      setOutput(out);
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toEml = () => {
    const list = state.mailingLists.find((l) => l.id === mailingListId);
    const subject =
      output.match(/^Subject:\s*(.*)$/m)?.[1].trim() ||
      `[${type.toUpperCase()}] ${title || 'NEXUS.AI update'}`;
    const body = output.replace(/^Subject:.*\n?/m, '').trim();
    exportEML(subject, body, list?.emails || []);
  };

  const saveAsCommunication = () => {
    const c: Communication = {
      id: generateId(),
      title: title || 'Untitled',
      type,
      subject: output.match(/^Subject:\s*(.*)$/m)?.[1].trim() || title,
      content: output,
      mailingListIds: mailingListId ? [mailingListId] : [],
      projectIds: projectId ? [projectId] : [],
      authorId: currentUser.id,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    update((s) => ({ ...s, communications: [c, ...s.communications] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand" />
            <p className="label-xs">AI Generator</p>
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight">Draft your message</h2>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Type">
            <div className="grid grid-cols-3 gap-2">
              {(['weekly', 'newsletter', 'exco'] as const).map((t) => (
                <Button
                  key={t}
                  variant={type === t ? 'primary' : 'outline'}
                  onClick={() => setType(t)}
                  size="sm"
                >
                  {t}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="Focus project (optional)">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Portfolio overview —</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Title / focus">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. November highlights"
            />
          </Field>

          <Field label="Additional context (free text)">
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Anything the AI should know in addition to your project data..."
            />
          </Field>

          <Field label="Mailing list for export">
            <Select
              value={mailingListId}
              onChange={(e) => setMailingListId(e.target.value)}
            >
              <option value="">— pick a list —</option>
              {state.mailingLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.emails.length})
                </option>
              ))}
            </Select>
          </Field>

          <Button size="lg" className="w-full" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>

      <div className="surface border flex flex-col">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Draft</h2>
          {output && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportCommunicationPDF(type, title || 'Communication', output, state)}>
                <FileDown className="w-3 h-3 mr-1" />
                PDF
              </Button>
              <Button size="sm" variant="outline" onClick={toEml}>
                <Download className="w-3 h-3 mr-1" />
                .eml
              </Button>
              <Button size="sm" onClick={saveAsCommunication}>
                <Send className="w-3 h-3 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        <div className="flex-1 p-5">
          {output ? (
            <Textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              className="min-h-[500px] font-mono text-sm leading-relaxed"
            />
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center text-center text-muted">
              <div>
                <Sparkles className="w-10 h-10 mx-auto opacity-30 mb-3" />
                <p className="text-xs uppercase tracking-[0.18em]">Draft preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* === Templates === */

const Templates: React.FC<{
  state: AppState;
  update: (m: (s: AppState) => AppState) => void;
  canEdit: boolean;
}> = ({ state, update, canEdit }) => {
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const upsert = (t: EmailTemplate) =>
    update((s) => ({
      ...s,
      emailTemplates: s.emailTemplates.some((x) => x.id === t.id)
        ? s.emailTemplates.map((x) => (x.id === t.id ? t : x))
        : [...s.emailTemplates, t],
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="space-y-2">
        {canEdit && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              const t: EmailTemplate = {
                id: generateId(),
                name: 'New template',
                type: 'weekly',
                subject: '',
                content: '',
                createdAt: new Date().toISOString(),
              };
              upsert(t);
              setEditing(t);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New template
          </Button>
        )}
        {state.emailTemplates.map((t) => (
          <button
            key={t.id}
            onClick={() => setEditing(t)}
            className={`w-full text-left p-4 border transition-colors ${
              editing?.id === t.id ? 'border-brand bg-brand/5' : 'surface'
            }`}
          >
            <p className="font-bold uppercase tracking-tight text-sm">{t.name}</p>
            <Badge tone="brand" className="mt-2">
              {t.type}
            </Badge>
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        {editing ? (
          <div className="surface border">
            <div className="p-5 border-b border-neutral-200 dark:border-ink-600">
              <h3 className="text-lg font-black uppercase tracking-tight">Edit template</h3>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Name">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({ ...editing, type: e.target.value as EmailTemplate['type'] })
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="exco">Exco</option>
                  <option value="info">Info</option>
                </Select>
              </Field>
              <Field label="Subject">
                <Input
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                />
              </Field>
              <Field label="Content ({{projectName}}, {{authorName}} variables)">
                <Textarea
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                />
              </Field>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between">
              <Button
                variant="danger"
                onClick={() => {
                  update((s) => ({
                    ...s,
                    emailTemplates: s.emailTemplates.filter((x) => x.id !== editing.id),
                  }));
                  setEditing(null);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                onClick={() => {
                  upsert(editing);
                  setEditing(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-12 text-center text-muted">
            Select or create a template.
          </div>
        )}
      </div>
    </div>
  );
};

/* === Mailing lists === */

const Lists: React.FC<{
  state: AppState;
  update: (m: (s: AppState) => AppState) => void;
  canEdit: boolean;
}> = ({ state, update, canEdit }) => {
  const [editing, setEditing] = useState<MailingList | null>(null);
  const [newEmail, setNewEmail] = useState('');

  const upsert = (l: MailingList) =>
    update((s) => ({
      ...s,
      mailingLists: s.mailingLists.some((x) => x.id === l.id)
        ? s.mailingLists.map((x) => (x.id === l.id ? l : x))
        : [...s.mailingLists, l],
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="space-y-2">
        {canEdit && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const l: MailingList = {
                id: generateId(),
                name: 'New list',
                emails: [],
                createdAt: new Date().toISOString(),
              };
              upsert(l);
              setEditing(l);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New list
          </Button>
        )}
        {state.mailingLists.map((l) => (
          <button
            key={l.id}
            onClick={() => setEditing(l)}
            className={`w-full text-left p-4 border transition-colors ${
              editing?.id === l.id ? 'border-brand bg-brand/5' : 'surface'
            }`}
          >
            <p className="font-bold uppercase tracking-tight text-sm">{l.name}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted mt-1">
              {l.emails.length} contacts
            </p>
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        {editing ? (
          <div className="surface border">
            <div className="p-5 border-b border-neutral-200 dark:border-ink-600">
              <h3 className="text-lg font-black uppercase tracking-tight">Edit list</h3>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Name">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Input
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <div>
                <p className="label-xs mb-2">Members ({editing.emails.length})</p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto surface-flat border p-2">
                  {editing.emails.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs font-mono px-2 py-1 surface border"
                    >
                      <span>{e}</span>
                      <button
                        onClick={() =>
                          setEditing({ ...editing, emails: editing.emails.filter((_, j) => j !== i) })
                        }
                        className="text-muted hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {editing.emails.length === 0 && (
                    <p className="text-xs text-muted italic text-center py-4">No members.</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newEmail) {
                        setEditing({ ...editing, emails: [...editing.emails, newEmail] });
                        setNewEmail('');
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (newEmail) {
                        setEditing({ ...editing, emails: [...editing.emails, newEmail] });
                        setNewEmail('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-between">
              <Button
                variant="danger"
                onClick={() => {
                  update((s) => ({
                    ...s,
                    mailingLists: s.mailingLists.filter((x) => x.id !== editing.id),
                  }));
                  setEditing(null);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                onClick={() => {
                  upsert(editing);
                  setEditing(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-12 text-center text-muted">
            Select or create a mailing list.
          </div>
        )}
      </div>
    </div>
  );
};

/* === History === */

const History: React.FC<{ state: AppState; currentUser: User }> = ({ state, currentUser }) => {
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager';
  const visible = isPrivileged
    ? state.communications
    : state.communications.filter((c) => c.authorId === currentUser.id);

  return (
    <div className="space-y-2">
      {visible.length === 0 && (
        <p className="text-center text-sm text-muted py-12">No saved drafts yet.</p>
      )}
      {visible.map((c) => {
        const author = state.users.find((u) => u.id === c.authorId);
        return (
          <div key={c.id} className="surface border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold uppercase tracking-tight text-sm">{c.title}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted mt-0.5">
                  {new Date(c.createdAt).toLocaleString()} • {c.type}
                  {author && isPrivileged && ` • ${author.firstName} ${author.lastName}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={c.status === 'sent' ? 'green' : 'muted'}>{c.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCommunicationPDF(
                      c.type as 'weekly' | 'newsletter' | 'exco',
                      c.title || c.subject || 'Communication',
                      c.content,
                      state
                    )
                  }
                >
                  <FileDown className="w-3 h-3 mr-1" />
                  PDF
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="label-xs">{label}</label>
    {children}
  </div>
);
