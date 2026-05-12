import { LlmConfig, Project, User, AppState, WeeklyCheckIn } from '../types';

export const DEFAULT_PROMPTS: Record<string, string> = {
  portfolio_summary: `
You are NEXUS.AI, a Chief AI Officer's executive assistant.
Produce a concise, professional executive overview of the AI project portfolio.

DATA:
{{DATA}}

OUTPUT FORMAT (Markdown):
### Executive Summary
2–3 powerful sentences on portfolio health.

### Highlights
- 3 to 5 bullet points (use **Bold** for key wins/numbers).

### Risks & Attention Points
- Use **Bold** with "Alert", "Critical", "Warning" only when warranted.

### Strategic Recommendations
- 3 prioritized actions.

Tone: confident, factual, English only.
`,
  project_brief: `
You are a Senior Program Manager. Produce a clean project brief based on the data.

DATA:
{{DATA}}

OUTPUT FORMAT:
### Context
(short paragraph)

### Status
(RAG and reason)

### Key Deliverables
- list

### Risks & Mitigations
- list (only what is in data)

### Next Milestones
- list of upcoming dates

English. No hallucinations.
`,
  risk_assessment: `
You are a portfolio risk analyst. Identify and prioritize risks across the portfolio.

DATA:
{{DATA}}

OUTPUT FORMAT:
### Top Risks (ranked)
1. **<RISK>** — likelihood, impact, mitigation.
2. ...
3. ...

### Aggregated RAG
Green / Amber / Red counts and why.

English, factual, no fluff.
`,
  weekly_email: `
You are an executive assistant. Draft a professional weekly status email.

DATA:
{{DATA}}

OUTPUT (plain text email, ready to paste):
Subject: Weekly Update — {{TITLE}}

Hi team,
<2-sentence executive summary>

Accomplishments
- ...

Blockers
- ...

Next steps
- ...

Best,
{{AUTHOR}}
`,
  newsletter: `
You are a corporate communications specialist. Draft a broad-audience newsletter.

DATA:
{{DATA}}

OUTPUT (plain text email, friendly tone, no jargon):
Subject: {{TITLE}}

Hello everyone,
<paragraph framing>

Highlights
- ...

What's next
- ...

Call to action: ...
Best,
The NEXUS.AI team
`,
  exco_update: `
You are a senior consultant briefing the Executive Committee.

DATA:
{{DATA}}

OUTPUT:
Subject: [Exco] {{TITLE}}

Dear Exco,

Headline: <one strong sentence>.

Business impact / ROI:
- ...

Critical risks:
- ...

Asks:
- ...

Regards,
{{AUTHOR}}
`,
  weekly_consolidation: `
You are a manager consolidating weekly check-ins from your team.

SOURCE DATA:
{{DATA}}

TASK: Synthesize the input into one structured executive report. Group by project where possible.
Preserve "[Name]" attribution per bullet.

Sections: Highlights, Blockers, Next Steps, Risks.
English. No invention.
`,
  hackathon_synthesis: `
You are an innovation sprint facilitator producing a structured post-hackathon synthesis.

HACKATHON DATA:
{{DATA}}

OUTPUT FORMAT (Markdown):

### Mission Accomplished
2–3 sentences on whether the objective was met and what was achieved.

### Key Deliverables
- List concrete outputs, prototypes, or results (use **Bold** for names).

### Technical Highlights
- Technologies used, approaches taken, notable solutions.

### Lessons Learned
- What worked well, what could be improved.

### Recommendations & Next Steps
- Prioritized follow-up actions to take to production.

### User Guide Summary
A brief guide for anyone who wants to use/continue the hackathon output.

Tone: energetic, factual, forward-looking. English only.
`,
};

export const fillTemplate = (tpl: string, vars: Record<string, string>): string => {
  let out = tpl;
  for (const k of Object.keys(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), vars[k] ?? '');
  }
  return out;
};

