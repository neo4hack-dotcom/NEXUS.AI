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
  SmartTodo,
  Theme,
  ProjectFamily,
  McpServer,
  McpFamily,
  McpBestPractice,
  Agent,
  AgentFamily,
  DataFeed,
  WishItem,
  PendingProject,
  Objective,
  WebhookConfig,
  SharePointConfig,
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
// Tracks whether a POST is currently in-flight (between fetch() and response).
// Used by callers to know if local state has unflushed changes.
let _postInFlight = 0;

// Editing lock: when > 0, a destructive full-tree refresh (SSE/poll) must be
// suppressed so it can't reset an actively-open editor (e.g. a Working Group
// meeting session being typed). Incremented when an editor mounts, decremented
// when it closes. Background refreshes resume the moment it returns to 0.
let _editingLocks = 0;

/** Engage/release the editing lock. Pass true on editor open, false on close. */
export const setEditingLock = (on: boolean): void => {
  _editingLocks = Math.max(0, _editingLocks + (on ? 1 : -1));
};

/** True while any editor has the lock engaged. */
export const isEditingLocked = (): boolean => _editingLocks > 0;

/**
 * Returns true if there are unflushed local changes:
 * - A debounced POST is still waiting, OR
 * - A POST is in-flight (sent but no response yet).
 * Used by App.tsx to skip polling refresh and conflict overwrites while local
 * state is ahead of the server — prevents the classic "create A → poll → server
 * returns state without A → local A is wiped" race condition.
 */
export const hasPendingSave = (): boolean =>
  _pendingPayload !== null || _postTimer !== null || _postInFlight > 0;

/**
 * Forces the debounced POST to fire immediately and waits for it to complete.
 * Call this before any operation that needs to see fully-synced server state
 * (e.g. a deliberate refresh, leaving the page).
 */
export const flushPendingSave = async (): Promise<void> => {
  if (_postTimer) {
    clearTimeout(_postTimer);
    _postTimer = null;
    // Trigger the queued POST synchronously by running the same logic now.
    const payload = _pendingPayload;
    _pendingPayload = null;
    if (payload) {
      _saveQueue = _saveQueue.then(async () => {
        _postInFlight++;
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Base-Version': String(_serverVersion),
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            const result = await response.json();
            _serverVersion = result.timestamp ?? _serverVersion;
            if (result.merged && result.serverData) {
              window.dispatchEvent(
                new CustomEvent('nexus_merged', { detail: { serverData: result.serverData } })
              );
            }
          } else if (response.status === 409) {
            const conflictData = await response.json();
            if (conflictData?.serverData?.lastUpdated) {
              _serverVersion = conflictData.serverData.lastUpdated;
            }
            try {
              const retry = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Base-Version': 'force' },
                body: JSON.stringify(payload),
              });
              if (retry.ok) {
                const r = await retry.json();
                _serverVersion = r.timestamp ?? _serverVersion;
              }
            } catch (e) {
              console.warn('[DOINg] Flush 409 retry failed', e);
            }
          }
        } catch (err) {
          console.warn('[DOINg] Flush failed', err);
        } finally {
          _postInFlight--;
        }
      });
    }
  }
  // Wait for the queue to drain (covers both the just-triggered POST and any in-flight ones).
  await _saveQueue;
};

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  systemPrompt:
    'You are DOINg.AI, an expert AI Operations assistant for AI project portfolios. ' +
    'You produce concise, professional, executive-grade summaries in English.',
};

const DEFAULT_SHAREPOINT_CONFIG: SharePointConfig = {
  enabled: false,
  siteUrl: '',
  listName: '',
  authMethod: 'basic',
  scopeFilter: '',
  maxItemsPerFetch: 200,
  disableSslVerification: false,
  fieldMapping: {
    name: 'Title',
    description: 'Description',
    startDate: 'StartDate',
    deadline: 'DueDate',
    manager: 'Owner',
    status: 'Status',
  },
  // Default cadence: once a day at 06:00 — covers the typical
  // "I just need to capture the daily delta" use case out of the box.
  // (The whole config still has to be `enabled: true` before anything fires.)
  scheduleRecurrence: 'daily',
  scheduleHour: 6,
  scheduleMinute: 0,
  scheduleDayOfWeek: 1,
};

