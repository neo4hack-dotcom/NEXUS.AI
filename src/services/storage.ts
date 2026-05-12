import {
  AppState,
  LlmConfig,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
  ProjectRole,
  User,
  Project,
  Technology,
  Repository,
  EmailTemplate,
  MailingList,
  Communication,
  WeeklyCheckIn,
  AppNotification,
  Hackathon,
  WorkingGroup,
  ProjectTemplate,
  Theme,
} from '../types';

const STORAGE_KEY = 'nexus_ai_data_v1';
const VERSION_KEY = 'nexus_ai_app_version';
const CURRENT_APP_VERSION = '1.0.0';
const API_URL = '/api/data';

// Tracks the lastUpdated timestamp the server last confirmed. Used as X-Base-Version
// to avoid 409s caused by server-side timestamp drift.
let _serverVersion = 0;
// Serialises server POSTs so rapid mutations never race each other.
let _saveQueue: Promise<void> = Promise.resolve();
// Debounces the server POST: localStorage updates are instant, network only after idle.
let _postTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingPayload: Record<string, unknown> | null = null;

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  systemPrompt:
    'You are DOINg.AI, an expert AI Operations assistant for AI project portfolios. ' +
    'You produce concise, professional, executive-grade summaries in English.',
};

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/* ===== Default seed ===== */

export const getDefaultState = (): AppState => {
  const admin: User = {
    id: generateId(),
    uid: 'admin',
    password: 'MM@2026',
    firstName: 'Admin',
    lastName: '',
    email: 'admin@doing.ai',
    team: '',
    functionTitle: 'Administrator',
    role: 'admin',
    expectations: '',
    avatarColor: '#FF3E00',
    createdAt: new Date().toISOString(),
  };

  return {
    users: [admin],
    projects: [],
    technologies: [],
    repositories: [],
    communications: [],
    emailTemplates: [],
    mailingLists: [],
    weeklyCheckIns: [],
    notifications: [],
    hackathons: [],
    workingGroups: [],
    projectTemplates: [],
    llmConfig: DEFAULT_LLM_CONFIG,
    prompts: {},
    theme: 'dark',
    currentUserId: null,
    lastUpdated: Date.now(),
  };
};

/* ===== Sanitize / migrate ===== */

export const sanitizeAppState = (data: any): AppState => {
  if (!data || typeof data !== 'object') return getDefaultState();
  const base = getDefaultState();
  const arr = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

  const state: AppState = {
    users: arr<User>(data.users),
    projects: arr<Project>(data.projects),
    technologies: arr<Technology>(data.technologies),
    repositories: arr<Repository>(data.repositories),
    communications: arr<Communication>(data.communications),
    emailTemplates: arr<EmailTemplate>(data.emailTemplates),
    mailingLists: arr<MailingList>(data.mailingLists),
    weeklyCheckIns: arr<WeeklyCheckIn>(data.weeklyCheckIns),
    notifications: arr<AppNotification>(data.notifications),
    hackathons: arr<Hackathon>(data.hackathons).map((h) => ({
      ...h,
      participants: arr(h.participants),
      documents: arr(h.documents),
      messages: arr(h.messages),
      tags: arr(h.tags),
    })),
    projectTemplates: arr<ProjectTemplate>(data.projectTemplates),
    workingGroups: arr<WorkingGroup>(data.workingGroups).map((wg) => ({
      ...wg,
      members: arr(wg.members),
      tasks: arr(wg.tasks).map((t: any) => ({ ...t, checklist: arr(t.checklist), labels: arr(t.labels) })),
      meetings: arr(wg.meetings).map((m: any) => ({
        ...m,
        decisions: arr(m.decisions),
        attendeeIds: arr(m.attendeeIds),
        actionItems: arr(m.actionItems).map((a: any) => ({
          id: a.id || '',
          text: a.text || '',
          ownerId: a.ownerId,
          dueDate: a.dueDate,
          status: a.status || 'todo',
          carriedFromSessionId: a.carriedFromSessionId,
        })),
      })),
      tags: arr(wg.tags),
    })),
    llmConfig: { ...DEFAULT_LLM_CONFIG, ...(data.llmConfig || {}) },
    prompts: data.prompts && typeof data.prompts === 'object' ? data.prompts : {},
    theme: (data.theme === 'light' ? 'light' : 'dark') as Theme,
    currentUserId: typeof data.currentUserId === 'string' ? data.currentUserId : null,
    lastUpdated: typeof data.lastUpdated === 'number' ? data.lastUpdated : Date.now(),
  };

  // Project sanitation
  state.projects = state.projects.map((p) => ({
    ...p,
    members: arr(p.members),
    tasks: arr(p.tasks).map((t: any) => ({
      ...t,
      checklist: arr(t.checklist),
      dependencies: arr(t.dependencies),
    })),
    milestones: arr(p.milestones),
    technologyIds: arr(p.technologyIds),
    repoIds: arr(p.repoIds),
    tags: arr(p.tags),
    auditLog: arr(p.auditLog),
  }));

  // Seed empty state to ensure UX
  if (state.users.length === 0) {
    return base;
  }

  return state;
};

