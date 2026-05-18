/**
 * AI-assisted bulk project import from spreadsheet files.
 *
 * Flow:
 *  1. parseSpreadsheet(file) reads xlsx/csv via SheetJS into a sheet preview
 *     (headers + rows as plain objects).
 *  2. extractProjectsFromSheet(...) calls the local LLM with the sheet contents
 *     and asks it to (a) detect whether each row is a project or whether rows
 *     should be grouped, (b) return a clean array of structured project drafts.
 *  3. The UI lets the user toggle / edit drafts before bulk-creating them with
 *     botCreated = true.
 */
import * as XLSX from 'xlsx';
import { LlmConfig, Project, ProjectStatus, InnovationStatus, DevStatus, ProjectRole } from '../types';
import { runPrompt } from './llmService';
import { generateId } from './storage';

export interface SheetPreview {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[]; // up to 200 rows
  totalRowCount: number;
}

export interface ExtractedProjectDraft {
  name: string;
  description: string;
  status: ProjectStatus;
  innovationStatus?: InnovationStatus;
  devStatus?: DevStatus;
  manager: string;        // free-text from sheet — to be matched / left blank
  startDate: string;      // ISO YYYY-MM-DD or empty
  deadline: string;       // ISO YYYY-MM-DD or empty
  budget?: number;
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
  sourceRows: number[];   // 1-based row indices from the sheet
  // UI-side
  include: boolean;
}

export interface ExtractionResult {
  structure: string;
  structureNote: string;
  projects: ExtractedProjectDraft[];
}

const MAX_PREVIEW_ROWS = 200;

export const parseSpreadsheet = async (file: File): Promise<SheetPreview> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('No sheet found in workbook.');
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false, // strings — dates already formatted thanks to cellDates
  });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  return {
    sheetName,
    headers,
    rows: json.slice(0, MAX_PREVIEW_ROWS),
    totalRowCount: json.length,
  };
};

const PROMPT_TEMPLATE = `You are a senior portfolio management assistant. A user has uploaded a spreadsheet that should contain a list of projects. Your job is to extract clean, structured project data.

TODAY: {{TODAY}}

SHEET NAME: {{SHEET}}
HEADERS: {{HEADERS}}
ROWS ({{ROW_COUNT}} total, JSON):
{{ROWS}}

Analyse carefully:
1. Determine if EACH row represents a distinct project, OR if rows describe phases, tasks or milestones of fewer projects (in which case group them).
2. Extract the maximum reliable information for each project. Do NOT invent facts.

Common header mappings:
- name: "name", "project", "project name", "title"
- description: "description", "summary", "context", "objective"
- status: "status", "state" → map to one of: Idea, Active, On Hold, Done, Cancelled
- innovationStatus: "innovation", "maturity", "stage" → poc | pilot | prod
- devStatus: "dev", "workflow", "phase" → to_start | dev | uat | prod
- manager: "owner", "PM", "manager", "lead", "responsible"
- startDate, deadline: "start", "begin", "end", "due", "deadline"
- budget: "budget", "cost"
- tags: "tags", "category", "domain", "keywords"

Respond with ONLY a valid JSON object (no markdown fences, no commentary):
{
  "structure": "one_row_per_project | grouped_by_<column> | freeform",
  "structure_note": "1-sentence plain English explanation",
  "projects": [
    {
      "name": "string",
      "description": "string (1-2 sentences)",
      "status": "Idea|Active|On Hold|Done|Cancelled",
      "innovationStatus": "poc|pilot|prod" or null,
      "devStatus": "to_start|dev|uat|prod" or null,
      "manager": "string (full name from sheet, or empty)",
      "startDate": "YYYY-MM-DD or empty string",
      "deadline": "YYYY-MM-DD or empty string",
      "budget": number or null,
      "tags": ["string", ...],
      "confidence": "high|medium|low",
      "source_rows": [1-based row indices in the input]
    }
  ]
}

Rules:
- Be conservative: confidence=high only when at least name + description + (status OR dates) are clearly in the data.
- If a date is relative ("Q1 2026", "next sprint"), leave it empty.
- Default status to "Active" if unspecified but the row is clearly an in-flight project; "Idea" if it looks future / planned.
- Output ONLY the JSON object.`;

