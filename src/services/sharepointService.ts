/**
 * SharePoint Import — orchestration layer.
 *
 * Flow:
 *   1. fetchItems()           → hits /api/sharepoint/fetch (server proxy)
 *   2. dedupeAgainst()        → filters out items we already have a pending or
 *                                confirmed draft for (delta detection)
 *   3. mapWithLlm()           → for each new item, asks the local LLM to
 *                                generate a structured Project draft
 *   4. runSync()              → combines all of the above and returns the
 *                                new PendingProject[] ready to be appended
 *
 * Scheduling:
 *   shouldRunSyncNow()         — pure function: given config + now(), should
 *                                we kick a sync? Used by the per-minute tick
 *                                in App.tsx.
 *   computeNextSyncAt()        — pure function: returns the next scheduled
 *                                ISO timestamp based on the recurrence.
 */

import {
  AppState,
  LlmConfig,
  PendingProject,
  Project,
  ProjectStatus,
  SharePointConfig,
  SharePointFieldMapping,
} from '../types';
import { generateId } from './storage';
import { runPrompt } from './llmService';

/* ──────────────────────────────────────────────────────────────────────────
   Default LLM prompt (overridable via SharePointConfig.llmPromptOverride)
   ────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_SP_IMPORT_PROMPT = `You are a project intake assistant.

Below is a single raw item pulled from an on-premise SharePoint list. The team
has hinted which SharePoint columns map to which DOInG project fields.

Use those hints PLUS your understanding of the raw fields to produce a clean,
structured project draft. If a field is missing or ambiguous, infer a sensible
value rather than leaving it blank, and reflect your confidence in the
"confidence" field below.

SHAREPOINT FIELD MAPPING (SP column → DOInG project field):
{{MAPPING}}

RAW SHAREPOINT ITEM (JSON):
{{ITEM}}

TODAY: {{TODAY}}

Respond with ONLY a valid JSON object matching this exact schema (no markdown):
{
  "name":        "Short project name (max 60 chars)",
  "description": "1–2 sentence project description, plain text",
  "context":     "Background / stakeholder context if extractable, else empty string",
  "startDate":   "YYYY-MM-DD (today if not extractable)",
  "deadline":    "YYYY-MM-DD (today + 90 days if not extractable)",
  "status":      "Planning|Active|Paused|Done",
  "managerHint": "Free-text — name or email of the project lead from the raw item, else empty",
  "tags":        ["tag1", "tag2"],
  "rationale":   "1 sentence explaining how you mapped the fields",
  "confidence":  "high|medium|low"
}

Rules:
- Status: infer from any status-like text in the raw item; default Active.
- Tags: extract 2–5 short keywords, lowercase, hyphenated.
- Output ONLY the JSON object, no preface, no markdown fences.`;

/* ──────────────────────────────────────────────────────────────────────────
   Pure helpers
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Get the SharePoint item's unique ID. SharePoint REST returns the field as
 * `Id` (verbose) or `ID` (nometadata) depending on the negotiation. Fall back
 * to a hash of the JSON if neither is present.
 */
export const extractSpItemId = (item: Record<string, unknown>): string => {
  const id = item?.Id ?? item?.ID ?? item?.id;
  if (id !== undefined && id !== null) return String(id);
  // Stable fallback so re-fetching the same payload doesn't duplicate.
  return `hash_${hashString(JSON.stringify(item))}`;
};

const hashString = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
};

/** Map free-text status to the ProjectStatus enum. */
const coerceStatus = (raw?: string): ProjectStatus => {
  const t = (raw || '').toLowerCase();
  if (t.includes('done') || t.includes('complete') || t.includes('closed') || t.includes('terminé')) return 'Done' as ProjectStatus;
  if (t.includes('pause') || t.includes('hold') || t.includes('en attente'))                          return 'Paused' as ProjectStatus;
  if (t.includes('plan'))                                                                              return 'Planning' as ProjectStatus;
  return 'Active' as ProjectStatus;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const futureIso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);

/* ──────────────────────────────────────────────────────────────────────────
   Server fetch — calls the FastAPI proxy
   ────────────────────────────────────────────────────────────────────────── */

export const fetchSharePointItems = async (
  cfg: SharePointConfig
): Promise<{ items: Record<string, unknown>[]; count: number }> => {
  const res = await fetch('/api/sharepoint/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl: cfg.siteUrl,
      listName: cfg.listName,
      authMethod: cfg.authMethod,
      username: cfg.username,
      password: cfg.password,
      domain: cfg.domain,
      bearerToken: cfg.bearerToken,
      scopeFilter: cfg.scopeFilter,
      maxItems: cfg.maxItemsPerFetch ?? 200,
      disableSslVerification: cfg.disableSslVerification ?? false,
    }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j.detail) detail = j.detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
};