/* ===== Local storage ===== */

export const loadState = (): AppState => {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion !== CURRENT_APP_VERSION) {
      console.warn(`[DOINg] Version mismatch (was=${storedVersion}, now=${CURRENT_APP_VERSION}). Purging local cache.`);
      localStorage.clear();
      localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
      return getDefaultState();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeAppState(JSON.parse(raw));
  } catch (e) {
    console.error('[DOINg] Local load failed', e);
    localStorage.clear();
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
  }
  return getDefaultState();
};

/* ===== Server sync ===== */

export const fetchFromServer = async (): Promise<AppState | null> => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && (data.users !== undefined || data.projects !== undefined)) {
      // Seed the confirmed version so the first save uses the right base.
      _serverVersion = typeof data.lastUpdated === 'number' ? data.lastUpdated : 0;
      return sanitizeAppState(data);
    }
    return null;
  } catch {
    return null;
  }
};

export const saveState = (state: AppState): void => {
  try {
    const timestamp = Date.now();
    const stamped = { ...state, lastUpdated: timestamp };

    // 1. localStorage: always instant.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);

    // 2. Server POST: debounced (400 ms idle) + serialised.
    //    localStorage is always written immediately above; the network call waits.
    //    Reading _serverVersion INSIDE the chained .then ensures we use the version
    //    confirmed by the previous save, not the queued-time snapshot.
    const { currentUserId, theme, ...serverPayload } = stamped;
    _pendingPayload = serverPayload as Record<string, unknown>;

    if (_postTimer) clearTimeout(_postTimer);
    _postTimer = setTimeout(() => {
      const payload = _pendingPayload;
      _pendingPayload = null;
      _saveQueue = _saveQueue.then(async () => {
        if (!payload) return;
        const baseVersion = _serverVersion;
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Base-Version': String(baseVersion),
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            const result = await response.json();
            _serverVersion = result.timestamp ?? timestamp;
          } else if (response.status === 409) {
            const conflictData = await response.json();
            window.dispatchEvent(
              new CustomEvent('nexus_conflict', { detail: { serverData: conflictData.serverData } })
            );
          }
        } catch (err) {
          console.warn('[DOINg] Server save failed', err);
        }
      });
    }, 400);
    // NOTE: do NOT dispatch a synthetic StorageEvent here — it would fire in the same
    // tab and trigger the subscribeToStoreUpdates callback, causing a save loop that
    // produces rapid-fire 409s. Real cross-tab sync is handled natively by the browser.
  } catch (e: any) {
    console.error('[DOINg] Save error', e);
    if (e.name === 'QuotaExceededError') {
      alert('Local storage full. Export your data and reset to recover.');
    }
  }
};

let _pollTimer: ReturnType<typeof setInterval> | null = null;

export const startPolling = (onNewVersion: () => void, intervalMs = 5000): void => {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/version');
      if (!res.ok) return;
      const { lastUpdated } = await res.json();
      if (lastUpdated > _serverVersion) {
        onNewVersion();
      }
    } catch {
      // ignore network errors silently
    }
  }, intervalMs);
};

export const stopPolling = (): void => {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
};

export const subscribeToStoreUpdates = (callback: () => void) => {
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

export const clearState = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
  window.location.reload();
};

/* ===== Backup helpers ===== */

export const exportBackup = (state: AppState): void => {
  const { currentUserId, ...payload } = state; // strip session state; keep theme + all data
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `doing-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importBackup = (
  file: File,
  onDone: (state: AppState) => void,
  onError: (msg: string) => void
): void => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target?.result as string);
      const imported = sanitizeAppState(raw);
      // Force-write to server without version check so we can overwrite
      _serverVersion = 0;
      onDone(imported);
    } catch {
      onError('Invalid backup file — could not parse JSON.');
    }
  };
  reader.onerror = () => onError('Failed to read file.');
  reader.readAsText(file);
};

/* ===== Permission helper ===== */

export const getFilteredState = (state: AppState): AppState => {
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me || me.role === 'admin') return state;

  if (me.role === 'manager') {
    // Manager sees: projects they manage + projects they are a member of + their team
    const projects = state.projects.filter(
      (p) =>
        p.managerId === me.id ||
        p.members.some((m) => m.userId === me.id) ||
        state.users.some((u) => u.team === me.team && u.id !== me.id && p.members.some((m) => m.userId === u.id))
    );
    return { ...state, projects };
  }

  if (me.role === 'contributor') {
    const projects = state.projects.filter((p) => p.members.some((m) => m.userId === me.id));
    return { ...state, projects };
  }

  // viewer
  return { ...state, projects: state.projects.filter((p) => !p.isArchived) };
};