const stripFences = (s: string) =>
  s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();

export const extractProjectsFromSheet = async (
  preview: SheetPreview,
  config: LlmConfig
): Promise<ExtractionResult> => {
  const today = new Date().toISOString().slice(0, 10);
  // Bound prompt size: take a structured preview of up to 60 rows.
  const sample = preview.rows.slice(0, 60);
  const prompt = PROMPT_TEMPLATE
    .replace('{{TODAY}}', today)
    .replace('{{SHEET}}', preview.sheetName)
    .replace('{{HEADERS}}', JSON.stringify(preview.headers))
    .replace('{{ROW_COUNT}}', String(preview.totalRowCount))
    .replace('{{ROWS}}', JSON.stringify(sample, null, 2));

  const raw = await runPrompt(prompt, config);
  const cleaned = stripFences(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('The AI did not return valid JSON. Retry or check the LLM connection.');
    parsed = JSON.parse(match[0]);
  }

  const projects: ExtractedProjectDraft[] = (Array.isArray(parsed.projects) ? parsed.projects : []).map((p: any) => ({
    name: String(p.name || 'Untitled project').slice(0, 120),
    description: String(p.description || ''),
    status: ['Idea', 'Active', 'On Hold', 'Done', 'Cancelled'].includes(p.status) ? p.status : 'Active',
    innovationStatus: ['poc', 'pilot', 'prod'].includes(p.innovationStatus) ? p.innovationStatus : undefined,
    devStatus: ['to_start', 'dev', 'uat', 'prod'].includes(p.devStatus) ? p.devStatus : undefined,
    manager: String(p.manager || ''),
    startDate: typeof p.startDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.startDate) ? p.startDate.slice(0, 10) : '',
    deadline: typeof p.deadline === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.deadline) ? p.deadline.slice(0, 10) : '',
    budget: typeof p.budget === 'number' ? p.budget : undefined,
    tags: Array.isArray(p.tags) ? p.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
    confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'medium',
    sourceRows: Array.isArray(p.source_rows) ? p.source_rows.filter((n: any) => typeof n === 'number') : [],
    include: true,
  }));

  return {
    structure: String(parsed.structure || 'unknown'),
    structureNote: String(parsed.structure_note || ''),
    projects,
  };
};

export const buildProjectFromDraft = (
  draft: ExtractedProjectDraft,
  currentUser: { id: string; firstName: string; lastName: string },
  users: { id: string; firstName: string; lastName: string; email?: string }[]
): Project => {
  const today = new Date().toISOString();
  const todayDate = today.slice(0, 10);
  const fallbackDeadline = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  // Best-effort manager matching by name/email
  let managerId: string | undefined;
  if (draft.manager) {
    const m = draft.manager.toLowerCase().trim();
    const match = users.find((u) => {
      const full = `${u.firstName} ${u.lastName}`.toLowerCase();
      return full === m || full.includes(m) || m.includes(full) || (u.email || '').toLowerCase() === m;
    });
    managerId = match?.id;
  }

  return {
    id: generateId(),
    name: draft.name,
    description: draft.description,
    status: draft.status,
    devStatus: draft.devStatus,
    innovationStatus: draft.innovationStatus,
    managerId,
    startDate: draft.startDate || todayDate,
    deadline: draft.deadline || fallbackDeadline,
    initialDeadline: draft.deadline || fallbackDeadline,
    isImportant: false,
    isArchived: false,
    botCreated: true,
    budget: draft.budget ?? 0,
    confidentiality: 'internal',
    members: managerId
      ? [{ userId: managerId, role: ProjectRole.OWNER }]
      : [],
    tasks: [],
    milestones: [],
    technologyIds: [],
    repoIds: [],
    tags: draft.tags,
    auditLog: [
      {
        id: generateId(),
        date: today,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        action: 'AI bulk import',
        details: `Imported via AI from spreadsheet (confidence: ${draft.confidence}, source rows: ${draft.sourceRows.join(', ') || '—'})`,
      },
    ],
    createdAt: today,
    updatedAt: today,
  };
};