/* ──────────────────────────────────────────────────────────────────────────
   Delta detection
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Returns the subset of items whose spItemId is NOT already present in either
 * the existing pending bucket or the live projects (whichever was previously
 * imported). Avoids duplicate drafts.
 */
export const dedupeAgainst = (
  items: Record<string, unknown>[],
  existingPending: PendingProject[],
  existingProjects: Project[],
): Record<string, unknown>[] => {
  const seen = new Set<string>();
  existingPending.forEach((p) => seen.add(p.spItemId));
  existingProjects.forEach((p) => {
    const tag = (p.tags || []).find((t) => t.startsWith('sp:'));
    if (tag) seen.add(tag.slice(3));
  });
  return items.filter((it) => !seen.has(extractSpItemId(it)));
};

/* ──────────────────────────────────────────────────────────────────────────
   LLM transformation
   ────────────────────────────────────────────────────────────────────────── */

interface LlmDraftOutput {
  name?: string;
  description?: string;
  context?: string;
  startDate?: string;
  deadline?: string;
  status?: string;
  managerHint?: string;
  tags?: string[];
  rationale?: string;
  confidence?: 'high' | 'medium' | 'low';
}

const parseJsonLoose = (raw: string): LlmDraftOutput => {
  const cleaned = raw.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('LLM did not return parseable JSON');
};

const mappingToText = (mapping: SharePointFieldMapping): string => {
  const entries = Object.entries(mapping).filter(([, v]) => v && String(v).trim());
  if (entries.length === 0) return '(no explicit mapping provided)';
  return entries.map(([projectField, spColumn]) => `  - ${spColumn}  →  Project.${projectField}`).join('\n');
};

/** Resolve a free-text manager hint to a real user id by email/uid/name match. */
const resolveManagerId = (hint: string | undefined, users: AppState['users']): string | undefined => {
  if (!hint) return undefined;
  const q = hint.toLowerCase().trim();
  if (!q) return undefined;
  const byEmail = users.find((u) => u.email?.toLowerCase() === q);
  if (byEmail) return byEmail.id;
  const byUid = users.find((u) => u.uid?.toLowerCase() === q);
  if (byUid) return byUid.id;
  const byFullName = users.find((u) => `${u.firstName} ${u.lastName}`.toLowerCase() === q);
  if (byFullName) return byFullName.id;
  // Partial match — last resort
  const partial = users.find(
    (u) => q.includes(u.uid?.toLowerCase() || '###') ||
           q.includes(u.email?.toLowerCase() || '###') ||
           q.includes(u.lastName.toLowerCase())
  );
  return partial?.id;
};

/**
 * Ask the LLM to produce a structured project draft for a single raw item.
 * Falls back to a heuristic mapping if the LLM call fails — we'd rather give
 * the reviewer SOMETHING to confirm than abort the whole sync.
 */
