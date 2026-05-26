import React, { useState } from 'react';
import {
  Cpu,
  Key,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  RotateCcw,
  Database,
  Download,
  Upload,
  AlertTriangle,
  Folders,
  Plus,
  Pencil,
  X,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  MonitorDot,
  CloudDownload,
  Calendar as CalendarIcon,
  PlayCircle,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  FileText,
} from 'lucide-react';
import { AppState, LlmConfig, ProjectFamily, User, SharePointConfig, SharePointFieldMapping, SharePointAuthMethod, SharePointScheduleRecurrence } from '../../types';
import { runSync, computeNextSyncAt, DEFAULT_SP_IMPORT_PROMPT } from '../../services/sharepointService';
import { generateId } from '../../services/storage';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { testConnection, DEFAULT_PROMPTS } from '../../services/llmService';
import { clearState, exportBackup, importBackup } from '../../services/storage';
import { hashPassword, generateTempPassword } from '../../services/crypto';

interface Props {
  state: AppState;
  update: (m: (s: AppState) => AppState) => void;
}

// Passed to DataSection so it can trigger a full state replacement
interface DataProps {
  state: AppState;
  replaceState: (s: AppState) => void;
}

type Tab = 'llm' | 'prompts' | 'security' | 'data' | 'families' | 'sharepoint';