const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  enabled: false,
  provider: 'slack',
  url: '',
  events: ['project_red', 'wish_accepted', 'agent_production'],
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
    smartTodos: [],
    projectTemplates: [],
    projectFamilies: [],
    mcpServers: [],
    mcpFamilies: [],
    mcpBestPractices: [],
    agents: [],
    agentFamilies: [],
    dataFeeds: [],
    wishes: [],
    pendingProjects: [],
    okrs: [],
    sharePointConfig: DEFAULT_SHAREPOINT_CONFIG,
    webhookConfig: DEFAULT_WEBHOOK_CONFIG,
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
    projectFamilies: arr<ProjectFamily>(data.projectFamilies),
    mcpServers: arr<McpServer>(data.mcpServers).map((s) => ({
      ...s,
      tags: arr(s.tags),
      userTeams: arr(s.userTeams),
      codeAnalysis: s.codeAnalysis
        ? { ...s.codeAnalysis, recommendations: arr(s.codeAnalysis.recommendations) }
        : undefined,
    })),
    mcpFamilies: arr<McpFamily>(data.mcpFamilies),
    mcpBestPractices: arr<McpBestPractice>(data.mcpBestPractices).map((b) => ({
      ...b,
      tags: arr(b.tags),
      appliesTo: arr(b.appliesTo),
    })),
    agents: arr<Agent>(data.agents).map((a) => ({
      ...a,
      tags: arr(a.tags),
      tools: arr(a.tools),
      mcpServerIds: arr(a.mcpServerIds),
      knowledgeBases: arr(a.knowledgeBases),
      userTeams: arr(a.userTeams),
      releases: arr(a.releases),
      evaluations: arr(a.evaluations),
    })),
    agentFamilies: arr<AgentFamily>(data.agentFamilies),
    dataFeeds: arr<DataFeed>(data.dataFeeds),
    wishes: arr<WishItem>(data.wishes).map((w) => ({
      ...w,
      comments: arr(w.comments),
      tags: arr(w.tags),
      externalLinks: arr(w.externalLinks),
    })),
    pendingProjects: arr<PendingProject>(data.pendingProjects).map((p) => ({
      ...p,
      spRawItem: (p && typeof p.spRawItem === 'object') ? p.spRawItem : {},
      draft: (p && typeof p.draft === 'object') ? p.draft : {},
    })),
    sharePointConfig: { ...DEFAULT_SHAREPOINT_CONFIG, ...(data.sharePointConfig || {}),
      fieldMapping: { ...DEFAULT_SHAREPOINT_CONFIG.fieldMapping, ...((data.sharePointConfig || {}).fieldMapping || {}) },
    },
    okrs: arr<Objective>(data.okrs).map((o) => ({
      ...o,
      keyResults: arr(o.keyResults).map((kr: any) => ({ ...kr, linkedProjectIds: arr(kr.linkedProjectIds) })),
      tags: arr(o.tags),
    })),
    webhookConfig: { ...DEFAULT_WEBHOOK_CONFIG, ...(data.webhookConfig || {}),
      events: Array.isArray((data.webhookConfig || {}).events) ? (data.webhookConfig as any).events : DEFAULT_WEBHOOK_CONFIG.events,
    },
    smartTodos: arr<SmartTodo>(data.smartTodos),
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
    presentations: arr(p.presentations),
    linkedApps: arr(p.linkedApps),
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
      _postTimer = null;
      const payload = _pendingPayload;
      _pendingPayload = null;
      _saveQueue = _saveQueue.then(async () => {
        if (!payload) return;
        const baseVersion = _serverVersion;
        _postInFlight++;
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
            // The server auto-merged our write with a concurrent one. Adopt the
            // union so this client sees the other writer's changes too — and so
            // it never strands our own change (the old 409 data-loss bug).
            if (result.merged && result.serverData) {
              window.dispatchEvent(
                new CustomEvent('nexus_merged', { detail: { serverData: result.serverData } })
              );
            }
          } else if (response.status === 409) {
            // Legacy/edge path — the server now merges, so this is rare. Rebase
            // to the server version and retry ONCE with force so our change still
            // lands instead of being stranded.
            const conflictData = await response.json();
            if (conflictData?.serverData?.lastUpdated) {
              _serverVersion = conflictData.serverData.lastUpdated;
            }
            try {
              const retry = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Base-Version': 'force' },
                body: JSON.stringify(payload),
              });
              if (retry.ok) {
                const r = await retry.json();
                _serverVersion = r.timestamp ?? _serverVersion;
              }
            } catch (e) {
              console.warn('[DOINg] 409 retry failed', e);
            }
          }
        } catch (err) {
          console.warn('[DOINg] Server save failed', err);
        } finally {
          _postInFlight--;
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

// ──────────────────────────────────────────────────────────────────────────
// SSE — Real-time push from the FastAPI backend.
// Replaces polling for the common case. Polling is kept as a safety net so
// users still get refreshes if SSE proxies/middleboxes drop the connection.
// ──────────────────────────────────────────────────────────────────────────
let _sse: EventSource | null = null;

export const startSSE = (onUpdate: () => void): void => {
  if (_sse) return;
  if (typeof EventSource === 'undefined') {
    console.warn('[DOInG] EventSource not supported — relying on polling only');
    return;
  }
  try {
    _sse = new EventSource('/api/events');

    // Initial handshake: server tells us its current version on connect.
    _sse.addEventListener('hello', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.lastUpdated > _serverVersion) onUpdate();
      } catch { /* ignore malformed payload */ }
    });

    // Broadcast event fired every time the backend writes new data.
    _sse.addEventListener('data_updated', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.lastUpdated > _serverVersion) onUpdate();
      } catch { /* ignore malformed payload */ }
    });

    // Heartbeat — ignored, just keeps the connection alive through proxies.
    _sse.addEventListener('ping', () => { /* no-op */ });

    _sse.onerror = () => {
      // EventSource auto-reconnects with exponential backoff. We don't need to
      // do anything here — the polling safety net handles the gap.
    };
  } catch (e) {
    console.warn('[DOInG] SSE startup failed, falling back to polling', e);
    _sse = null;
  }
};

