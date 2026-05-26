/**
 * Centralised role-based access control.
 *
 * The app exposes its features through four functional groups:
 *
 *   G1 — Project Management     : projects, timeline, risk, communications
 *   G2 — Catalogs               : repositories, hackathons, MCP Hub, AI agents
 *   G3 — Admin                  : contributors, settings
 *   G4 — Personal collaboration : weekly check-ins, working groups
 *
 * Per-role access matrix:
 *
 *           │ G1 (mgmt)            │ G2 (catalogs)        │ G3 (admin) │ G4 (personal)
 * ──────────┼──────────────────────┼──────────────────────┼────────────┼────────────────
 *  admin    │ all view/edit/AI     │ all view/edit/AI     │ all        │ all
 *  manager  │ all view/edit/AI     │ all view/edit/AI     │ ─          │ own view/edit/AI
 *  contrib. │ own view/edit/AI     │ all view, own e/AI   │ ─          │ own view/edit/AI
 *  viewer   │ own view (no e/AI)   │ all view, own e (no AI) │ ─       │ own view/edit (no AI)
 *
 *  Important: "own" on G1 means "manager of OR member of". So an admin-assigned
 *  project becomes visible to a contributor/viewer even if they didn't create it.
 *
 *  This module is the SINGLE source of truth — UI code should never re-implement
 *  role checks inline. Call canAccessGroup / canEdit / canUseAI here instead.
 */

import {
  Role, User, Project, Repository, Hackathon, Communication,
  WeeklyCheckIn, WorkingGroup, McpServer, Agent, WishItem,
} from '../types';

/* ────────────────────────────────────────────────────────────────────
   Groups
   ──────────────────────────────────────────────────────────────────── */

export type Group = 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'public';

/** Maps a sidebar tab id to the functional group it belongs to.
 *  'public' = always visible to any signed-in user.
 *
 *  G5 — Data Platform: visible to admin OR users with the \`isIT\` flag.
 */
export const TAB_GROUP: Record<string, Group> = {
  dashboard:      'public',
  projects:       'g1',
  timeline:       'g1',
  risk:           'g1',
  communications: 'g1',
  tech:           'public',   // tech catalog stays open to everyone
  repos:          'g2',
  hackathons:     'g2',
  mcp:            'g2',
  agents:         'g2',
  contributors:   'g3',
  settings:       'g3',
  checkin:        'g4',
  workinggroups:  'g4',
  todos:          'public',   // personal task manager
  guide:          'public',
  datafeeds:      'g5',       // Data Feeds — admin + IT flag
  wishes:         'public',   // collective wishlist — open to all signed-in users
  pending:        'g6',       // Pending project imports — admin + manager
};

/**
 * Whether a role can even SEE the group at all (sidebar visibility + route guard).
 *
 * @param role      - The user's app role.
 * @param group     - The functional group to check.
 * @param isIT      - Optional IT flag from the User record. Required to access G5.
 */
export const canAccessGroup = (role: Role, group: Group, isIT?: boolean): boolean => {
  if (group === 'public') return true;
  if (role === 'admin') return true;
  if (group === 'g3') return false;          // admin only
  if (group === 'g5') return isIT === true;  // admin (caught above) + IT flag
  if (group === 'g6') return role === 'manager';  // admin (caught above) + manager
  // manager, contributor, viewer all see G1, G2, G4 (with filtering applied separately)
  return true;
};

/* ────────────────────────────────────────────────────────────────────
   Per-entity ownership predicates
   ──────────────────────────────────────────────────────────────────── */

export const ownsProject = (p: Project, userId: string): boolean =>
  p.managerId === userId || p.members.some((m) => m.userId === userId);

export const ownsCommunication = (c: Communication, userId: string): boolean =>
  c.authorId === userId;

export const ownsRepository = (r: Repository, userId: string): boolean =>
  (r as { createdByUserId?: string }).createdByUserId === userId;

export const ownsHackathon = (h: Hackathon, userId: string): boolean =>
  (h as { createdByUserId?: string }).createdByUserId === userId;

export const ownsMcpServer = (s: McpServer, userId: string): boolean =>
  (s as { createdByUserId?: string }).createdByUserId === userId;

export const ownsAgent = (a: Agent, userId: string): boolean =>
  a.ownerUserId === userId;

export const ownsCheckIn = (c: WeeklyCheckIn, userId: string): boolean =>
  c.userId === userId;

