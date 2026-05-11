export enum TaskStatus { TODO = 'To Do', ONGOING = 'In Progress', BLOCKED = 'Blocked', DONE = 'Done' }
export enum TaskPriority { LOW = 'Low', MEDIUM = 'Medium', HIGH = 'High', URGENT = 'Urgent' }
export enum ProjectStatus { PLANNING = 'Planning', ACTIVE = 'Active', PAUSED = 'Paused', DONE = 'Done' }
export enum ProjectRole { OWNER = 'Owner', LEAD = 'Lead', CONTRIBUTOR = 'Contributor' }

export interface TaskAction {
  id: string;
  text: string;
  status: 'To Do' | 'Ongoing' | 'Blocked' | 'Done';
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  comment?: string;
}

export interface ExternalDependency {
  id: string;
  label: string;
  status: 'Red' | 'Amber' | 'Green';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;           // userId
  originalEta: string;           // ISO date
  currentEta?: string;           // ISO date
  weight: number;                // Complexity weight 1–10
  isImportant: boolean;
  cost?: number;
  dependencies?: string[];
  externalDependencies?: ExternalDependency[];
  actions?: TaskAction[];
  checklist?: ChecklistItem[];
  docUrls?: string[];
  order?: number;
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}

export interface AuditEntry {
  id: string;
  date: string;       // ISO
  userName: string;
  action: string;
  details?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  managerId?: string;            // userId
  owner?: string;                // free-text
  architect?: string;            // free-text
  deadline: string;              // ISO date
  cost?: number;
  isImportant: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  completedAt?: string;          // ISO date
  tsdCreated?: boolean;
  members: ProjectMember[];
  tasks: Task[];
  dependencies?: string[];
  externalDependencies?: ExternalDependency[];
  sharedWith?: string[];
  docUrls?: string[];
  additionalDescriptions?: string[];
  auditLog?: AuditEntry[];
  pauseReason?: string;
  pauseUntil?: string;           // ISO date
  createdByBot?: boolean;
  technologies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  projects: Project[];
  sharedWith?: string[];
}

export interface Contributor {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  uid?: string;
  password?: string;
  role: string;
  email: string;
  team: string;
  expectations: string;
  avatar?: string;
}

export interface Technology {
  id: string;
  name: string;
  category: 'framework' | 'library' | 'database' | 'tool' | 'repo';
  description: string;
  url?: string;
}

export interface Communication {
  id: string;
  title: string;
  type: 'weekly' | 'newsletter' | 'exco';
  content: string;
  audience: string[]; // list of emails or group names
  sentAt?: string;
  createdAt: string;
}

export interface MailingList {
  id: string;
  name: string;
  emails: string[];
}

export interface LlmConfig {
  endpoint: string;
  apiKey: string;
  modelName: string;
  systemPrompt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: 'weekly' | 'newsletter' | 'exco' | 'info';
  subject: string;
  content: string;
}

export interface AuthConfig {
  username?: string;
  password?: string;
  isAuthenticated?: boolean;
}

export interface AppState {
  projects: Project[];
  contributors: Contributor[];
  technologies: Technology[];
  communications: Communication[];
  emailTemplates: EmailTemplate[];
  mailingLists: MailingList[];
  llmConfig: LlmConfig;
  authConfig: AuthConfig;
}
