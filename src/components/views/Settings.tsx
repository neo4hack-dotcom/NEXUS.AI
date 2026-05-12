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
} from 'lucide-react';
import { AppState, LlmConfig } from '../../types';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { testConnection, DEFAULT_PROMPTS } from '../../services/llmService';
import { clearState } from '../../services/storage';

interface Props {
  state: AppState;
  update: (m: (s: AppState) => AppState) => void;
}

type Tab = 'llm' | 'prompts' | 'security' | 'data';

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
            Changes here affect the entire NEXUS.AI instance and all users.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-ink-600">
        {(
          [
            { id: 'llm', label: 'Local LLM', icon: Cpu },
            { id: 'prompts', label: 'AI Prompts', icon: Sparkles },
            { id: 'security', label: 'Security', icon: Key },
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
      {tab === 'security' && <SecuritySection state={state} update={update} />}
      {tab === 'data' && <DataSection />}
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

const SecuritySection: React.FC<Props> = ({ state, update }) => {
  const admin = state.users.find((u) => u.role === 'admin');
  const [pw, setPw] = useState('');
  const [saved, setSaved] = useState(false);

  if (!admin) return <p className="text-sm text-muted">No admin user found.</p>;

  const apply = () => {
    if (!pw.trim()) return;
    update((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === admin.id ? { ...u, password: pw } : u)),
    }));
    setPw('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="surface border">
      <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
        <Key className="w-5 h-5 text-brand" />
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">Admin credentials</h3>
          <p className="text-xs text-muted mt-1">
            Update password for <span className="font-mono text-brand">{admin.uid}</span>.
          </p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="space-y-1.5">
          <label className="label-xs">New password</label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>
      <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex justify-end">
        <Button onClick={apply} disabled={!pw.trim()}>
          <Save className="w-4 h-4 mr-2" />
          {saved ? 'Saved!' : 'Update password'}
        </Button>
      </div>
    </div>
  );
};

/* === Data === */

const DataSection: React.FC = () => {
  return (
    <div className="surface border">
      <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center gap-3">
        <Database className="w-5 h-5 text-brand" />
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">Data management</h3>
          <p className="text-xs text-muted mt-1">
            Storage stack: localStorage (instant) + db.json via /api/data (canonical).
          </p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted">
          NEXUS.AI persists state in <span className="font-mono text-brand">db.json</span> on the backend.
          Local cache uses the key <span className="font-mono">nexus_ai_data_v1</span>. A version mismatch
          will automatically purge the cache. Conflicts are resolved via the X-Base-Version header.
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
  );
};