export const mapWithLlm = async (
  rawItem: Record<string, unknown>,
  config: SharePointConfig,
  llmConfig: LlmConfig,
  users: AppState['users'],
): Promise<{ draft: Partial<Project>; aiRationale?: string; aiConfidence?: 'high' | 'medium' | 'low' }> => {
  const mappingText = mappingToText(config.fieldMapping);
  const itemText    = JSON.stringify(rawItem, null, 2).slice(0, 4000); // hard-cap context
  const prompt = (config.llmPromptOverride || DEFAULT_SP_IMPORT_PROMPT)
    .replace('{{MAPPING}}', mappingText)
    .replace('{{ITEM}}', itemText)
    .replace('{{TODAY}}', todayIso());

  try {
    const raw = await runPrompt(prompt, llmConfig);
    const parsed = parseJsonLoose(raw);

    const spId = extractSpItemId(rawItem);
    const draft: Partial<Project> = {
      name:        (parsed.name || `Imported #${spId}`).slice(0, 80),
      description: parsed.description || '',
      context:     parsed.context || '',
      startDate:   parsed.startDate || todayIso(),
      deadline:    parsed.deadline || futureIso(90),
      status:      coerceStatus(parsed.status),
      managerId:   resolveManagerId(parsed.managerHint, users),
      tags:        Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    };
    return {
      draft,
      aiRationale: parsed.rationale,
      aiConfidence: parsed.confidence,
    };
  } catch (e) {
    // Heuristic fallback — pick whatever the mapping told us about
    console.warn('[SharePoint] LLM mapping failed, using heuristic fallback:', e);
    const get = (col?: string) => (col && rawItem[col] != null ? String(rawItem[col]) : '');
    const fm = config.fieldMapping;
    return {
      draft: {
        name:        get(fm.name) || `Imported #${extractSpItemId(rawItem)}`,
        description: get(fm.description),
        context:     get(fm.context),
        startDate:   get(fm.startDate) || todayIso(),
        deadline:    get(fm.deadline)  || futureIso(90),
        status:      coerceStatus(get(fm.status)),
        managerId:   resolveManagerId(get(fm.manager), users),
        tags:        get(fm.tags)
          ? get(fm.tags).split(/[,;]/).map((t) => t.trim()).filter(Boolean)
          : [],
      },
      aiRationale: 'LLM unavailable — fell back to direct field mapping.',
      aiConfidence: 'low',
    };
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   Full sync orchestrator
   ────────────────────────────────────────────────────────────────────────── */

export interface SyncResult {
  fetched: number;
  added: number;
  newPending: PendingProject[];
  errors: string[];
}

export const runSync = async (
  state: AppState,
  llmConfig: LlmConfig,
  onProgress?: (msg: string) => void,
): Promise<SyncResult> => {
  const cfg = state.sharePointConfig;
  if (!cfg.enabled) throw new Error('SharePoint import is disabled');
  if (!cfg.siteUrl || !cfg.listName) throw new Error('SharePoint URL and list name are required');

  onProgress?.('Connecting to SharePoint…');
  const { items } = await fetchSharePointItems(cfg);
  onProgress?.(`Fetched ${items.length} item(s) — checking for new ones…`);

  const newItems = dedupeAgainst(items, state.pendingProjects ?? [], state.projects ?? []);
  if (newItems.length === 0) {
    return { fetched: items.length, added: 0, newPending: [], errors: [] };
  }
  onProgress?.(`${newItems.length} new item(s) — mapping with LLM…`);

  const errors: string[] = [];
  const newPending: PendingProject[] = [];

  for (let i = 0; i < newItems.length; i++) {
    const raw = newItems[i];
    onProgress?.(`Mapping ${i + 1}/${newItems.length}…`);
    try {
      const { draft, aiRationale, aiConfidence } = await mapWithLlm(raw, cfg, llmConfig, state.users);
      newPending.push({
        id: generateId(),
        spItemId: extractSpItemId(raw),
        spSource: { siteUrl: cfg.siteUrl, listName: cfg.listName },
        spRawItem: raw,
        spFetchedAt: new Date().toISOString(),
        draft,
        aiRationale,
        aiConfidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      errors.push(`Item ${extractSpItemId(raw)}: ${e.message}`);
    }
  }

  return { fetched: items.length, added: newPending.length, newPending, errors };
};

/* ──────────────────────────────────────────────────────────────────────────
   Scheduling
   ────────────────────────────────────────────────────────────────────────── */

/** Compute the next scheduled run from "now" given the recurrence config. */
export const computeNextSyncAt = (cfg: SharePointConfig, fromMs: number = Date.now()): string | undefined => {
  const r = cfg.scheduleRecurrence;
  if (r === 'off' || r === 'manual') return undefined;

  const from = new Date(fromMs);
  const hour = cfg.scheduleHour ?? 6;
  const min  = cfg.scheduleMinute ?? 0;

  if (r === 'hourly') {
    const next = new Date(from);
    next.setMinutes(min, 0, 0);
    if (next.getTime() <= fromMs) next.setHours(next.getHours() + 1);
    return next.toISOString();
  }

  if (r === 'daily') {
    const next = new Date(from);
    next.setHours(hour, min, 0, 0);
    if (next.getTime() <= fromMs) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  if (r === 'weekly') {
    const targetDow = cfg.scheduleDayOfWeek ?? 1;
    const next = new Date(from);
    next.setHours(hour, min, 0, 0);
    const currentDow = next.getDay();
    let diff = targetDow - currentDow;
    if (diff < 0 || (diff === 0 && next.getTime() <= fromMs)) diff += 7;
    next.setDate(next.getDate() + diff);
    return next.toISOString();
  }

  return undefined;
};

/** Should we trigger a sync right now? */
export const shouldRunSyncNow = (cfg: SharePointConfig, nowMs: number = Date.now()): boolean => {
  if (!cfg.enabled) return false;
  if (cfg.scheduleRecurrence === 'off' || cfg.scheduleRecurrence === 'manual') return false;
  if (!cfg.nextSyncAt) return false;
  return new Date(cfg.nextSyncAt).getTime() <= nowMs;
};
