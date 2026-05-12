/* === NEXUS.AI — Domain Types === */

export type Theme = 'light' | 'dark';
export type Role = 'admin' | 'manager' | 'contributor' | 'viewer';

export enum TaskStatus {
  TODO = 'To Do',
  ONGOING = 'In Progress',
  BLOCKED = 'Blocked',
  DONE = 'Done',
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum ProjectStatus {
  PLANNING = 'Planning',
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  DONE = 'Done',
}

export enum ProjectRole {
  OWNER = 'Owner',
  LEAD = 'Lead',
  CONTRIBUTOR = 'Contributor',
}

export interface User {
  id: string;
  uid: string;                     // login handle (unique)
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
  functionTitle: string;           // job title / role on org
  role: Role;                      // app-level role
  expectations?: string;
  avatarColor?: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface AuditEntry {
  id: string;
  date: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  originalEta: string;             // ISO date
  currentEta?: string;             // ISO date (when slipped)
  weight: number;                  // 1..10
  dependencies?: string[];
  checklist?: ChecklistItem[];
  isImportant?: boolean;
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}

export interface Milestone {
  id: string;
  label: string;
  date: string;                    // ISO date
  done: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  managerId?: string;              // user id of owner/PM
  startDate: string;
  deadline: string;
  isImportant?: boolean;
  isArchived?: boolean;
  budget?: number;
  members: ProjectMember[];
  tasks: Task[];
  milestones: Milestone[];
  technologyIds: string[];
  repoIds: string[];
  tags: string[];
  auditLog: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export type TechLayer =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'data'
  | 'ml-ai'
  | 'infrastructure'
  | 'devops'
  | 'mobile'
  | 'security';

export type TechMaturity = 'evaluating' | 'adopted' | 'deprecated' | 'hold';

export interface Technology {
  id: string;
  name: string;
  category: 'framework' | 'library' | 'database' | 'tool' | 'language' | 'service';
  layer?: TechLayer;
  maturityStatus?: TechMaturity;
  description: string;
  version?: string;
  url?: string;
  license?: string;
  internalOwner?: string;
  tags: string[];
  createdAt: string;
}

export interface Repository {
  id: string;
  name: string;
  url: string;
  description: string;
  language?: string;
  visibility: 'public' | 'private' | 'internal';
  projectIds: string[];
  createdAt: string;
}

export interface Communication {
  id: string;
  title: string;
  type: 'weekly' | 'newsletter' | 'exco' | 'info';
  subject: string;
  content: string;
  mailingListIds: string[];
  projectIds: string[];
  authorId: string;
  status: 'draft' | 'sent';
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MailingList {
  id: string;
  name: string;
  description?: string;
  emails: string[];
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: 'weekly' | 'newsletter' | 'exco' | 'info';
  subject: string;
  content: string;
  createdAt: string;
}

export interface WeeklyCheckIn {
  id: string;
  userId: string;
  weekOf: string;                  // ISO date of Monday
  accomplishments: string;
  blockers: string;
  nextSteps: string;
  mood: 'green' | 'amber' | 'red';
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  type: 'stale_project' | 'task_slipping' | 'report_overdue' | 'milestone_reached' | 'info';
  message: string;
  details?: string;
  targetUserId?: string;
  targetRole?: Role;
  relatedId?: string;
  createdAt: string;
  seenBy: string[];
}

export interface LlmConfig {
  provider: 'ollama' | 'openai_compatible' | 'n8n';
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
}

export interface AppState {
  users: User[];
  projects: Project[];
  technologies: Technology[];
  repositories: Repository[];
  communications: Communication[];
  emailTemplates: EmailTemplate[];
  mailingLists: MailingList[];
  weeklyCheckIns: WeeklyCheckIn[];
  notifications: AppNotification[];
  llmConfig: LlmConfig;
  prompts: Record<string, string>;
  theme: Theme;
  currentUserId: string | null;
  lastUpdated: number;
}
