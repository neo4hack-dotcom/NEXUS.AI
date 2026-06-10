/**
 * duplicateDetection — find likely-duplicate projects and merge them safely.
 *
 *  - quickSimilarity / findDuplicatePairs: cheap local heuristic (token overlap
 *    on name + description) used for instant inline warnings on create/import.
 *  - findDuplicatesAI: asks the local LLM to cluster semantic duplicates that a
 *    naive title match would miss, returning groups with a short reason.
 *  - mergeProjects: combines two projects WITHOUT losing information — unions all
 *    collections, fills blank fields, concatenates differing long text.
 */

import { Project, LlmConfig, AuditEntry } from '../types';
import { runPrompt } from './llmService';

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => new Set(norm(s).split(' ').filter((t) => t.length > 2));

/** Jaccard-ish similarity over name (weighted) + description tokens → 0..1. */
export const quickSimilarity = (a: Project, b: Project): number => {
  const an = norm(a.name), bn = norm(b.name);
  if (an && an === bn) return 1;
  const nameSim = jaccard(tokens(a.name), tokens(b.name));
  const descSim = jaccard(tokens(a.description || ''), tokens(b.description || ''));
  return Math.min(1, nameSim * 0.7 + descSim * 0.3 + (an && bn && (an.includes(bn) || bn.includes(an)) ? 0.3 : 0));
};
const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / (a.size + b.size - inter);
};

export interface DuplicateGroup {
  projectIds: string[];
  reason: string;
  confidence: number; // 0..1
}

/** Local heuristic: candidate duplicate pairs above a similarity threshold. */
export const findDuplicatePairs = (projects: Project[], threshold = 0.55): DuplicateGroup[] => {
  const live = projects.filter((p) => !p.isArchived);
  const groups: DuplicateGroup[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const sim = quickSimilarity(live[i], live[j]);
      if (sim >= threshold) groups.push({ projectIds: [live[i].id, live[j].id], reason: `Similar name/description (${Math.round(sim * 100)}% match)`, confidence: sim });
    }
  }
  return groups.sort((a, b) => b.confidence - a.confidence);
};

/** Duplicates that involve at least one of `targetIds` (used after an import). */
export const findDuplicatesFor = (projects: Project[], targetIds: string[], threshold = 0.55): DuplicateGroup[] => {
  const set = new Set(targetIds);
  return findDuplicatePairs(projects, threshold).filter((g) => g.projectIds.some((id) => set.has(id)));
};

/**
 * Semantic duplicate detection via the local LLM. Falls back to the heuristic
 * if the model is unavailable or returns unparseable output.
 */
export const findDuplicatesAI = async (projects: Project[], config: LlmConfig): Promise<DuplicateGroup[]> => {
  const live = projects.filter((p) => !p.isArchived);
  if (live.length < 2) return [];
  const list = live.map((p) => `- id:${p.id} | name:"${p.name}" | desc:"${(p.description || '').slice(0, 160)}"`).join('\n');
  const prompt = `You are deduplicating an AI project portfolio. Identify groups of projects that are REAL duplicates or near-duplicates (same initiative described differently, same use case, renamed, re-imported) — NOT merely projects in the same domain.
Return ONLY valid JSON (no prose, no fences):
{"groups":[{"projectIds":["id1","id2"],"reason":"why they are the same","confidence":0.0}]}
confidence is 0..1. Omit groups you are unsure about. Use the exact ids given.

PROJECTS:
${list}`;
  try {
    const out = await runPrompt(prompt, config);
    const json = JSON.parse(out.replace(/```json|```/g, '').trim());
    const ids = new Set(live.map((p) => p.id));
    const groups: DuplicateGroup[] = (json.groups || [])
      .map((g: any) => ({
        projectIds: (g.projectIds || []).filter((id: string) => ids.has(id)),
        reason: String(g.reason || 'Likely duplicate'),
        confidence: typeof g.confidence === 'number' ? g.confidence : 0.6,
      }))
      .filter((g: DuplicateGroup) => g.projectIds.length >= 2);
    return groups.length ? groups : findDuplicatePairs(projects);
  } catch {
    return findDuplicatePairs(projects);
  }
};