export const ownsWorkingGroup = (wg: WorkingGroup, userId: string): boolean =>
  wg.ownerId === userId || wg.members.some((m) => m.userId === userId);

export const ownsWish = (w: WishItem, userId: string): boolean =>
  w.requesterId === userId;

/* ────────────────────────────────────────────────────────────────────
   Entity-typed canEdit / canUseAI / canCreate helpers
   These are the ones UI code should call.
   ──────────────────────────────────────────────────────────────────── */

export type EntityType =
  | 'project' | 'communication'
  | 'repository' | 'hackathon' | 'mcpServer' | 'agent'
  | 'checkIn' | 'workingGroup';

const ENTITY_GROUP: Record<EntityType, Group> = {
  project:       'g1',
  communication: 'g1',
  repository:    'g2',
  hackathon:     'g2',
  mcpServer:     'g2',
  agent:         'g2',
  checkIn:       'g4',
  workingGroup:  'g4',
};

const ownsEntity = (entity: unknown, type: EntityType, userId: string): boolean => {
  switch (type) {
    case 'project':       return ownsProject(entity as Project, userId);
    case 'communication': return ownsCommunication(entity as Communication, userId);
    case 'repository':    return ownsRepository(entity as Repository, userId);
    case 'hackathon':     return ownsHackathon(entity as Hackathon, userId);
    case 'mcpServer':     return ownsMcpServer(entity as McpServer, userId);
    case 'agent':         return ownsAgent(entity as Agent, userId);
    case 'checkIn':       return ownsCheckIn(entity as WeeklyCheckIn, userId);
    case 'workingGroup':  return ownsWorkingGroup(entity as WorkingGroup, userId);
  }
};

/** Can the user view this specific entity? Used by getFilteredState. */
export const canViewEntity = (entity: unknown, type: EntityType, user: User): boolean => {
  const role = user.role;
  if (role === 'admin') return true;
  const group = ENTITY_GROUP[type];
  if (group === 'g2') return true; // all roles see all G2
  if (group === 'g1') {
    if (role === 'manager') return true;            // manager sees all G1
    return ownsEntity(entity, type, user.id);       // contributor + viewer: own only
  }
  if (group === 'g4') return ownsEntity(entity, type, user.id);
  return false;
};

/** Can the user edit / delete this specific entity? */
export const canEdit = (entity: unknown, type: EntityType, user: User): boolean => {
  const role = user.role;
  if (role === 'admin') return true;
  const group = ENTITY_GROUP[type];

  if (group === 'g1') {
    if (role === 'viewer')      return false;                    // viewer = read-only on G1
    if (role === 'manager')     return true;                     // manager: all G1
    return ownsEntity(entity, type, user.id);                    // contributor: own only
  }
  if (group === 'g2') {
    if (role === 'manager')     return true;                     // manager: all G2
    return ownsEntity(entity, type, user.id);                    // contrib + viewer: own only
  }
  if (group === 'g4') return ownsEntity(entity, type, user.id);  // own only (incl. viewer)
  return false;
};

/** Can the user trigger AI-powered actions (enrichment, generation, analysis) on this entity? */
export const canUseAI = (entity: unknown, type: EntityType, user: User): boolean => {
  const role = user.role;
  if (role === 'viewer') return false;                           // viewer: never AI
  if (role === 'admin')  return true;
  const group = ENTITY_GROUP[type];

  if (group === 'g1') {
    if (role === 'manager')     return true;
    return ownsEntity(entity, type, user.id);                    // contributor: own only
  }
  if (group === 'g2') {
    if (role === 'manager')     return true;
    return ownsEntity(entity, type, user.id);                    // contributor: own only
  }
  if (group === 'g4') return ownsEntity(entity, type, user.id);
  return false;
};

/** Can the user create a new entity of this type? (independent of ownership) */
export const canCreate = (type: EntityType, user: User): boolean => {
  const role = user.role;
  if (role === 'admin') return true;
  const group = ENTITY_GROUP[type];
  if (group === 'g1') return role !== 'viewer';                  // viewer cannot create on G1
  if (group === 'g2') return true;                               // everyone can create their own
  if (group === 'g4') return true;                               // own check-ins / WG
  return false;
};

/** Are AI buttons globally allowed for this role in this group? Used to gray-out toolbars. */
export const canUseAnyAI = (group: Group, role: Role): boolean => {
  if (role === 'viewer') return false;
  if (role === 'admin') return true;
  if (group === 'g1' || group === 'g2') return true;
  if (group === 'g4') return true;
  return false;
};