const cleanLLMOutput = (s: string): string => {
  if (!s) return '';
  return s
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/```$/, '')
    .trim();
};

/* ===== Provider calls ===== */

const callOllama = async (prompt: string, config: LlmConfig): Promise<string> => {
  const url = `${(config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model || 'llama3', prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama: ${res.statusText}`);
  const data = await res.json();
  return data.response || '';
};

const callOpenAICompatible = async (prompt: string, config: LlmConfig): Promise<string> => {
  let url = config.baseUrl || 'http://localhost:8000/v1/chat/completions';
  if (!/\/chat\/completions$/.test(url)) {
    url = url.replace(/\/$/, '') + '/v1/chat/completions';
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model || 'local-model',
      messages: [
        { role: 'system', content: config.systemPrompt || '' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible: ${res.statusText}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.content || '';
};

const callN8n = async (prompt: string, config: LlmConfig): Promise<string> => {
  const url = config.baseUrl;
  if (!url) throw new Error('n8n webhook URL missing');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = config.apiKey;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model: config.model, timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`n8n: ${res.statusText}`);
  const data = await res.json();
  if (typeof data === 'string') return data;
  return data.output || data.text || data.response || data.content || JSON.stringify(data);
};

export const runPrompt = async (prompt: string, config: LlmConfig): Promise<string> => {
  try {
    let raw = '';
    switch (config.provider) {
      case 'ollama':
        raw = await callOllama(prompt, config);
        break;
      case 'openai_compatible':
        raw = await callOpenAICompatible(prompt, config);
        break;
      case 'n8n':
        raw = await callN8n(prompt, config);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
    return cleanLLMOutput(raw);
  } catch (e: any) {
    throw new Error(`AI generation failed (${config.provider}): ${e.message}`);
  }
};

export const testConnection = async (config: LlmConfig): Promise<{ ok: boolean; models?: string[]; message: string }> => {
  try {
    if (config.provider === 'ollama') {
      const url = `${(config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/tags`;
      const res = await fetch(url);
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      return { ok: true, models, message: `Online. ${models.length} models.` };
    }
    if (config.provider === 'openai_compatible') {
      const base = (config.baseUrl || '').replace(/\/chat\/completions$/, '').replace(/\/$/, '');
      const res = await fetch(`${base}/v1/models`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const data = await res.json();
      const models = (data.data || []).map((m: any) => m.id);
      return { ok: true, models, message: `Online. ${models.length} models.` };
    }
    // n8n: just send a ping
    await callN8n('ping', config);
    return { ok: true, message: 'Webhook reachable.' };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
};

/* ===== High-level builders ===== */

const fmt = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export const buildPortfolioSummaryData = (state: AppState): string => {
  const lines: string[] = [];
  lines.push(`PORTFOLIO: ${state.projects.length} projects | ${state.users.length} contributors`);
  state.projects.forEach((p) => {
    const pm = state.users.find((u) => u.id === p.managerId);
    const tasks = p.tasks || [];
    const done = tasks.filter((t) => t.status === 'Done').length;
    lines.push(
      `- [${p.name}] status=${p.status} owner=${pm ? pm.firstName + ' ' + pm.lastName : 'N/A'} ` +
        `deadline=${fmt(p.deadline)} tasks=${done}/${tasks.length} blocked=${tasks.filter((t) => t.status === 'Blocked').length}`
    );
  });
  return lines.join('\n');
};

export const buildProjectBriefData = (project: Project, users: User[]): string => {
  const pm = users.find((u) => u.id === project.managerId);
  const lines: string[] = [];
  lines.push(`PROJECT: ${project.name}`);
  lines.push(`Description: ${project.description}`);
  lines.push(`Status: ${project.status}`);
  lines.push(`Owner: ${pm ? `${pm.firstName} ${pm.lastName}` : 'Unassigned'}`);
  lines.push(`Deadline: ${fmt(project.deadline)}`);
  lines.push(`Members: ${project.members.length}`);
  lines.push('Tasks:');
  (project.tasks || []).forEach((t) => {
    const a = users.find((u) => u.id === t.assigneeId);
    lines.push(`- "${t.title}" [${t.status}/${t.priority}] eta=${fmt(t.currentEta || t.originalEta)} assignee=${a ? a.firstName : '—'}`);
  });
  lines.push('Milestones:');
  (project.milestones || []).forEach((m) => lines.push(`- ${m.label} due=${fmt(m.date)} done=${m.done}`));
  return lines.join('\n');
};

export const buildWeeklyCheckInData = (checkIns: WeeklyCheckIn[], users: User[]): string => {
  return checkIns
    .map((c) => {
      const u = users.find((x) => x.id === c.userId);
      return `[${u ? u.firstName + ' ' + u.lastName : 'Unknown'}] mood=${c.mood}\n` +
        `Accomplishments: ${c.accomplishments}\nBlockers: ${c.blockers}\nNext: ${c.nextSteps}`;
    })
    .join('\n\n');
};
