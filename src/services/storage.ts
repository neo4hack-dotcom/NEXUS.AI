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
  Theme,
} from '../types';

const STORAGE_KEY = 'nexus_ai_data_v1';
const VERSION_KEY = 'nexus_ai_app_version';
const CURRENT_APP_VERSION = '1.0.0';
const API_URL = '/api/data';

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  systemPrompt:
    'You are NEXUS.AI, an expert AI Operations assistant for AI project portfolios. ' +
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

const seedUser = (
  uid: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'manager' | 'contributor',
  team: string,
  title: string,
  password: string
): User => ({
  id: generateId(),
  uid,
  password,
  firstName,
  lastName,
  email: `${uid.toLowerCase()}@nexus.ai`,
  team,
  functionTitle: title,
  role,
  expectations: '',
  avatarColor: '#FF3E00',
  createdAt: new Date().toISOString(),
});

export const getDefaultState = (): AppState => {
  const admin = seedUser('admin', 'Mathieu', 'Masson', 'admin', 'Operations', 'Head of AI Operations', 'MM@2026');
  const pm = seedUser('emma', 'Emma', 'Dupont', 'manager', 'Core AI', 'Lead AI Engineer', 'changeme');
  const dev = seedUser('lucas', 'Lucas', 'Martin', 'contributor', 'Platform', 'Fullstack Engineer', 'changeme');

  const techReact: Technology = {
    id: generateId(),
    name: 'React',
    category: 'framework',
    description: 'UI library for building component-driven interfaces.',
    version: '19',
    url: 'https://react.dev',
    tags: ['frontend'],
    createdAt: new Date().toISOString(),
  };
  const techTorch: Technology = {
    id: generateId(),
    name: 'PyTorch',
    category: 'framework',
    description: 'Deep learning framework for research & production.',
    version: '2.5',
    url: 'https://pytorch.org',
    tags: ['ml'],
    createdAt: new Date().toISOString(),
  };
  const techFast: Technology = {
    id: generateId(),
    name: 'FastAPI',
    category: 'framework',
    description: 'High-performance Python web framework.',
    version: '0.115',
    url: 'https://fastapi.tiangolo.com',
    tags: ['backend'],
    createdAt: new Date().toISOString(),
  };

  const repoCore: Repository = {
    id: generateId(),
    name: 'nexus-ai-core',
    url: 'https://github.com/org/nexus-ai-core',
    description: 'Core inference engine and LLM orchestration.',
    language: 'Python',
    visibility: 'private',
    projectIds: [],
    createdAt: new Date().toISOString(),
  };

  const now = new Date();
  const inTwoMonths = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()).toISOString();
  const inOneMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
  const inOneWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

  const project: Project = {
    id: generateId(),
    name: 'NEXUS Agent v1',
    description: 'Conversational AI agent for automated support ticket triage and resolution.',
    status: ProjectStatus.ACTIVE,
    managerId: pm.id,
    startDate: now.toISOString(),
    deadline: inTwoMonths,
    isImportant: true,
    isArchived: false,
    budget: 120000,
    members: [
      { userId: pm.id, role: ProjectRole.OWNER },
      { userId: dev.id, role: ProjectRole.CONTRIBUTOR },
    ],
    tasks: [
      {
        id: generateId(),
        title: 'Fine-tune LLaMA-3 on support corpus',
        description: 'Curate dataset, run LoRA fine-tune, evaluate.',
        status: TaskStatus.ONGOING,
        priority: TaskPriority.HIGH,
        assigneeId: pm.id,
        originalEta: inOneWeek,
        weight: 8,
        isImportant: true,
        checklist: [
          { id: generateId(), text: 'Dataset curation', done: true },
          { id: generateId(), text: 'LoRA training', done: false },
          { id: generateId(), text: 'Eval suite', done: false },
        ],
      },
      {
        id: generateId(),
        title: 'API integration (FastAPI)',
        description: 'Expose inference endpoints with auth and rate limiting.',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assigneeId: dev.id,
        originalEta: inOneMonth,
        weight: 5,
      },
    ],
    milestones: [
      { id: generateId(), label: 'Alpha demo', date: inOneMonth, done: false },
      { id: generateId(), label: 'Production cut-over', date: inTwoMonths, done: false },
    ],
    technologyIds: [techTorch.id, techFast.id],
    repoIds: [repoCore.id],
    tags: ['ai', 'support', 'q1'],
    auditLog: [
      {
        id: generateId(),
        date: now.toISOString(),
        userId: admin.id,
        userName: 'System',
        action: 'Project created',
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  repoCore.projectIds = [project.id];

  const templates: EmailTemplate[] = [
    {
      id: generateId(),
      name: 'Standard Weekly Status',
      type: 'weekly',
      subject: '[Weekly] {{projectName}} — Status Update',
      content:
        'Hi team,\n\nHere is the weekly status for {{projectName}}.\n\n— Accomplishments\n• \n\n— Blockers\n• \n\n— Next Steps\n• \n\nBest,\n{{authorName}}',
      createdAt: now.toISOString(),
    },
    {
      id: generateId(),
      name: 'Executive Committee Update',
      type: 'exco',
      subject: '[Exco] AI Portfolio — Monthly Brief',
      content:
        'Dear Exco,\n\n— Headline\n• \n\n— Business impact / ROI\n• \n\n— Critical risks\n• \n\n— Asks\n• \n\nRegards,\n{{authorName}}',
      createdAt: now.toISOString(),
    },
    {
      id: generateId(),
      name: 'Broad Audience Newsletter',
      type: 'newsletter',
      subject: '[NEXUS.AI Newsletter] What shipped this month',
      content:
        'Hello everyone,\n\nHere is what the NEXUS.AI team shipped recently.\n\n— Highlights\n• \n\n— What is next\n• \n\nCall to action: ...\n\nThe NEXUS.AI team',
      createdAt: now.toISOString(),
    },
  ];

  const mailingLists: MailingList[] = [
    {
      id: generateId(),
      name: 'All employees',
      description: 'Broad newsletter audience',
      emails: ['all@company.com'],
      createdAt: now.toISOString(),
    },
    {
      id: generateId(),
      name: 'Executive committee',
      description: 'Exco / leadership',
      emails: ['ceo@company.com', 'cto@company.com', 'coo@company.com'],
      createdAt: now.toISOString(),
    },
  ];

  return {
    users: [admin, pm, dev],
    projects: [project],
    technologies: [techReact, techTorch, techFast],
    repositories: [repoCore],
    communications: [],
    emailTemplates: templates,
    mailingLists,
    weeklyCheckIns: [],
    notifications: [],
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
      console.warn(`[NEXUS] Version mismatch (was=${storedVersion}, now=${CURRENT_APP_VERSION}). Purging local cache.`);
      localStorage.clear();
      localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
      return getDefaultState();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeAppState(JSON.parse(raw));
  } catch (e) {
    console.error('[NEXUS] Local load failed', e);
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
    if (data && (data.users || data.projects)) return sanitizeAppState(data);
    return null;
  } catch {
    return null;
  }
};

export const saveState = (state: AppState): void => {
  try {
    const timestamp = Date.now();
    const stamped = { ...state, lastUpdated: timestamp };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);

    // Strip per-session keys before sending to server
    const { currentUserId, theme, ...serverPayload } = stamped;
    const baseVersion = String(state.lastUpdated || 0);

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Base-Version': baseVersion,
      },
      body: JSON.stringify(serverPayload),
    })
      .then(async (response) => {
        if (response.status === 409) {
          const conflictData = await response.json();
          window.dispatchEvent(
            new CustomEvent('nexus_conflict', { detail: { serverData: conflictData.serverData } })
          );
        }
      })
      .catch((err) => console.warn('[NEXUS] Server save failed', err));

    // Cross-tab broadcast
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(stamped) })
    );
  } catch (e: any) {
    console.error('[NEXUS] Save error', e);
    if (e.name === 'QuotaExceededError') {
      alert('Local storage full. Export your data and reset to recover.');
    }
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