/* ── Smart merge ───────────────────────────────────────────────────────── */

const unionStrings = (a?: string[], b?: string[]) => Array.from(new Set([...(a || []), ...(b || [])]));
const unionBy = <T,>(a: T[] | undefined, b: T[] | undefined, key: (x: T) => string): T[] => {
  const out: T[] = []; const seen = new Set<string>();
  [...(a || []), ...(b || [])].forEach((x) => { const k = key(x); if (!seen.has(k)) { seen.add(k); out.push(x); } });
  return out;
};
const mergeText = (a?: string, b?: string): string => {
  const an = (a || '').trim(), bn = (b || '').trim();
  if (!an) return bn; if (!bn || an === bn) return an;
  if (an.includes(bn)) return an; if (bn.includes(an)) return bn;
  return `${an}\n\n— merged —\n${bn}`;
};

/**
 * Merge `secondary` into `primary`, keeping everything. `primary` wins on scalar
 * conflicts; blanks are filled from `secondary`; all collections are unioned.
 * Returns the merged project (caller deletes the secondary).
 */
export const mergeProjects = (primary: Project, secondary: Project, mergedByName = 'system'): Project => {
  const audit: AuditEntry = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
    date: new Date().toISOString(),
    userId: '',
    userName: mergedByName,
    action: 'Merged duplicate',
    details: `Merged "${secondary.name}" into this project`,
  } as AuditEntry;

  return {
    ...primary,
    description: mergeText(primary.description, secondary.description),
    context: mergeText(primary.context, secondary.context),
    notes: mergeText(primary.notes, secondary.notes),
    status: primary.status,
    devStatus: primary.devStatus ?? secondary.devStatus,
    innovationStatus: primary.innovationStatus ?? secondary.innovationStatus,
    managerId: primary.managerId ?? secondary.managerId,
    startDate: primary.startDate || secondary.startDate,
    deadline: primary.deadline || secondary.deadline,
    initialDeadline: primary.initialDeadline ?? secondary.initialDeadline,
    isImportant: primary.isImportant || secondary.isImportant,
    isBigBet: primary.isBigBet || secondary.isBigBet,
    budget: primary.budget || secondary.budget,
    familyId: primary.familyId ?? secondary.familyId,
    fteGain: primary.fteGain ?? secondary.fteGain,
    confidentiality: primary.confidentiality ?? secondary.confidentiality,
    members: unionBy(primary.members, secondary.members, (m) => m.userId),
    externalMembers: unionBy(primary.externalMembers, secondary.externalMembers, (m) => m.id),
    tasks: unionBy(primary.tasks, secondary.tasks, (t) => t.id),
    milestones: unionBy(primary.milestones, secondary.milestones, (m) => m.id),
    technologyIds: unionStrings(primary.technologyIds, secondary.technologyIds),
    repoIds: unionStrings(primary.repoIds, secondary.repoIds),
    mcpServerIds: unionStrings(primary.mcpServerIds, secondary.mcpServerIds),
    agentIds: unionStrings(primary.agentIds, secondary.agentIds),
    dataFeedIds: unionStrings(primary.dataFeedIds, secondary.dataFeedIds),
    dependsOnProjectIds: unionStrings(primary.dependsOnProjectIds, secondary.dependsOnProjectIds).filter((id) => id !== primary.id && id !== secondary.id),
    tags: unionStrings(primary.tags, secondary.tags),
    presentations: unionBy(primary.presentations, secondary.presentations, (p) => p.id),
    linkedApps: unionBy(primary.linkedApps, secondary.linkedApps, (a) => a.id),
    telemetry: unionBy(primary.telemetry, secondary.telemetry, (m) => m.id),
    roiModel: primary.roiModel ?? secondary.roiModel,
    auditLog: [...unionBy(primary.auditLog, secondary.auditLog, (a) => a.id), audit],
    createdAt: primary.createdAt < secondary.createdAt ? primary.createdAt : secondary.createdAt,
    updatedAt: new Date().toISOString(),
  };
};