export const stopSSE = (): void => {
  if (_sse) {
    _sse.close();
    _sse = null;
  }
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

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  reader.onload = async (e) => {
    try {
      const raw = JSON.parse(e.target?.result as string);
      const imported = sanitizeAppState(raw);

      // --- Sync to server BEFORE notifying React ---
      // We use X-Base-Version: force to bypass optimistic-concurrency checks.
      // This must happen first so that _serverVersion is current when the
      // subsequent saveState() (triggered by the React useEffect) fires —
      // otherwise it would send X-Base-Version: 0, get a 409, and the
      // onConflict handler would overwrite the imported data with old server data.
      const { currentUserId: _uid, theme: _theme, ...serverPayload } = imported;
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Base-Version': 'force',
          },
          body: JSON.stringify(serverPayload),
        });
        if (res.ok) {
          const result = await res.json();
          // Update so the polling never sees an older version and overwrites us.
          _serverVersion = result.timestamp ?? Date.now();
        } else {
          // Server is up but rejected (shouldn't happen with "force") — block
          // polling for 5 min to avoid reverting localStorage.
          _serverVersion = Date.now() + 300_000;
        }
      } catch {
        // Server offline — block polling revert for 5 min so localStorage wins.
        _serverVersion = Date.now() + 300_000;
      }

      onDone(imported);
    } catch {
      onError('Invalid backup file — could not parse JSON.');
    }
  };
  reader.onerror = () => onError('Failed to read file.');
  reader.readAsText(file);
};

/* ===== Permission helper =====
 *
 * Filters the global state according to the role × group matrix defined in
 * src/services/permissions.ts. See that module for the full matrix.
 *
 *  - G1 (projects, communications): manager+admin see all; contributor+viewer
 *    see only entities they own (manager-of OR member-of for projects,
 *    author for communications).
 *  - G2 (repos, hackathons, MCP, agents): everyone sees all. Edit gating
 *    happens at the UI level via canEdit() in permissions.ts.
 *  - G3 (users, settings): admin only via sidebar/route guards. We do NOT
 *    filter state.users here — many views need to look up names (project
 *    manager, agent owner, etc.).
 *  - G4 (check-ins, working groups): everyone non-admin sees only own.
 *  - G5 (dataFeeds): admin + isIT users see all; others see an empty list.
 *    Access is gated at the sidebar/route level before this function runs,
 *    so in practice this guard is a safety net rather than the primary control.
 */
export const getFilteredState = (state: AppState): AppState => {
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me || me.role === 'admin') return state;

  const role = me.role;
  const uid = me.id;
  const result: AppState = { ...state };

  // ── G1: Projects + Communications ────────────────────────────────────
  if (role === 'contributor' || role === 'viewer') {
    result.projects = state.projects.filter(
      (p) => p.managerId === uid || p.members.some((m) => m.userId === uid)
    );
    result.communications = state.communications.filter((c) => c.authorId === uid);
  }
  // manager: sees all G1 — no filtering

  // ── G4: Check-ins + Working Groups — everyone non-admin sees only own ─
  result.weeklyCheckIns = state.weeklyCheckIns.filter((c) => c.userId === uid);
  result.workingGroups = state.workingGroups.filter(
    (wg) => wg.ownerId === uid || wg.members.some((m) => m.userId === uid)
  );

  // G2 (repos, hackathons, MCP, agents): unchanged — full visibility.

  // ── G5: Data Feeds — admin (early return above) + isIT ───────────────
  if (!me.isIT) {
    result.dataFeeds = [];
  }

  return result;
};