export const Settings: React.FC<Props> = ({ state, update }) => {
  const [tab, setTab] = useState<Tab>('llm');

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <p className="label-xs">Admin only</p>
        <h1 className="display-xl">Settings</h1>
        <p className="text-sm text-muted mt-2">
          Configure the local LLM, manage prompts, secure access and storage.
        </p>
      </div>

      <div className="border border-brand/30 bg-brand/5 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-brand mt-0.5" />
        <div>
          <p className="text-sm font-bold uppercase tracking-tight">Admin view</p>
          <p className="text-xs text-muted mt-1">
            Changes here affect the entire DOINg.AI instance and all users.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-ink-600">
        {(
          [
            { id: 'llm', label: 'Local LLM', icon: Cpu },
            { id: 'prompts', label: 'AI Prompts', icon: Sparkles },
            { id: 'families', label: 'Project Families', icon: Folders },
            { id: 'security', label: 'Security', icon: Key },
            { id: 'sharepoint', label: 'SharePoint Import', icon: CloudDownload },
            { id: 'data', label: 'Data', icon: Database },
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

      {tab === 'llm' && <LlmSection state={state} update={update} />}
      {tab === 'prompts' && <PromptsSection state={state} update={update} />}
      {tab === 'families' && <FamiliesSection state={state} update={update} />}
      {tab === 'security' && <SecuritySection state={state} update={update} />}
      {tab === 'sharepoint' && <SharePointSection state={state} update={update} />}
      {tab === 'data' && (
        <DataSection
          state={state}
          replaceState={(next) => update(() => next)}
        />
      )}
    </div>
  );
};

/* === LLM Section === */

const LlmSection: React.FC<Props> = ({ state, update }) => {
  const [cfg, setCfg] = useState<LlmConfig>(state.llmConfig);
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    msg: string;
    models?: string[];
  }>({ status: 'idle', msg: '' });

  const save = () => {
    update((s) => ({ ...s, llmConfig: cfg }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const runTest = async () => {
    setTest({ status: 'testing', msg: 'Testing…' });
    const result = await testConnection(cfg);
    setTest({
      status: result.ok ? 'success' : 'error',
      msg: result.message,
      models: result.models,
    });
  };

  return (
    <div className="surface border">
      <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
        <Cpu className="w-5 h-5 text-brand" />
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">Local LLM</h3>
          <p className="text-xs text-muted mt-1">
            Configure your local model. All AI calls stay on your network.
          </p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label-xs">Provider</label>
          <Select
            value={cfg.provider}
            onChange={(e) => setCfg({ ...cfg, provider: e.target.value as LlmConfig['provider'] })}
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai_compatible">OpenAI-compatible (LM Studio, LocalAI, vLLM…)</option>
            <option value="n8n">n8n webhook</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="label-xs">Model</label>
          <Input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="label-xs">Base URL</label>
          <Input value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="label-xs">API key (optional)</label>
          <Input
            type="password"
            value={cfg.apiKey || ''}
            onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="label-xs">System prompt</label>
          <Textarea
            value={cfg.systemPrompt}
            onChange={(e) => setCfg({ ...cfg, systemPrompt: e.target.value })}
            className="min-h-[100px]"
          />
        </div>

        <div className="md:col-span-2 surface-flat border p-4 space-y-3">
          <p className="label-xs">Connection test</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={runTest} disabled={test.status === 'testing'}>
              <RefreshCw className={`w-3 h-3 mr-2 ${test.status === 'testing' ? 'animate-spin' : ''}`} />
              Test
            </Button>
            {test.status === 'success' && (
              <p className="text-emerald-500 text-xs flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {test.msg}
              </p>
            )}
            {test.status === 'error' && (
              <p className="text-red-500 text-xs flex items-center">
                <XCircle className="w-3 h-3 mr-1" />
                {test.msg}
              </p>
            )}
          </div>
          {test.models && test.models.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {test.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setCfg({ ...cfg, model: m })}
                  className="text-[10px] font-mono px-2 py-1 border border-neutral-300 dark:border-ink-500 hover:border-brand hover:text-brand"
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end">
        <Button onClick={save}>
          <Save className="w-4 h-4 mr-2" />
          {saved ? 'Saved!' : 'Save configuration'}
        </Button>
      </div>
    </div>
  );
};

/* === Prompts === */

const PromptsSection: React.FC<Props> = ({ state, update }) => {
  const keys = Object.keys(DEFAULT_PROMPTS);
  const [selected, setSelected] = useState(keys[0]);
  const value = state.prompts[selected] ?? DEFAULT_PROMPTS[selected];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="space-y-1">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => setSelected(k)}
            className={`w-full text-left p-3 border text-xs font-bold uppercase tracking-tight transition-colors ${
              selected === k ? 'border-brand bg-brand/5 text-brand' : 'surface hover:border-brand'
            }`}
          >
            {k.replace(/_/g, ' ')}
            {state.prompts[k] && <Badge tone="brand" className="ml-2">custom</Badge>}
          </button>
        ))}
      </div>
      <div className="lg:col-span-3 surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <div>
            <p className="label-xs">Prompt</p>
            <h3 className="text-lg font-black uppercase tracking-tight">
              {selected.replace(/_/g, ' ')}
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update((s) => ({
                  ...s,
                  prompts: Object.fromEntries(
                    Object.entries(s.prompts).filter(([k]) => k !== selected)
                  ),
                }))
              }
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>
        <div className="p-5">
          <Textarea
            value={value}
            onChange={(e) =>
              update((s) => ({
                ...s,
                prompts: { ...s.prompts, [selected]: e.target.value },
              }))
            }
            className="min-h-[400px] font-mono text-xs leading-relaxed"
          />
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted mt-2">
            Variables: <span className="text-brand">{`{{DATA}} {{TITLE}} {{AUTHOR}}`}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

/* === Security === */

/**
 * Security section — manages credentials for ALL users.
 *
 *  1. "Force password reset" per user: admin sets a temporary password and the
 *     `mustChangePassword` flag. The user uses the temp password to sign in,
 *     then is required to pick a new one before reaching the app.
 *
 *  2. The temporary password is shown ONCE in a confirmation dialog so the
 *     admin can transmit it out of band (Slack, email, in person).
 *
 *  Passwords are hashed with PBKDF2-SHA256 (200k iterations) — see
 *  src/services/crypto.ts. The legacy plaintext field on User is cleared
 *  whenever a hash is set.
 */
const SecuritySection: React.FC<Props> = ({ state, update }) => {
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [filter, setFilter] = useState('');

  const users = state.users
    .filter((u) => {
      const q = filter.toLowerCase();
      if (!q) return true;
      return (
        u.uid.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.team.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.uid.localeCompare(b.uid));

  return (
    <div className="space-y-4">
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-brand" />
          <div className="flex-1">
            <h3 className="text-lg font-black uppercase tracking-tight">User credentials</h3>
            <p className="text-xs text-muted mt-1">
              Force any user to change their password at next sign-in. Only admins can do this.
              Passwords are stored as PBKDF2-SHA256 hashes (200 000 iterations).
            </p>
          </div>
        </div>

        <div className="p-4 border-b border-neutral-200 dark:border-ink-600">
          <Input
            placeholder="Filter by uid, name, email or team…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-ink-700">
          {users.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">No users match the filter.</p>
          )}
          {users.map((u) => {
            const hashed = !!u.passwordHash;
            const forced = !!u.mustChangePassword;
            return (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-bold truncate">{u.firstName} {u.lastName}</p>
                    <Badge>{u.role}</Badge>
                    {forced && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Reset pending
                      </span>
                    )}
                    {u.isIT && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        IT
                      </span>
                    )}
                    {!hashed && !forced && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] bg-neutral-100 text-neutral-600 dark:bg-ink-700 dark:text-neutral-300" title="Still using legacy plaintext password — will be migrated on next sign-in">
                        Legacy
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted truncate font-mono">{u.uid} · {u.email}</p>
                </div>
                <button
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      users: s.users.map((usr) =>
                        usr.id === u.id ? { ...usr, isIT: !usr.isIT } : usr
                      ),
                    }))
                  }
                  title={u.isIT ? 'Revoke IT access' : 'Grant IT access (Data Feeds)'}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                    u.isIT
                      ? 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 hover:bg-sky-100'
                      : 'border-neutral-300 dark:border-ink-500 text-neutral-500 hover:border-sky-400 hover:text-sky-600'
                  }`}
                >
                  <MonitorDot className="w-3 h-3" />
                  IT
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetTarget(u)}
                  title="Set a temporary password and force the user to change it at next login"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                  Force reset
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {resetTarget && (
        <ForceResetDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onConfirm={async (tempPlain) => {
            const { hash, salt } = await hashPassword(tempPlain);
            update((s) => ({
              ...s,
              users: s.users.map((u) =>
                u.id === resetTarget.id
                  ? { ...u, passwordHash: hash, passwordSalt: salt, password: undefined, mustChangePassword: true }
                  : u
              ),
            }));
          }}
        />
      )}
    </div>
  );
};

const ForceResetDialog: React.FC<{
  target: User;
  onClose: () => void;
  onConfirm: (tempPassword: string) => Promise<void>;
}> = ({ target, onClose, onConfirm }) => {
  // Pre-generate a temp password the admin can edit. Re-roll on demand.
  const [tempPw, setTempPw] = useState(() => generateTempPassword(12));
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose, submitting]);

  const copy = () => {
    navigator.clipboard?.writeText(tempPw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(tempPw);
      setDone(true);
    } catch (e) {
      console.error('[Settings] reset error', e);
      alert('Could not reset password. See console.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-md flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-brand" /> Force password reset
          </h2>
          <button onClick={onClose} disabled={submitting} className="w-9 h-9 flex items-center justify-center hover:text-brand disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm">
            Reset the password for <span className="font-mono font-bold text-brand">{target.uid}</span>
            {' '}({target.firstName} {target.lastName})?
          </p>
          <p className="text-xs text-muted">
            A temporary password is generated below. The user will be required to choose a new one
            at next sign-in. Share this temporary password with them out of band — it is shown only once.
          </p>

          <div className="space-y-1.5">
            <label className="label-xs">Temporary password</label>
            <div className="flex gap-2">
              <Input
                value={tempPw}
                onChange={(e) => setTempPw(e.target.value)}
                disabled={submitting || done}
                className="font-mono"
              />
              <Button
                variant="outline"
                size="md"
                onClick={() => setTempPw(generateTempPassword(12))}
                disabled={submitting || done}
                title="Re-roll"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="md" onClick={copy} disabled={!tempPw}>
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {done && (
            <div className="border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
              <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Reset applied.</p>
              <p className="mt-1 text-muted">
                Make sure you copied the temporary password — it cannot be retrieved later.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2">
          {done ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={confirm} disabled={submitting || tempPw.length < 6}>
                {submitting ? 'Applying…' : 'Apply reset'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* === Data === */

const DataSection: React.FC<DataProps> = ({ state, replaceState }) => {
  const [importStep, setImportStep] = useState<'idle' | 'confirm'>('idle');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const doImport = () => {
    if (!importFile) return;
    importBackup(
      importFile,
      (next) => {
        replaceState(next);
        setImportStep('idle');
        setImportFile(null);
      },
      (msg) => {
        setImportError(msg);
        setImportStep('idle');
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Backup export */}
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <Download className="w-5 h-5 text-brand" />
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Export backup</h3>
            <p className="text-xs text-muted mt-1">
              Download the entire DOINg.AI dataset as a timestamped JSON file.
            </p>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted mb-4">
            The backup includes all projects, users, technologies, repositories, check-ins,
            communications, and settings. It does not include your session token or theme preference.
          </p>
          <Button onClick={() => exportBackup(state)}>
            <Download className="w-4 h-4 mr-2" />
            Download backup (.json)
          </Button>
        </div>
      </div>

      {/* Backup restore */}
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <Upload className="w-5 h-5 text-brand" />
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Restore backup</h3>
            <p className="text-xs text-muted mt-1">
              Replace all current data with a previously exported backup file.
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {importStep === 'idle' && (
            <>
              <div className="border-2 border-dashed border-neutral-300 dark:border-ink-500 p-6 text-center">
                <p className="text-xs text-muted mb-3">
                  {importFile ? (
                    <span className="text-brand font-bold">{importFile.name}</span>
                  ) : (
                    'Select a doing-ai-backup-*.json file'
                  )}
                </p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-2" />
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setImportFile(f);
                    setImportError('');
                    e.target.value = '';
                  }}
                />
              </div>
              {importError && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {importError}
                </p>
              )}
              {importFile && (
                <Button
                  variant="danger"
                  onClick={() => setImportStep('confirm')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Restore this backup…
                </Button>
              )}
            </>
          )}

          {importStep === 'confirm' && (
            <div className="border border-red-500/40 bg-red-500/5 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-500 uppercase tracking-tight">
                    All current data will be permanently replaced
                  </p>
                  <p className="text-xs text-muted mt-1">
                    This will purge every project, user, technology, check-in and communication
                    currently in DOINg.AI and replace them with the content of{' '}
                    <span className="font-mono text-brand">{importFile?.name}</span>.{' '}
                    There is no undo.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="danger" onClick={doImport}>
                  Yes, wipe and restore
                </Button>
                <Button variant="outline" onClick={() => setImportStep('idle')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cache management */}
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <Database className="w-5 h-5 text-brand" />
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Local cache</h3>
            <p className="text-xs text-muted mt-1">
              Storage stack: localStorage (instant) + db.json via /api/data (canonical).
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">
            Wipes only the browser cache (key <span className="font-mono">nexus_ai_data_v1</span>).
            Server data in <span className="font-mono text-brand">db.json</span> is preserved and
            reloaded on next boot.
          </p>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('Wipe local cache? Server data is preserved.')) clearState();
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Wipe local cache & reload
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ── Project Families ─────────────────────────────────────────────────────── */

const PALETTE = [
  '#FF3E00', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#EC4899',
];

const blankFamily = (): ProjectFamily => ({
  id: generateId(),
  name: '',
  description: '',
  color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  createdAt: new Date().toISOString(),
});

const FamiliesSection: React.FC<{ state: AppState; update: (m: (s: AppState) => AppState) => void }> = ({
  state,
  update,
}) => {
  const families = state.projectFamilies ?? [];
  const [editing, setEditing] = useState<ProjectFamily | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => { setEditing(blankFamily()); setIsNew(true); };
  const openEdit = (f: ProjectFamily) => { setEditing({ ...f }); setIsNew(false); };

  const save = () => {
    if (!editing || !editing.name.trim()) return;
    update((s) => ({
      ...s,
      projectFamilies: isNew
        ? [...(s.projectFamilies ?? []), editing]
        : (s.projectFamilies ?? []).map((f) => (f.id === editing.id ? editing : f)),
    }));
    setEditing(null);
  };

  const remove = (id: string) => {
    if (!window.confirm('Delete this family? Projects assigned to it will become ungrouped.')) return;
    update((s) => ({
      ...s,
      projectFamilies: (s.projectFamilies ?? []).filter((f) => f.id !== id),
      projects: s.projects.map((p) => (p.familyId === id ? { ...p, familyId: undefined } : p)),
    }));
  };

  const projectCount = (id: string) =>
    state.projects.filter((p) => p.familyId === id && !p.isArchived).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-xs">Classification</p>
          <h2 className="text-lg font-black uppercase tracking-tight">Project Families</h2>
          <p className="text-xs text-muted mt-1">
            Group projects into families for portfolio-level tracking.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          New family
        </Button>
      </div>

      {families.length === 0 && (
        <div className="border border-dashed border-neutral-300 dark:border-ink-500 p-12 text-center text-muted">
          <Folders className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No families yet. Create one to group your projects.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {families.map((f) => {
          const count = projectCount(f.id);
          return (
            <div key={f.id} className="surface border p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-4 h-10 shrink-0" style={{ backgroundColor: f.color || '#FF3E00' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold uppercase tracking-tight truncate">{f.name}</p>
                  {f.description && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{f.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(f)} className="w-7 h-7 flex items-center justify-center text-muted hover:text-brand transition-colors" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(f.id)} className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
                {count} active project{count !== 1 ? 's' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface border w-full max-w-md animate-slide-up">
            <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-tight text-base">
                {isNew ? 'New family' : 'Edit family'}
              </h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center text-muted hover:text-brand">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="label-xs">Name *</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. AI Efficiency, Customer Experience…"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-xs">Description</label>
                <Input
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Short description of this family's scope"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-xs">Colour</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditing({ ...editing, color: c })}
                      className={`w-7 h-7 transition-transform hover:scale-110 ${editing.color === c ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white' : ''}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={editing.color ?? '#FF3E00'}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                    className="w-7 h-7 cursor-pointer border border-neutral-300 dark:border-ink-500 bg-transparent"
                    title="Custom colour"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} disabled={!editing.name.trim()}>
                <Save className="w-4 h-4 mr-2" />
                {isNew ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────
   SharePoint Import
   ────────────────────────────────────────────────────────────────────────
   Admin-only section. Three sub-cards:
     1. Connection — URL / list / auth / scope / TLS
     2. Field mapping — SharePoint column → Project field
     3. Scheduling + LLM prompt + last-sync telemetry + manual "Run now" button
*/
const SharePointSection: React.FC<Props> = ({ state, update }) => {
  const cfg = state.sharePointConfig;
  const [draft, setDraft] = useState<SharePointConfig>(cfg);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    state: 'idle' | 'running' | 'success' | 'error';
    message: string;
    fetched?: number;
    added?: number;
  }>({ state: 'idle', message: '' });
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);

  // Keep draft in sync if the underlying state changes (e.g. another tab pushed an update)
  React.useEffect(() => { setDraft(cfg); }, [cfg]);

  const persistCfg = (next: SharePointConfig) => {
    update((s) => ({ ...s, sharePointConfig: next }));
  };

  const save = () => {
    const withNext = { ...draft, nextSyncAt: computeNextSyncAt(draft) };
    persistCfg(withNext);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const setField = <K extends keyof SharePointConfig>(k: K, v: SharePointConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setMapping = <K extends keyof SharePointFieldMapping>(k: K, v: SharePointFieldMapping[K]) =>
    setDraft((d) => ({ ...d, fieldMapping: { ...d.fieldMapping, [k]: v } }));

  const runManualSync = async () => {
    setSyncStatus({ state: 'running', message: 'Starting sync…' });
    try {
      // Persist any in-memory edits first so the sync uses the latest config.
      const cfgToUse = { ...draft };
      persistCfg(cfgToUse);
      // Slight pause so update() flushes
      await new Promise((r) => setTimeout(r, 50));

      const result = await runSync(
        { ...state, sharePointConfig: cfgToUse },
        state.llmConfig,
        (m) => setSyncStatus((s) => ({ ...s, message: m })),
      );

      const newCfg: SharePointConfig = {
        ...cfgToUse,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
        lastSyncFetchedCount: result.fetched,
        lastSyncNewCount: result.added,
        lastSyncMessage: result.errors.length > 0
          ? `${result.added}/${result.fetched} added with ${result.errors.length} error(s)`
          : `${result.added} new project(s) added to pending bucket`,
        nextSyncAt: computeNextSyncAt(cfgToUse),
      };
      update((s) => ({
        ...s,
        sharePointConfig: newCfg,
        pendingProjects: [...(s.pendingProjects ?? []), ...result.newPending],
      }));
      setDraft(newCfg);
      setSyncStatus({
        state: 'success',
        message: newCfg.lastSyncMessage!,
        fetched: result.fetched,
        added: result.added,
      });
    } catch (e: any) {
      const newCfg: SharePointConfig = {
        ...draft,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'error',
        lastSyncMessage: e.message,
      };
      persistCfg(newCfg);
      setSyncStatus({ state: 'error', message: e.message });
    }
  };

  const inputCls =
    'w-full h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors disabled:opacity-60';

  return (
    <div className="space-y-4">

      {/* Connection */}
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <CloudDownload className="w-5 h-5 text-brand" />
          <div className="flex-1">
            <h3 className="text-lg font-black uppercase tracking-tight">SharePoint Connection</h3>
            <p className="text-xs text-muted mt-1">
              On-premise SharePoint REST API endpoint. The backend (<span className="font-mono">/api/sharepoint/fetch</span>) handles the call so NTLM auth and self-signed certs work properly.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setField('enabled', e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
              {draft.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="label-xs">Site URL *</label>
            <Input
              value={draft.siteUrl}
              onChange={(e) => setField('siteUrl', e.target.value)}
              placeholder="https://sharepoint.acme.local/sites/projects"
              disabled={!draft.enabled}
            />
            <p className="text-[9px] font-mono text-muted">
              Don't include /_api — we append it automatically.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="label-xs">List / library name *</label>
            <Input
              value={draft.listName}
              onChange={(e) => setField('listName', e.target.value)}
              placeholder="Projects"
              disabled={!draft.enabled}
            />
          </div>

          <div className="space-y-1.5">
            <label className="label-xs">Auth method</label>
            <Select
              value={draft.authMethod}
              onChange={(e) => setField('authMethod', e.target.value as SharePointAuthMethod)}
              disabled={!draft.enabled}
            >
              <option value="basic">Basic (username + password)</option>
              <option value="ntlm">NTLM (domain\\user + password)</option>
              <option value="bearer">Bearer token</option>
            </Select>
          </div>

          {draft.authMethod === 'ntlm' && (
            <div className="space-y-1.5">
              <label className="label-xs">Windows domain</label>
              <Input
                value={draft.domain ?? ''}
                onChange={(e) => setField('domain', e.target.value)}
                placeholder="ACME"
                disabled={!draft.enabled}
              />
            </div>
          )}

          {(draft.authMethod === 'basic' || draft.authMethod === 'ntlm') && (
            <>
              <div className="space-y-1.5">
                <label className="label-xs">Username</label>
                <Input
                  value={draft.username ?? ''}
                  onChange={(e) => setField('username', e.target.value)}
                  disabled={!draft.enabled}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-xs">Password</label>
                <Input
                  type="password"
                  value={draft.password ?? ''}
                  onChange={(e) => setField('password', e.target.value)}
                  disabled={!draft.enabled}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {draft.authMethod === 'bearer' && (
            <div className="md:col-span-2 space-y-1.5">
              <label className="label-xs">Bearer token</label>
              <Input
                type="password"
                value={draft.bearerToken ?? ''}
                onChange={(e) => setField('bearerToken', e.target.value)}
                disabled={!draft.enabled}
                autoComplete="new-password"
              />
            </div>
          )}

          <div className="md:col-span-2 space-y-1.5">
            <label className="label-xs">Scope filter (OData $filter, optional)</label>
            <Input
              value={draft.scopeFilter ?? ''}
              onChange={(e) => setField('scopeFilter', e.target.value)}
              placeholder="Status eq 'Active'"
              disabled={!draft.enabled}
            />
          </div>

          <div className="space-y-1.5">
            <label className="label-xs">Max items per fetch</label>
            <Input
              type="number"
              min={1}
              max={5000}
              value={draft.maxItemsPerFetch ?? 200}
              onChange={(e) => setField('maxItemsPerFetch', Number(e.target.value) || 200)}
              disabled={!draft.enabled}
            />
          </div>

          <div className="space-y-1.5 flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.disableSslVerification ?? false}
                onChange={(e) => setField('disableSslVerification', e.target.checked)}
                disabled={!draft.enabled}
                className="w-4 h-4 accent-brand"
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                Skip TLS verification (self-signed certs)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Field mapping */}
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <LinkIcon className="w-5 h-5 text-brand" />
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Field Mapping</h3>
            <p className="text-xs text-muted mt-1">
              Hint the LLM about which SharePoint columns feed which Project fields. The LLM still uses its own judgement, but mappings improve accuracy.
            </p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ['name',        'Project name (required)', 'Title'],
            ['description', 'Description',              'Description'],
            ['context',     'Context / notes',          'Notes'],
            ['startDate',   'Start date',               'StartDate'],
            ['deadline',    'Deadline',                 'DueDate'],
            ['manager',     'Project manager (email/uid)', 'Owner'],
            ['status',      'Status',                   'Status'],
            ['tags',        'Tags (comma/semicolon separated)', 'Tags'],
            ['family',      'Project family',           'Category'],
          ] as [keyof SharePointFieldMapping, string, string][]).map(([key, label, placeholder]) => (
            <div key={key} className="space-y-1.5">
              <label className="label-xs">{label}</label>
              <Input
                value={draft.fieldMapping[key] ?? ''}
                onChange={(e) => setMapping(key, e.target.value)}
                placeholder={placeholder}
                disabled={!draft.enabled}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scheduling + LLM prompt */}
      <div className="surface border">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-brand" />
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Scheduling & LLM prompt</h3>
            <p className="text-xs text-muted mt-1">
              When set to a recurrence, the sync runs automatically on an admin's open browser session. Each run only pulls items that aren't already pending or imported (delta).
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="label-xs">Recurrence</label>
              <Select
                value={draft.scheduleRecurrence}
                onChange={(e) => setField('scheduleRecurrence', e.target.value as SharePointScheduleRecurrence)}
                disabled={!draft.enabled}
              >
                <option value="off">Off</option>
                <option value="manual">Manual only</option>
                <option value="hourly">Every hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </Select>
            </div>
            {(draft.scheduleRecurrence === 'daily' || draft.scheduleRecurrence === 'weekly') && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="label-xs">Hour</label>
                  <Input type="number" min={0} max={23} value={draft.scheduleHour ?? 6} onChange={(e) => setField('scheduleHour', Number(e.target.value))} disabled={!draft.enabled} />
                </div>
                <div className="space-y-1.5">
                  <label className="label-xs">Minute</label>
                  <Input type="number" min={0} max={59} value={draft.scheduleMinute ?? 0} onChange={(e) => setField('scheduleMinute', Number(e.target.value))} disabled={!draft.enabled} />
                </div>
              </div>
            )}
            {draft.scheduleRecurrence === 'hourly' && (
              <div className="space-y-1.5">
                <label className="label-xs">Minute of the hour</label>
                <Input type="number" min={0} max={59} value={draft.scheduleMinute ?? 0} onChange={(e) => setField('scheduleMinute', Number(e.target.value))} disabled={!draft.enabled} />
              </div>
            )}
            {draft.scheduleRecurrence === 'weekly' && (
              <div className="space-y-1.5">
                <label className="label-xs">Day of week</label>
                <Select
                  value={String(draft.scheduleDayOfWeek ?? 1)}
                  onChange={(e) => setField('scheduleDayOfWeek', Number(e.target.value))}
                  disabled={!draft.enabled}
                >
                  {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <button
              onClick={() => setShowAdvancedPrompt((v) => !v)}
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand hover:underline flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              {showAdvancedPrompt ? 'Hide' : 'Customise'} LLM prompt
            </button>
            {showAdvancedPrompt && (
              <>
                <Textarea
                  value={draft.llmPromptOverride ?? DEFAULT_SP_IMPORT_PROMPT}
                  onChange={(e) => setField('llmPromptOverride', e.target.value)}
                  className="min-h-[260px] font-mono text-[10px]"
                  disabled={!draft.enabled}
                />
                <div className="flex justify-between text-[9px] font-mono text-muted">
                  <span>Variables: <span className="text-brand">{`{{MAPPING}} {{ITEM}} {{TODAY}}`}</span></span>
                  <button
                    type="button"
                    onClick={() => setField('llmPromptOverride', undefined)}
                    className="text-brand hover:underline"
                  >
                    Reset to default
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Telemetry & actions */}
        <div className="p-5 border-t border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
            <div>
              <p className="font-bold uppercase tracking-[0.14em] text-muted mb-0.5">Last sync</p>
              <p className="font-mono">{draft.lastSyncAt ? new Date(draft.lastSyncAt).toLocaleString() : '—'}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-[0.14em] text-muted mb-0.5">Status</p>
              <p className={`font-bold ${
                draft.lastSyncStatus === 'success' ? 'text-emerald-600' :
                draft.lastSyncStatus === 'partial' ? 'text-amber-600' :
                draft.lastSyncStatus === 'error'   ? 'text-red-600' :
                'text-muted'
              }`}>{draft.lastSyncStatus ?? '—'}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-[0.14em] text-muted mb-0.5">Last result</p>
              <p className="font-mono">{draft.lastSyncNewCount ?? 0} new / {draft.lastSyncFetchedCount ?? 0} fetched</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-[0.14em] text-muted mb-0.5">Next scheduled</p>
              <p className="font-mono">{draft.nextSyncAt ? new Date(draft.nextSyncAt).toLocaleString() : '—'}</p>
            </div>
          </div>
          {draft.lastSyncMessage && (
            <p className="text-[10px] text-muted italic">{draft.lastSyncMessage}</p>
          )}
          {syncStatus.state !== 'idle' && (
            <div className={`flex items-center gap-2 p-3 border ${
              syncStatus.state === 'running' ? 'border-sky-300 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-800' :
              syncStatus.state === 'success' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800' :
              'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
            }`}>
              {syncStatus.state === 'running' && <Loader2 className="w-4 h-4 animate-spin text-sky-500" />}
              {syncStatus.state === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {syncStatus.state === 'error'   && <AlertCircle className="w-4 h-4 text-red-500" />}
              <span className="text-[11px]">{syncStatus.message}</span>
            </div>
          )}
          {/* Smart-delta info — explains how the daily check shrinks payload */}
          <div className="flex items-start gap-2 p-3 border border-brand/30 bg-brand/5 text-[10px]">
            <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold uppercase tracking-[0.14em] text-brand">Smart delta</strong>
              <span className="ml-2 text-muted">
                When the scheduler runs, the fetch is automatically filtered to
                <span className="font-mono"> Modified gt {`{lastSyncAt}`}</span> so only items
                changed since the last sync hit the wire. Combined with the dedup layer
                you typically end up importing only the genuinely new items per day.
                Need a full re-scan? Use <em>Reset delta</em>.
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm('Reset the smart-delta marker? The next sync will pull every item again (then dedup against pending/confirmed by SP id).')) return;
                const next = { ...draft, lastSyncAt: undefined, lastSyncStatus: undefined, lastSyncMessage: undefined, lastSyncFetchedCount: undefined, lastSyncNewCount: undefined };
                setDraft(next);
                persistCfg(next);
              }}
              disabled={!draft.lastSyncAt}
              title={draft.lastSyncAt ? 'Force a full re-scan on the next sync' : 'No delta marker to reset yet'}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset delta
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={save}>
                <Save className="w-4 h-4 mr-2" />
                {saved ? 'Saved!' : 'Save configuration'}
              </Button>
              <Button
                onClick={runManualSync}
                disabled={!draft.enabled || syncStatus.state === 'running' || !draft.siteUrl || !draft.listName}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                {syncStatus.state === 'running' ? 'Running…' : 'Sync now'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
