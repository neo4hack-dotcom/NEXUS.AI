/* === Export helpers === */
/* PDF: opens a self-contained print window styled for paper.
   EML: builds an RFC-822 .eml file the user can double-click to open in Outlook. */

import { AppState, Hackathon, Project, ProjectStatus } from '../types';

export const exportEML = (subject: string, body: string, recipients: string[]): void => {
  const safeSubj = (subject || 'DOINg.AI Update').replace(/[\r\n]+/g, ' ').trim();
  const to = recipients.filter(Boolean).join(',');

  const eml = [
    `To: ${to}`,
    `Subject: ${safeSubj}`,
    `X-Unsent: 1`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join('\r\n');

  const blob = new Blob([eml], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeSubj.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60)}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const esc = (s: string): string =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const renderMarkdownLite = (md: string): string => {
  let html = esc(md);
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n)?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n{2,}/g, '</p><p>');
  return `<p>${html}</p>`;
};

export const exportPDF = (title: string, sections: { heading: string; body: string }[]): void => {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) {
    alert('Allow pop-ups to export PDF.');
    return;
  }
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sectionHtml = sections
    .map(
      (s) => `
      <section class="print-section">
        <h2>${esc(s.heading)}</h2>
        <div class="body">${renderMarkdownLite(s.body || '')}</div>
      </section>
    `
    )
    .join('');

  w.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${esc(title)}</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0a0a0b; background: #fff; font-size: 11pt; line-height: 1.55; margin: 0; }
      header { border-bottom: 4px solid #FF3E00; padding-bottom: 12pt; margin-bottom: 24pt; display: flex; align-items: flex-end; justify-content: space-between; }
      .brand { font-weight: 900; font-size: 28pt; letter-spacing: -0.04em; text-transform: uppercase; line-height: 0.9; }
      .brand .dot { color: #FF3E00; }
      .meta { text-align: right; color: #555; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 { font-size: 22pt; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase; }
      h2 { font-size: 14pt; margin-top: 22pt; border-left: 3px solid #FF3E00; padding-left: 10pt; }
      h3 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.1em; color: #FF3E00; margin-bottom: 4pt; }
      .body p { margin: 6pt 0; }
      .body ul { padding-left: 18pt; }
      .body li { margin: 3pt 0; }
      section.print-section { break-inside: avoid; margin-bottom: 18pt; }
      footer { position: fixed; bottom: 8mm; left: 16mm; right: 16mm; color: #888; font-size: 8pt; text-align: center; border-top: 1px solid #ddd; padding-top: 6pt; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <div class="brand">DOINg<span class="dot">.AI</span></div>
        <h1 style="margin-top:8pt">${esc(title)}</h1>
      </div>
      <div class="meta"><div>Confidential</div><div>${today}</div></div>
    </header>
    ${sectionHtml}
    <footer>DOINg.AI • AI Project Operations Platform</footer>
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
  </body>
</html>`);
  w.document.close();
};

/* ====================================================================
   BEAUTIFUL COMMUNICATION PDF — type-specific layouts
   ==================================================================== */

const BRAND = '#FF3E00';
const COL_GREEN = '#22c55e';
const COL_AMBER = '#f59e0b';
const COL_RED = '#ef4444';
const COL_BLUE = '#3b82f6';

const ragColor = (rag: string) =>
  rag === 'green' ? COL_GREEN : rag === 'amber' ? COL_AMBER : COL_RED;

const kpiTile = (label: string, value: number | string, color: string, subtitle = '') => `
  <div style="border:1px solid #e5e7eb;border-top:3px solid ${color};padding:14px 16px;background:#fff">
    <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;font-family:system-ui">${esc(label)}</div>
    <div style="font-size:26pt;font-weight:900;line-height:1;margin-top:6px;color:${color};font-family:system-ui">${value}</div>
    ${subtitle ? `<div style="font-size:7.5pt;color:#aaa;margin-top:4px;font-family:system-ui">${esc(subtitle)}</div>` : ''}
  </div>`;

const donutChart = (green: number, amber: number, red: number, centerLabel: string) => {
  const total = green + amber + red || 1;
  const C = 2 * Math.PI * 28;
  const seg = (count: number, color: string, startFraction: number) => {
    const f = count / total;
    const arc = f * C;
    if (arc < 0.5) return '';
    const rot = startFraction * 360 - 90;
    return `<circle cx="35" cy="35" r="28" fill="none" stroke="${color}" stroke-width="10"
      stroke-dasharray="${arc.toFixed(2)} ${(C - arc).toFixed(2)}"
      transform="rotate(${rot.toFixed(2)} 35 35)"/>`;
  };
  const gf = green / total;
  const af = amber / total;
  return `<svg viewBox="0 0 70 70" width="100" height="100" style="display:block">
    <circle cx="35" cy="35" r="28" fill="none" stroke="#e5e7eb" stroke-width="10"/>
    ${seg(green, COL_GREEN, 0)}
    ${seg(amber, COL_AMBER, gf)}
    ${seg(red, COL_RED, gf + af)}
    <text x="35" y="31" text-anchor="middle" font-size="14" font-weight="900" fill="#111" font-family="system-ui">${green + amber + red}</text>
    <text x="35" y="43" text-anchor="middle" font-size="7" fill="#888" font-family="system-ui">${esc(centerLabel)}</text>
  </svg>`;
};

const ragLegendRow = (color: string, label: string, count: number, total: number) => `
  <div style="display:flex;align-items:center;gap:8px;margin:5px 0">
    <div style="width:10px;height:10px;background:${color};border-radius:50%;flex-shrink:0"></div>
    <div style="flex:1;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.08em;font-family:system-ui">${esc(label)}</div>
    <div style="font-size:10pt;font-weight:900;font-family:system-ui">${count}</div>
    <div style="font-size:7.5pt;color:#aaa;font-family:system-ui;width:36px;text-align:right">${total ? Math.round((count / total) * 100) : 0}%</div>
  </div>`;

const progressBar = (pct: number, color: string) =>
  `<div style="background:#eee;height:5px;border-radius:2px;overflow:hidden;margin-top:3px">
    <div style="width:${Math.min(100, Math.round(pct))}%;height:100%;background:${color}"></div>
  </div>`;

const projectCard = (name: string, status: string, rag: string, deadline: string, reason: string) => `
  <div style="border:1px solid ${ragColor(rag)}30;border-left:4px solid ${ragColor(rag)};padding:10px 12px;page-break-inside:avoid;background:#fff">
    <div style="font-size:8.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;font-family:system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
      <span style="background:${ragColor(rag)}18;color:${ragColor(rag)};font-size:7pt;font-weight:700;text-transform:uppercase;padding:2px 7px;border-radius:2px;font-family:system-ui">${esc(rag.toUpperCase())}</span>
      <span style="font-size:7pt;color:#999;font-family:system-ui">${esc(deadline)}</span>
    </div>
    ${reason ? `<div style="margin-top:5px;font-size:7pt;color:#777;font-family:system-ui">${esc(reason)}</div>` : ''}
    <div style="margin-top:6px;font-size:7pt;color:#bbb;font-family:system-ui;text-transform:uppercase;letter-spacing:0.08em">${esc(status)}</div>
  </div>`;

const sectionHeader = (title: string, accent = BRAND) =>
  `<div style="border-left:4px solid ${accent};padding-left:12px;margin:20px 0 12px">
    <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.18em;color:#aaa;font-weight:700;font-family:system-ui">DOINg.AI</div>
    <div style="font-size:14pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;font-family:system-ui">${esc(title)}</div>
  </div>`;

const pdfHeader = (
  reportType: string,
  title: string,
  subtitle: string,
  accentColor: string
) => {
  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `
  <div style="padding-bottom:16px;margin-bottom:24px;border-bottom:3px solid ${accentColor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:9pt;font-weight:900;text-transform:uppercase;letter-spacing:0.22em;color:${accentColor};font-family:system-ui;margin-bottom:4px">${esc(reportType)}</div>
        <div style="font-size:26pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.03em;line-height:1;font-family:system-ui">${esc(title)}</div>
        ${subtitle ? `<div style="font-size:10pt;color:#777;margin-top:6px;font-family:system-ui">${esc(subtitle)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:22pt;font-weight:900;font-family:system-ui;color:#111">DOINg<span style="color:${accentColor}">.AI</span></div>
        <div style="font-size:8pt;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;font-family:system-ui;margin-top:2px">Confidential</div>
        <div style="font-size:8pt;color:#888;font-family:system-ui;margin-top:2px">${today}</div>
      </div>
    </div>
  </div>`;
};

const pdfFooter = (type: string) =>
  `<div style="position:fixed;bottom:8mm;left:16mm;right:16mm;color:#bbb;font-size:7.5pt;text-align:center;border-top:1px solid #e5e7eb;padding-top:6px;font-family:system-ui">
    DOINg.AI • AI Project Operations Platform • ${esc(type)} Report
  </div>`;

const PDF_BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #0a0a0b; background: #fff; font-size: 10pt; line-height: 1.5; }
  p { margin: 5pt 0; }
  ul { padding-left: 18pt; } li { margin: 3pt 0; }
  h1 { font-size: 18pt; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; margin: 0 0 8pt; }
  h2 { font-size: 12pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 14pt 0 6pt; color: #111; }
  h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.1em; color: #FF3E00; margin: 10pt 0 4pt; }
  strong { font-weight: 700; }
  .ai-content p { margin: 5pt 0; }
  .ai-content ul { padding-left: 16pt; }
  .ai-content li { margin: 2pt 0; }
`;

export const wrapHtmlDoc = (
  title: string,
  body: string,
  landscape = false,
  autoprint = false
): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  <style>
    @page { size: A4${landscape ? ' landscape' : ''}; margin: 15mm 16mm 20mm; }
    ${PDF_BASE_STYLES}
    /* Screen preview: fluid, readable at any viewport */
    @media screen {
      html { font-size: 11px; }
      body { max-width: 100%; overflow-x: hidden; padding: 16px 20px; margin: 0 auto; }
      * { max-width: 100%; word-break: break-word; }
      table { table-layout: fixed; width: 100%; }
      svg { max-width: 100%; height: auto; }
      div[style*="grid-template-columns"] { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
      div[style*="grid-template-columns"] > * { flex: 1 1 120px !important; min-width: 0 !important; }
    }
  </style>
</head>
<body>
  ${body}
  ${autoprint ? `<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>` : ''}
</body>
</html>`;

const openPrintWindow = (title: string, body: string): void => {
  const w = window.open('', '_blank', 'width=960,height=1200');
  if (!w) { alert('Allow pop-ups to export PDF.'); return; }
  w.document.write(wrapHtmlDoc(title, body, false, true));
  w.document.close();
};

/* --- Weekly Status Report --- */
const buildWeeklyBody = (title: string, content: string, state: AppState): string => {
  const projects = state.projects.filter((p) => !p.isArchived);
  const now = Date.now();

  const scored = projects.map((p) => {
    const tasks = p.tasks || [];
    const overdue = new Date(p.deadline).getTime() < now && p.status !== 'Done';
    const blocked = tasks.filter((t) => t.status === 'Blocked').length;
    const lateTasks = tasks.filter(
      (t) => t.status !== 'Done' && new Date((t.currentEta || t.originalEta) ?? 0).getTime() < now
    ).length;
    let rag = 'green';
    if (overdue || blocked > 2) rag = 'red';
    else if (lateTasks > 0 || blocked > 0) rag = 'amber';
    const reasons: string[] = [];
    if (overdue) reasons.push('Past deadline');
    else if (blocked > 2) reasons.push(`${blocked} blocked tasks`);
    else if (lateTasks > 0) reasons.push(`${lateTasks} late tasks`);
    else if (blocked > 0) reasons.push(`${blocked} blocked`);
    return { p, rag, reason: reasons[0] || '' };
  });

  const counts = {
    green: scored.filter((s) => s.rag === 'green').length,
    amber: scored.filter((s) => s.rag === 'amber').length,
    red: scored.filter((s) => s.rag === 'red').length,
  };
  const total = scored.length;

  // Team mood from latest weekly check-in per user
  const latestByUser: Record<string, string> = {};
  state.weeklyCheckIns.forEach((c) => {
    if (!latestByUser[c.userId] || c.weekOf > latestByUser[c.userId]) {
      latestByUser[c.userId] = c.mood;
    }
  });
  const moods = Object.values(latestByUser);
  const moodCounts = {
    green: moods.filter((m) => m === 'green').length,
    amber: moods.filter((m) => m === 'amber').length,
    red: moods.filter((m) => m === 'red').length,
  };

  const body = `
    ${pdfHeader('Weekly Status Report', esc(title || 'Portfolio Status'), `Week of ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, BRAND)}

    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${kpiTile('Total Projects', total, '#64748b')}
      ${kpiTile('Active', projects.filter((p) => p.status === 'Active').length, COL_BLUE)}
      ${kpiTile('Completed', projects.filter((p) => p.status === 'Done').length, COL_GREEN)}
      ${kpiTile('At Risk', counts.red + counts.amber, counts.red > 0 ? COL_RED : COL_AMBER)}
    </div>

    <!-- RAG + Mood row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- RAG distribution -->
      <div style="border:1px solid #e5e7eb;padding:16px">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:12px">Portfolio RAG Distribution</div>
        <div style="display:flex;align-items:center;gap:20px">
          ${donutChart(counts.green, counts.amber, counts.red, 'PROJECTS')}
          <div style="flex:1">
            ${ragLegendRow(COL_GREEN, 'On track', counts.green, total)}
            ${ragLegendRow(COL_AMBER, 'At risk', counts.amber, total)}
            ${ragLegendRow(COL_RED, 'Critical', counts.red, total)}
          </div>
        </div>
      </div>
      <!-- Team mood -->
      <div style="border:1px solid #e5e7eb;padding:16px">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:12px">Team Mood (Latest Check-ins)</div>
        <div style="display:flex;align-items:center;gap:20px">
          ${donutChart(moodCounts.green, moodCounts.amber, moodCounts.red, 'MEMBERS')}
          <div style="flex:1">
            ${ragLegendRow(COL_GREEN, 'Positive', moodCounts.green, moods.length)}
            ${ragLegendRow(COL_AMBER, 'Cautious', moodCounts.amber, moods.length)}
            ${ragLegendRow(COL_RED, 'Struggling', moodCounts.red, moods.length)}
          </div>
        </div>
      </div>
    </div>

    ${sectionHeader('Project Status')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
      ${scored
        .sort((a, b) => (a.rag === 'red' ? -1 : b.rag === 'red' ? 1 : a.rag === 'amber' ? -1 : 1))
        .map((s) =>
          projectCard(
            s.p.name,
            s.p.status,
            s.rag,
            new Date(s.p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            s.reason
          )
        )
        .join('')}
    </div>

    ${sectionHeader('Summary')}
    <div class="ai-content" style="border:1px solid #e5e7eb;padding:16px;background:#fafafa">
      ${renderMarkdownLite(content)}
    </div>

    ${pdfFooter('Weekly')}`;
  return body;
};
const buildWeeklyPDF = (t: string, c: string, s: AppState) =>
  openPrintWindow(`Weekly Status — ${t}`, buildWeeklyBody(t, c, s));

/* --- Newsletter --- */
const buildNewsletterBody = (title: string, content: string, state: AppState): string => {
  const projects = state.projects.filter((p) => !p.isArchived);
  const done = projects.filter((p) => p.status === 'Done').length;
  const active = projects.filter((p) => p.status === 'Active').length;
  const techs = state.technologies.slice(0, 8);

  // Total tasks completed vs total
  const allTasks = projects.flatMap((p) => p.tasks || []);
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;
  const taskPct = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0;

  const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body = `
    <!-- Hero header -->
    <div style="background:#0a0a0b;color:#fff;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;right:0;width:160px;height:160px;background:${BRAND};opacity:0.12;border-radius:50%;transform:translate(40px,-40px)"></div>
      <div style="position:absolute;bottom:0;right:60px;width:80px;height:80px;background:${BRAND};opacity:0.08;border-radius:50%;transform:translateY(30px)"></div>
      <div style="font-size:8pt;letter-spacing:0.28em;text-transform:uppercase;color:${BRAND};font-weight:700;font-family:system-ui;margin-bottom:8px">AI PROJECT PORTFOLIO NEWSLETTER</div>
      <div style="font-size:28pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.03em;line-height:1;font-family:system-ui">${esc(title || 'Portfolio Newsletter')}</div>
      <div style="font-size:9pt;color:#888;margin-top:8px;font-family:system-ui">${period} Edition</div>
      <div style="position:absolute;top:16px;right:32px;text-align:right">
        <div style="font-size:18pt;font-weight:900;font-family:system-ui">DOINg<span style="color:${BRAND}">.AI</span></div>
        <div style="font-size:7pt;color:#666;letter-spacing:0.1em;text-transform:uppercase;font-family:system-ui">Confidential</div>
      </div>
    </div>

    <!-- KPI tiles -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px">
      ${kpiTile('Portfolio Projects', projects.length, BRAND, `${active} active`)}
      ${kpiTile('Completed', done, COL_GREEN, `${projects.length ? Math.round((done / projects.length) * 100) : 0}% of portfolio`)}
      ${kpiTile('Technologies', state.technologies.length, COL_BLUE, 'in stack')}
      ${kpiTile('Task Progress', `${taskPct}%`, taskPct >= 70 ? COL_GREEN : taskPct >= 40 ? COL_AMBER : COL_RED, `${doneTasks}/${allTasks.length} tasks done`)}
    </div>

    <!-- Two-column layout -->
    <div style="display:grid;grid-template-columns:1fr 280px;gap:20px">
      <!-- Main content -->
      <div>
        ${sectionHeader('Highlights & Updates', BRAND)}
        <div class="ai-content" style="border:1px solid #e5e7eb;padding:16px;background:#fafafa;margin-bottom:16px">
          ${renderMarkdownLite(content)}
        </div>
      </div>

      <!-- Sidebar -->
      <div>
        ${sectionHeader('Active Projects', COL_BLUE)}
        <div style="space-y:6px">
          ${projects
            .filter((p) => p.status === 'Active')
            .slice(0, 8)
            .map((p) => {
              const tasks = p.tasks || [];
              const pct = tasks.length
                ? Math.round((tasks.filter((t) => t.status === 'Done').length / tasks.length) * 100)
                : 0;
              return `<div style="margin-bottom:10px">
                <div style="font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-family:system-ui">${esc(p.name)}</div>
                ${progressBar(pct, COL_BLUE)}
                <div style="font-size:7pt;color:#999;margin-top:2px;font-family:system-ui">${pct}% complete • Due ${new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
              </div>`;
            })
            .join('')}
          ${projects.filter((p) => p.status === 'Active').length === 0
            ? '<div style="font-size:8pt;color:#aaa;font-style:italic;font-family:system-ui">No active projects.</div>'
            : ''}
        </div>

        <div style="margin-top:20px">
          ${sectionHeader('Technology Stack', '#6366f1')}
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
            ${techs
              .map(
                (t) => `<span style="background:#f1f5f9;border:1px solid #e2e8f0;padding:3px 8px;
                  font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
                  font-family:system-ui;color:#475569;border-radius:2px">${esc(t.name)}</span>`
              )
              .join('')}
            ${state.technologies.length > 8 ? `<span style="font-size:7pt;color:#aaa;font-family:system-ui;align-self:center">+${state.technologies.length - 8} more</span>` : ''}
          </div>
        </div>
      </div>
    </div>

    ${pdfFooter('Newsletter')}`;
  return body;
};
const buildNewsletterPDF = (t: string, c: string, s: AppState) =>
  openPrintWindow(`Newsletter — ${t}`, buildNewsletterBody(t, c, s));

/* --- Executive Brief --- */
const buildExcoBody = (title: string, content: string, state: AppState): string => {
  const projects = state.projects.filter((p) => !p.isArchived);
  const now = Date.now();

  const scored = projects.map((p) => {
    const tasks = p.tasks || [];
    const overdue = new Date(p.deadline).getTime() < now && p.status !== 'Done';
    const blocked = tasks.filter((t) => t.status === 'Blocked').length;
    const lateTasks = tasks.filter(
      (t) => t.status !== 'Done' && new Date((t.currentEta || t.originalEta) ?? 0).getTime() < now
    ).length;
    let rag = 'green';
    if (overdue || blocked > 2) rag = 'red';
    else if (lateTasks > 0 || blocked > 0) rag = 'amber';
    const reasons: string[] = [];
    if (overdue) reasons.push('Past deadline');
    else if (blocked > 2) reasons.push(`${blocked} blocked tasks`);
    else if (lateTasks > 0) reasons.push(`${lateTasks} late tasks`);
    else if (blocked > 0) reasons.push(`${blocked} blocked`);
    return { p, rag, reason: reasons[0] || '' };
  });

  const counts = {
    green: scored.filter((s) => s.rag === 'green').length,
    amber: scored.filter((s) => s.rag === 'amber').length,
    red: scored.filter((s) => s.rag === 'red').length,
  };

  const allTasks = projects.flatMap((p) => p.tasks || []);
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;
  const blockedTasks = allTasks.filter((t) => t.status === 'Blocked').length;
  const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Split content at a natural break for exec summary vs detail
  const lines = content.split('\n');
  const splitIdx = Math.min(lines.findIndex((l) => l.startsWith('## ') && lines.indexOf(l) > 2), 12);
  const summaryPart = splitIdx > 0 ? lines.slice(0, splitIdx).join('\n') : content.slice(0, 600);
  const detailPart = splitIdx > 0 ? lines.slice(splitIdx).join('\n') : content.slice(600);

  const body = `
    ${pdfHeader('Executive Portfolio Brief', esc(title || 'Executive Update'), period, '#1e1b4b')}

    <!-- Executive summary strip -->
    <div style="background:#1e1b4b;color:#fff;padding:16px 20px;margin-bottom:20px;border-left:4px solid ${BRAND}">
      <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.18em;color:${BRAND};font-weight:700;font-family:system-ui;margin-bottom:8px">Executive Summary</div>
      <div class="ai-content" style="font-size:9.5pt;line-height:1.55;color:#e2e8f0;font-family:system-ui">
        ${renderMarkdownLite(summaryPart || content.slice(0, 500))}
      </div>
    </div>

    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px">
      ${kpiTile('Portfolio Size', projects.length, '#1e1b4b', 'total projects')}
      ${kpiTile('Health Score', counts.green > 0 ? `${Math.round((counts.green / (scored.length || 1)) * 100)}%` : '—', counts.red > 0 ? COL_RED : counts.amber > 0 ? COL_AMBER : COL_GREEN, `${counts.green} on track`)}
      ${kpiTile('Task Completion', `${allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0}%`, COL_BLUE, `${doneTasks}/${allTasks.length} tasks`)}
      ${kpiTile('Blockers', blockedTasks, blockedTasks > 0 ? COL_RED : COL_GREEN, 'active blockers')}
    </div>

    <!-- Risk matrix -->
    ${sectionHeader('Portfolio Risk Matrix', '#1e1b4b')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-family:system-ui;font-size:8.5pt">
      <thead>
        <tr style="background:#1e1b4b;color:#fff">
          <th style="text-align:left;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Project</th>
          <th style="text-align:center;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Status</th>
          <th style="text-align:center;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">RAG</th>
          <th style="text-align:left;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Risk Factor</th>
          <th style="text-align:right;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Deadline</th>
        </tr>
      </thead>
      <tbody>
        ${scored
          .sort((a, b) => (a.rag === 'red' ? -1 : b.rag === 'red' ? 1 : a.rag === 'amber' ? -1 : 1))
          .map(
            (s, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-bottom:1px solid #e5e7eb">
            <td style="padding:7px 12px;font-weight:700">${esc(s.p.name)}</td>
            <td style="padding:7px 12px;text-align:center;color:#666;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.06em">${esc(s.p.status)}</td>
            <td style="padding:7px 12px;text-align:center">
              <span style="background:${ragColor(s.rag)}20;color:${ragColor(s.rag)};font-weight:700;font-size:7pt;text-transform:uppercase;padding:2px 8px;border-radius:2px">${s.rag.toUpperCase()}</span>
            </td>
            <td style="padding:7px 12px;color:#666;font-size:7.5pt">${esc(s.reason || 'On track')}</td>
            <td style="padding:7px 12px;text-align:right;color:#888;font-size:7.5pt">${new Date(s.p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    ${detailPart ? `
    ${sectionHeader('Recommendations & Actions', BRAND)}
    <div class="ai-content" style="border:1px solid #e5e7eb;padding:16px;background:#fafafa">
      ${renderMarkdownLite(detailPart)}
    </div>` : ''}

    ${pdfFooter('Executive Brief')}`;
  return body;
};
const buildExcoPDF = (t: string, c: string, s: AppState) =>
  openPrintWindow(`Executive Brief — ${t}`, buildExcoBody(t, c, s));

export const exportCommunicationPDF = (
  type: 'weekly' | 'newsletter' | 'exco' | 'info',
  title: string,
  content: string,
  state: AppState
): void => {
  if (type === 'weekly') buildWeeklyPDF(title, content, state);
  else if (type === 'newsletter') buildNewsletterPDF(title, content, state);
  else if (type === 'exco') buildExcoPDF(title, content, state);
  else buildInfoPDF(title, content, state);
};

export const buildCommunicationHTML = (
  type: string,
  title: string,
  content: string,
  state: AppState,
  landscape = false
): string => {
  let body = '';
  if (type === 'weekly') body = buildWeeklyBody(title, content, state);
  else if (type === 'newsletter') body = buildNewsletterBody(title, content, state);
  else if (type === 'exco') body = buildExcoBody(title, content, state);
  else body = buildInfoBody(title, content, state);
  return wrapHtmlDoc(title || 'Communication', body, landscape, false);
};

/* --- Info / general PDF --- */
const buildInfoBody = (title: string, content: string, state: AppState): string => {
  const projects = state.projects.filter((p) => !p.isArchived);
  return `
    ${pdfHeader('Information Note', esc(title || 'Note'), new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), COL_BLUE)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px">
      ${kpiTile('Projects', projects.length, COL_BLUE)}
      ${kpiTile('Team Size', state.users.length, BRAND, 'contributors')}
      ${kpiTile('Technologies', state.technologies.length, '#8b5cf6', 'in stack')}
    </div>
    ${sectionHeader('Content', COL_BLUE)}
    <div class="ai-content" style="border:1px solid #e5e7eb;padding:16px;background:#fafafa">
      ${renderMarkdownLite(content)}
    </div>
    ${pdfFooter('Info')}`;
};
const buildInfoPDF = (t: string, c: string, s: AppState) =>
  openPrintWindow(`Info — ${t}`, buildInfoBody(t, c, s));

/* ===== Hackathon Candidate Kit PDF ===== */

export const exportHackathonCandidatePDF = (hackathon: Hackathon, state: AppState): void => {
  const startFmt = new Date(hackathon.startDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const endFmt = new Date(hackathon.endDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const durationMs = new Date(hackathon.endDate).getTime() - new Date(hackathon.startDate).getTime();
  const durationDays = Math.ceil(durationMs / 86400000);

  // Role distribution
  const roleCounts: Record<string, number> = {};
  hackathon.participants.forEach((p) => {
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  });

  // Linked repos from projects that reference this hackathon (by tag or id)
  // We surface the state.repositories for linking
  const allRepos = state.repositories || [];

  // Documents by type
  const briefs = hackathon.documents.filter((d) => d.type === 'brief');
  const guides = hackathon.documents.filter((d) => d.type === 'guide');
  const resources = hackathon.documents.filter((d) => d.type === 'resource');

  const roleColors: Record<string, string> = {
    dev: '#3b82f6', sme: '#f97316', expert: '#8b5cf6',
    pm: '#22c55e', designer: '#ec4899', other: '#94a3b8',
  };
  const roleLabel: Record<string, string> = {
    dev: 'Developer', sme: 'Subject Matter Expert', expert: 'Technical Expert',
    pm: 'Project Manager', designer: 'Designer', other: 'Other',
  };

  const statusColor: Record<string, string> = {
    upcoming: '#3b82f6', active: '#FF3E00', completed: '#22c55e', archived: '#94a3b8',
  };

  const participantRows = hackathon.participants.map((p) => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-weight:700;font-family:system-ui;font-size:9pt">${esc(p.name)}</td>
      <td style="padding:8px 12px;font-family:system-ui;font-size:8.5pt">
        <span style="background:${roleColors[p.role] || '#94a3b8'}18;color:${roleColors[p.role] || '#94a3b8'};padding:2px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">${roleLabel[p.role] || p.role}</span>
      </td>
      <td style="padding:8px 12px;color:#666;font-family:system-ui;font-size:8.5pt">${esc(p.team || '—')}</td>
      <td style="padding:8px 12px;color:#666;font-family:system-ui;font-size:8.5pt">${esc(p.email || '—')}</td>
      <td style="padding:8px 12px;color:#888;font-family:system-ui;font-size:8pt">${esc(p.expertise || '—')}</td>
    </tr>`).join('');

  const docSection = (docs: typeof hackathon.documents, label: string, color: string) =>
    docs.length === 0 ? '' : `
    <div style="margin-bottom:16px">
      <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:0.14em;color:${color};font-family:system-ui;margin-bottom:8px;border-left:3px solid ${color};padding-left:8px">${esc(label)}</div>
      ${docs.map((d) => `
        <div style="border:1px solid #e5e7eb;padding:12px 14px;margin-bottom:6px;page-break-inside:avoid">
          <div style="font-size:9.5pt;font-weight:700;font-family:system-ui;margin-bottom:4px">${esc(d.title)}</div>
          ${d.content ? `<div style="font-size:8.5pt;color:#666;font-family:system-ui;white-space:pre-line;line-height:1.5">${esc(d.content.slice(0, 600))}${d.content.length > 600 ? '…' : ''}</div>` : ''}
        </div>`).join('')}
    </div>`;

  const repoSection = allRepos.length === 0 ? '' : `
    ${sectionHeader('Code Repositories & Tools', '#1e1b4b')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px">
      ${allRepos.slice(0, 12).map((r) => `
        <div style="border:1px solid #e5e7eb;padding:10px 12px;page-break-inside:avoid">
          <div style="font-size:9pt;font-weight:700;font-family:system-ui">${esc(r.name)}</div>
          <div style="font-size:7.5pt;color:#888;font-family:system-ui;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.url)}</div>
          ${r.description ? `<div style="font-size:8pt;color:#666;margin-top:4px;font-family:system-ui">${esc(r.description.slice(0, 80))}</div>` : ''}
        </div>`).join('')}
    </div>`;

  const tagsHtml = hackathon.tags.length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        ${hackathon.tags.map((t) => `<span style="background:#f1f5f9;border:1px solid #e2e8f0;padding:3px 10px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;font-family:system-ui;color:#475569">${esc(t)}</span>`).join('')}
       </div>` : '';

  const body = `
    <!-- Hero -->
    <div style="background:#0a0a0b;color:#fff;padding:36px 40px;margin-bottom:28px;position:relative;overflow:hidden;page-break-inside:avoid">
      <div style="position:absolute;top:-20px;right:-20px;width:200px;height:200px;background:${statusColor[hackathon.status] || BRAND};opacity:0.08;border-radius:50%"></div>
      <div style="position:absolute;bottom:-30px;left:30%;width:120px;height:120px;background:${BRAND};opacity:0.05;border-radius:50%"></div>
      <div style="font-size:8pt;letter-spacing:0.28em;text-transform:uppercase;color:${statusColor[hackathon.status] || BRAND};font-weight:700;font-family:system-ui;margin-bottom:6px">
        DOINg.AI — HACKATHON CANDIDATE KIT
      </div>
      <div style="font-size:32pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.03em;line-height:1;font-family:system-ui;margin-bottom:10px">${esc(hackathon.title)}</div>
      ${hackathon.theme ? `<div style="font-size:13pt;color:#aaa;font-family:system-ui;margin-bottom:12px;font-style:italic">${esc(hackathon.theme)}</div>` : ''}
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:16px">
        <div>
          <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.14em;color:#666;font-family:system-ui">Start</div>
          <div style="font-size:10pt;font-weight:700;font-family:system-ui;color:#fff">${startFmt}</div>
        </div>
        <div>
          <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.14em;color:#666;font-family:system-ui">End</div>
          <div style="font-size:10pt;font-weight:700;font-family:system-ui;color:#fff">${endFmt}</div>
        </div>
        <div>
          <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.14em;color:#666;font-family:system-ui">Duration</div>
          <div style="font-size:10pt;font-weight:700;font-family:system-ui;color:#fff">${durationDays} day${durationDays !== 1 ? 's' : ''}</div>
        </div>
        ${hackathon.location ? `<div>
          <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.14em;color:#666;font-family:system-ui">Location</div>
          <div style="font-size:10pt;font-weight:700;font-family:system-ui;color:#fff">${esc(hackathon.location)}</div>
        </div>` : ''}
        <div>
          <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.14em;color:#666;font-family:system-ui">Participants</div>
          <div style="font-size:10pt;font-weight:700;font-family:system-ui;color:#fff">${hackathon.participants.length}</div>
        </div>
      </div>
    </div>

    <!-- Mission & Objective -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="border:1px solid #e5e7eb;border-top:3px solid ${BRAND};padding:18px 20px">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:8px">🎯 Objective</div>
        <div style="font-size:10pt;line-height:1.6;font-family:system-ui;color:#111">${esc(hackathon.objective || '—')}</div>
      </div>
      ${hackathon.challenge ? `
      <div style="border:1px solid #e5e7eb;border-top:3px solid #8b5cf6;padding:18px 20px">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:8px">⚡ Challenge</div>
        <div style="font-size:10pt;line-height:1.6;font-family:system-ui;color:#111">${esc(hackathon.challenge)}</div>
      </div>` : `
      <div style="border:1px solid #e5e7eb;padding:18px 20px;background:#f9fafb">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:8px">Team Composition</div>
        ${Object.entries(roleCounts).map(([role, count]) => `
          <div style="display:flex;align-items:center;gap:8px;margin:5px 0">
            <div style="width:8px;height:8px;background:${roleColors[role] || '#94a3b8'};border-radius:50%"></div>
            <span style="font-size:8.5pt;font-family:system-ui;flex:1">${roleLabel[role] || role}</span>
            <span style="font-size:10pt;font-weight:900;font-family:system-ui">${count}</span>
          </div>`).join('')}
      </div>`}
    </div>

    ${tagsHtml ? `<div style="margin-bottom:20px">${tagsHtml}</div>` : ''}

    <!-- Documents -->
    ${(briefs.length + guides.length + resources.length) > 0 ? `
    ${sectionHeader('Working Documents & Resources', '#3b82f6')}
    ${docSection(briefs, 'Project Brief', '#3b82f6')}
    ${docSection(guides, 'User Guides', '#22c55e')}
    ${docSection(resources, 'Resources', '#f97316')}
    ` : ''}

    <!-- Participants table -->
    ${hackathon.participants.length > 0 ? `
    ${sectionHeader('Team Roster', '#22c55e')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-family:system-ui;font-size:9pt">
      <thead>
        <tr style="background:#0a0a0b;color:#fff">
          <th style="text-align:left;padding:9px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Name</th>
          <th style="text-align:left;padding:9px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Role</th>
          <th style="text-align:left;padding:9px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Team</th>
          <th style="text-align:left;padding:9px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Contact</th>
          <th style="text-align:left;padding:9px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Expertise</th>
        </tr>
      </thead>
      <tbody>${participantRows}</tbody>
    </table>` : ''}

    ${repoSection}

    <!-- Results if available -->
    ${hackathon.results ? `
    ${sectionHeader('Results & Outcomes', '#FF3E00')}
    <div class="ai-content" style="border:1px solid #e5e7eb;border-left:4px solid ${BRAND};padding:16px 20px;background:#fafafa;margin-bottom:20px">
      ${renderMarkdownLite(hackathon.results)}
    </div>` : ''}

    <!-- AI synthesis if available -->
    ${hackathon.aiSynthesis ? `
    ${sectionHeader('AI Synthesis', '#8b5cf6')}
    <div class="ai-content" style="border:1px solid #e5e7eb;border-left:4px solid #8b5cf6;padding:16px 20px;background:#fafafa;margin-bottom:20px">
      ${renderMarkdownLite(hackathon.aiSynthesis)}
    </div>` : ''}

    ${pdfFooter('Hackathon Candidate Kit')}`;

  openPrintWindow(`${hackathon.title} — Candidate Kit`, body);
};

/* ===== Project Brief PDF ===== */

export const buildProjectHTML = (
  project: Project,
  state: AppState,
  aiSynthesis: string,
  landscape = false
): string => {
  const now = Date.now();
  const tasks = project.tasks || [];
  const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
  const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
  const progress = totalW ? Math.round((doneW / totalW) * 100) : 0;

  const taskCounts = {
    todo: tasks.filter((t) => t.status === 'To Do').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    paused: tasks.filter((t) => t.status === 'Paused').length,
    blocked: tasks.filter((t) => t.status === 'Blocked').length,
    done: tasks.filter((t) => t.status === 'Done').length,
  };

  const owner = state.users.find((u) => u.id === project.managerId);
  const members = project.members
    .map((m) => state.users.find((u) => u.id === m.userId))
    .filter(Boolean) as (typeof state.users)[0][];
  const techs = project.technologyIds
    .map((id) => state.technologies.find((t) => t.id === id))
    .filter(Boolean) as (typeof state.technologies)[0][];
  const repos = project.repoIds
    .map((id) => state.repositories.find((r) => r.id === id))
    .filter(Boolean) as (typeof state.repositories)[0][];

  const deadlineDate = new Date(project.deadline);
  const daysLeft = Math.ceil((deadlineDate.getTime() - now) / 86400000);
  const overdue = daysLeft < 0 && project.status !== 'Done';
  const hasSlipped =
    project.initialDeadline &&
    new Date(project.deadline).getTime() > new Date(project.initialDeadline).getTime();
  const slipDays = hasSlipped
    ? Math.round(
        (new Date(project.deadline).getTime() - new Date(project.initialDeadline!).getTime()) / 86400000
      )
    : 0;

  const statusColor: Record<string, string> = {
    Planning: '#6366f1',
    Active: COL_GREEN,
    Paused: COL_AMBER,
    Done: '#64748b',
  };
  const accentColor = statusColor[project.status] || BRAND;

  // SVG donut for task status
  const taskTotal = tasks.length || 1;
  const C = 2 * Math.PI * 28;
  const mkSeg = (count: number, color: string, startFrac: number) => {
    const f = count / taskTotal;
    const arc = f * C;
    if (arc < 0.5) return '';
    const rot = startFrac * 360 - 90;
    return `<circle cx="35" cy="35" r="28" fill="none" stroke="${color}" stroke-width="10"
      stroke-dasharray="${arc.toFixed(2)} ${(C - arc).toFixed(2)}"
      transform="rotate(${rot.toFixed(2)} 35 35)"/>`;
  };
  const f0 = 0;
  const f1 = f0 + taskCounts.done / taskTotal;
  const f2 = f1 + taskCounts.inProgress / taskTotal;
  const f3 = f2 + taskCounts.todo / taskTotal;
  const f4 = f3 + taskCounts.paused / taskTotal;
  const taskDonut = `<svg viewBox="0 0 70 70" width="90" height="90" style="display:block">
    <circle cx="35" cy="35" r="28" fill="none" stroke="#e5e7eb" stroke-width="10"/>
    ${mkSeg(taskCounts.done, COL_GREEN, f0)}
    ${mkSeg(taskCounts.inProgress, COL_BLUE, f1)}
    ${mkSeg(taskCounts.todo, '#94a3b8', f2)}
    ${mkSeg(taskCounts.paused, COL_AMBER, f3)}
    ${mkSeg(taskCounts.blocked, COL_RED, f4)}
    <text x="35" y="31" text-anchor="middle" font-size="14" font-weight="900" fill="#111" font-family="system-ui">${tasks.length}</text>
    <text x="35" y="43" text-anchor="middle" font-size="7" fill="#888" font-family="system-ui">TASKS</text>
  </svg>`;

  // Milestone roadmap SVG (horizontal timeline)
  const milestones = project.milestones || [];
  const sortedMs = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  let roadmapSvg = '';
  if (sortedMs.length > 0) {
    const msWidth = 560;
    const msHeight = 80;
    const padX = 30;
    const usableW = msWidth - padX * 2;
    const first = new Date(sortedMs[0].date).getTime();
    const last = new Date(sortedMs[sortedMs.length - 1].date).getTime();
    const range = last - first || 1;
    const toX = (d: string) => padX + ((new Date(d).getTime() - first) / range) * usableW;
    const nowX = Math.max(padX, Math.min(msWidth - padX, padX + ((now - first) / range) * usableW));
    roadmapSvg = `<svg viewBox="0 0 ${msWidth} ${msHeight}" style="width:100%;display:block;overflow:visible">
      <!-- baseline -->
      <line x1="${padX}" y1="40" x2="${msWidth - padX}" y2="40" stroke="#e5e7eb" stroke-width="2"/>
      <!-- today marker -->
      <line x1="${nowX}" y1="24" x2="${nowX}" y2="56" stroke="${BRAND}" stroke-width="1.5" stroke-dasharray="3,2"/>
      <text x="${nowX}" y="20" text-anchor="middle" font-size="7" fill="${BRAND}" font-family="system-ui" font-weight="700">TODAY</text>
      ${sortedMs.map((m, i) => {
        const x = toX(m.date);
        const color = m.done ? COL_GREEN : now > new Date(m.date).getTime() ? COL_RED : '#64748b';
        const above = i % 2 === 0;
        return `
          <circle cx="${x}" cy="40" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"/>
          <line x1="${x}" y1="${above ? 40 : 40}" x2="${x}" y2="${above ? 22 : 58}" stroke="${color}" stroke-width="1" stroke-dasharray="2,2"/>
          <text x="${x}" y="${above ? 18 : 68}" text-anchor="middle" font-size="6.5" fill="${color}" font-family="system-ui" font-weight="700">${esc(m.label.slice(0, 14))}</text>
          <text x="${x}" y="${above ? 10 : 76}" text-anchor="middle" font-size="6" fill="#aaa" font-family="system-ui">${new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>`;
      }).join('')}
    </svg>`;
  }

  const body = `
    <!-- Header -->
    <div style="padding-bottom:16px;margin-bottom:20px;border-bottom:3px solid ${accentColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:0.22em;color:${accentColor};font-family:system-ui;margin-bottom:4px">Project Brief</div>
          <div style="font-size:26pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.03em;line-height:1;font-family:system-ui;overflow:hidden;text-overflow:ellipsis">${esc(project.name)}</div>
          ${project.description ? `<div style="font-size:10pt;color:#777;margin-top:6px;font-family:system-ui">${esc(project.description)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:20px">
          <div style="font-size:22pt;font-weight:900;font-family:system-ui;color:#111">DOINg<span style="color:${BRAND}">.AI</span></div>
          <div style="font-size:8pt;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;font-family:system-ui;margin-top:2px">Confidential</div>
          <div style="font-size:8pt;color:#888;font-family:system-ui;margin-top:2px">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div style="margin-top:8px;background:${accentColor}20;color:${accentColor};font-size:8pt;font-weight:900;text-transform:uppercase;padding:4px 12px;border-radius:2px;font-family:system-ui">${esc(project.status)}</div>
        </div>
      </div>
    </div>

    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">
      ${kpiTile('Progress', `${progress}%`, progress >= 70 ? COL_GREEN : progress >= 40 ? COL_AMBER : COL_BLUE)}
      ${kpiTile('Tasks', tasks.length, COL_BLUE, `${taskCounts.done} done`)}
      ${kpiTile('Blocked', taskCounts.blocked, taskCounts.blocked > 0 ? COL_RED : '#94a3b8', taskCounts.blocked > 0 ? 'needs attention' : 'clear')}
      ${kpiTile('Team', members.length, '#8b5cf6', 'contributors')}
      ${overdue
        ? kpiTile('Deadline', `${Math.abs(daysLeft)}d`, COL_RED, 'OVERDUE')
        : kpiTile('Days left', daysLeft > 0 ? daysLeft : 0, daysLeft <= 7 ? COL_AMBER : COL_GREEN, deadlineDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}
    </div>

    <!-- Deadline slip warning -->
    ${hasSlipped ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid ${COL_AMBER};padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <div style="font-size:14pt">⚠️</div>
      <div>
        <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:${COL_AMBER};font-family:system-ui">Deadline Slipped</div>
        <div style="font-size:9pt;color:#92400e;font-family:system-ui">Current deadline is ${slipDays} day${slipDays !== 1 ? 's' : ''} later than original target (${new Date(project.initialDeadline!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})</div>
      </div>
    </div>` : ''}

    <!-- Task distribution + roadmap -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- Task breakdown -->
      <div style="border:1px solid #e5e7eb;padding:16px">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:12px">Task Distribution</div>
        <div style="display:flex;align-items:center;gap:16px">
          ${taskDonut}
          <div style="flex:1">
            ${ragLegendRow(COL_GREEN, 'Done', taskCounts.done, tasks.length)}
            ${ragLegendRow(COL_BLUE, 'In Progress', taskCounts.inProgress, tasks.length)}
            ${ragLegendRow('#94a3b8', 'To Do', taskCounts.todo, tasks.length)}
            ${taskCounts.paused > 0 ? ragLegendRow(COL_AMBER, 'Paused', taskCounts.paused, tasks.length) : ''}
            ${taskCounts.blocked > 0 ? ragLegendRow(COL_RED, 'Blocked', taskCounts.blocked, tasks.length) : ''}
          </div>
        </div>
        <div style="margin-top:12px">
          ${progressBar(progress, accentColor)}
          <div style="font-size:7.5pt;color:#aaa;margin-top:4px;font-family:system-ui">${progress}% complete (weighted)</div>
        </div>
      </div>

      <!-- Team -->
      <div style="border:1px solid #e5e7eb;padding:16px">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:#aaa;font-weight:700;font-family:system-ui;margin-bottom:12px">Project Team</div>
        ${owner ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9">
          <div style="width:28px;height:28px;background:${BRAND};color:#fff;display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:900;font-family:system-ui;flex-shrink:0">${esc(owner.firstName[0] + (owner.lastName[0] || ''))}</div>
          <div>
            <div style="font-size:9pt;font-weight:700;font-family:system-ui">${esc(owner.firstName + ' ' + owner.lastName)}</div>
            <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND};font-family:system-ui">Project Manager</div>
          </div>
        </div>` : ''}
        ${members.filter((m) => m.id !== project.managerId).slice(0, 6).map((m) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:22px;height:22px;background:${m.avatarColor || '#6366f1'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:7pt;font-weight:900;font-family:system-ui;flex-shrink:0">${esc(m.firstName[0] + (m.lastName[0] || ''))}</div>
            <div>
              <div style="font-size:8.5pt;font-weight:600;font-family:system-ui">${esc(m.firstName + ' ' + m.lastName)}</div>
              <div style="font-size:7pt;color:#888;font-family:system-ui">${esc(m.functionTitle || m.team)}</div>
            </div>
          </div>`).join('')}
        ${members.length > 7 ? `<div style="font-size:7.5pt;color:#aaa;font-family:system-ui;margin-top:4px">+ ${members.length - 7} more</div>` : ''}
      </div>
    </div>

    <!-- Milestones roadmap -->
    ${sortedMs.length > 0 ? `
    ${sectionHeader('Milestone Roadmap', accentColor)}
    <div style="border:1px solid #e5e7eb;padding:16px;margin-bottom:20px;overflow:hidden">
      ${roadmapSvg}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
        ${sortedMs.map((m) => {
          const isPast = now > new Date(m.date).getTime();
          const color = m.done ? COL_GREEN : isPast ? COL_RED : '#64748b';
          return `<div style="border-left:3px solid ${color};padding:4px 8px">
            <div style="font-size:8.5pt;font-weight:700;font-family:system-ui;color:${color}">${esc(m.label)}</div>
            <div style="font-size:7pt;color:#aaa;font-family:system-ui">${new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
            ${m.done ? `<div style="font-size:7pt;color:${COL_GREEN};font-family:system-ui;font-weight:700">✓ Done</div>` : isPast ? `<div style="font-size:7pt;color:${COL_RED};font-family:system-ui;font-weight:700">Overdue</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Context -->
    ${project.context ? `
    ${sectionHeader('Context & Background', '#6366f1')}
    <div style="border:1px solid #e5e7eb;border-left:4px solid #6366f1;padding:14px 18px;background:#fafbff;margin-bottom:20px;white-space:pre-wrap;font-family:system-ui;font-size:9.5pt;line-height:1.6;color:#374151">${esc(project.context)}</div>` : ''}

    <!-- Tasks table -->
    ${tasks.length > 0 ? `
    ${sectionHeader('Task Board', accentColor)}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-family:system-ui;font-size:8.5pt">
      <thead>
        <tr style="background:#0a0a0b;color:#fff">
          <th style="text-align:left;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Task</th>
          <th style="text-align:center;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Status</th>
          <th style="text-align:center;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Priority</th>
          <th style="text-align:left;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">Assignee</th>
          <th style="text-align:right;padding:8px 12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:7.5pt">ETA</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map((t, i) => {
          const assignee = state.users.find((u) => u.id === t.assigneeId);
          const statusC: Record<string, string> = { 'To Do': '#94a3b8', 'In Progress': COL_BLUE, Paused: COL_AMBER, Blocked: COL_RED, Done: COL_GREEN };
          const prioC: Record<string, string> = { Low: '#94a3b8', Medium: COL_BLUE, High: COL_AMBER, Urgent: COL_RED };
          const eta = t.currentEta || t.originalEta;
          return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-bottom:1px solid #e5e7eb">
            <td style="padding:7px 12px;font-weight:600">${esc(t.title)}</td>
            <td style="padding:7px 12px;text-align:center">
              <span style="background:${(statusC[t.status] || '#94a3b8')}18;color:${statusC[t.status] || '#94a3b8'};font-size:7pt;font-weight:700;text-transform:uppercase;padding:2px 7px">${esc(t.status)}</span>
            </td>
            <td style="padding:7px 12px;text-align:center">
              <span style="color:${prioC[t.priority] || '#94a3b8'};font-size:7.5pt;font-weight:700;text-transform:uppercase">${esc(t.priority)}</span>
            </td>
            <td style="padding:7px 12px;color:#666">${assignee ? esc(assignee.firstName + ' ' + assignee.lastName) : '—'}</td>
            <td style="padding:7px 12px;text-align:right;color:#888;font-size:7.5pt">${eta ? new Date(eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : ''}

    <!-- Technologies -->
    ${techs.length > 0 ? `
    ${sectionHeader('Technology Stack', '#8b5cf6')}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
      ${techs.map((t) => `
        <div style="border:1px solid #e2e8f0;padding:8px 14px;background:#fff">
          <div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;font-family:system-ui">${esc(t.name)}</div>
          <div style="font-size:7pt;color:${accentColor};text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui">${esc(t.category)}${t.layer ? ` · ${t.layer}` : ''}</div>
        </div>`).join('')}
    </div>` : ''}

    <!-- Repositories -->
    ${repos.length > 0 ? `
    ${sectionHeader('Code Repositories', '#1e1b4b')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px">
      ${repos.map((r) => `
        <div style="border:1px solid #e5e7eb;padding:10px 12px">
          <div style="font-size:9pt;font-weight:700;font-family:system-ui">${esc(r.name)}</div>
          <div style="font-size:7.5pt;color:#888;font-family:system-ui;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.url)}</div>
          ${r.description ? `<div style="font-size:8pt;color:#666;margin-top:4px;font-family:system-ui">${esc(r.description.slice(0, 80))}</div>` : ''}
        </div>`).join('')}
    </div>` : ''}

    <!-- AI Synthesis -->
    ${aiSynthesis ? `
    ${sectionHeader('AI Project Brief', '#8b5cf6')}
    <div class="ai-content" style="border:1px solid #e5e7eb;border-left:4px solid #8b5cf6;padding:16px 20px;background:#faf9ff;margin-bottom:20px">
      ${renderMarkdownLite(aiSynthesis)}
    </div>` : ''}

    ${pdfFooter('Project Brief')}`;

  return wrapHtmlDoc(`Project Brief — ${project.name}`, body, landscape, false);
};

/* ====================================================================
   BOOKLET PRESENTATION — SteerCo multi-project deck
   ==================================================================== */

export const buildBookletHTML = (
  projects: Project[],
  state: AppState,
  aiExecSummary?: string
): void => {
  const now = Date.now();
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayShort = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── RAG helper ──────────────────────────────────────────────────────
  const ragOf = (p: Project): 'red' | 'amber' | 'green' => {
    const tasks = p.tasks || [];
    const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
    const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
    const progress = totalW ? doneW / totalW : 0;
    const overdue = new Date(p.deadline).getTime() < now && p.status !== 'Done';
    const blockedRatio = totalW ? tasks.filter((t) => t.status === 'Blocked').reduce((s, t) => s + (t.weight || 1), 0) / totalW : 0;
    if (overdue || blockedRatio > 0.4) return 'red';
    if (blockedRatio > 0 || progress < 0.3) return 'amber';
    return 'green';
  };

  const ragLabel: Record<string, string> = { green: 'On Track', amber: 'At Risk', red: 'Off Track' };
  const statusColor: Record<string, string> = { Planning: '#6366f1', Active: COL_GREEN, Paused: COL_AMBER, Done: '#64748b' };

  const rags = projects.map(ragOf);
  const ragCounts = {
    green: rags.filter((r) => r === 'green').length,
    amber: rags.filter((r) => r === 'amber').length,
    red: rags.filter((r) => r === 'red').length,
  };
  const totalTasks = projects.reduce((s, p) => s + (p.tasks?.length || 0), 0);
  const doneTasks = projects.reduce((s, p) => s + (p.tasks?.filter((t) => t.status === 'Done').length || 0), 0);
  const activeProjects = projects.filter((p) => p.status === 'Active').length;
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const avgProgress = projects.reduce((s, p) => {
    const tasks = p.tasks || [];
    const totalW = tasks.reduce((a, t) => a + (t.weight || 1), 0);
    const doneW = tasks.filter((t) => t.status === 'Done').reduce((a, t) => a + (t.weight || 1), 0);
    return s + (totalW ? doneW / totalW : 0);
  }, 0) / (projects.length || 1);
  const avgPct = Math.round(avgProgress * 100);

  // ── SVG helpers ─────────────────────────────────────────────────────
  const mkPortfolioDonut = () => {
    const total = projects.length || 1;
    const C2 = 2 * Math.PI * 44;
    const seg2 = (count: number, color: string, startFraction: number) => {
      const f = count / total;
      const arc = f * C2;
      if (arc < 0.5) return '';
      const rot = startFraction * 360 - 90;
      return `<circle cx="55" cy="55" r="44" fill="none" stroke="${color}" stroke-width="14"
        stroke-dasharray="${arc.toFixed(2)} ${(C2 - arc).toFixed(2)}"
        transform="rotate(${rot.toFixed(2)} 55 55)"/>`;
    };
    const gf = ragCounts.green / total;
    const af = ragCounts.amber / total;
    return `<svg viewBox="0 0 110 110" width="140" height="140" style="display:block">
      <circle cx="55" cy="55" r="44" fill="none" stroke="#e5e7eb" stroke-width="14"/>
      ${seg2(ragCounts.green, COL_GREEN, 0)}
      ${seg2(ragCounts.amber, COL_AMBER, gf)}
      ${seg2(ragCounts.red, COL_RED, gf + af)}
      <text x="55" y="50" text-anchor="middle" font-size="22" font-weight="900" fill="#111" font-family="system-ui">${projects.length}</text>
      <text x="55" y="65" text-anchor="middle" font-size="8.5" fill="#888" font-family="system-ui" font-weight="700" letter-spacing="0.1em">PROJECTS</text>
    </svg>`;
  };

  const mkProgressBars = () =>
    projects.map((p, i) => {
      const tasks = p.tasks || [];
      const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
      const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
      const pct = totalW ? Math.round((doneW / totalW) * 100) : 0;
      const rag = rags[i];
      const color = rag === 'green' ? COL_GREEN : rag === 'amber' ? COL_AMBER : COL_RED;
      const daysLeft = Math.ceil((new Date(p.deadline).getTime() - now) / 86400000);
      const daysLabel = p.status === 'Done' ? '✓ Done' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;
      return `
      <div style="margin-bottom:10px;padding:10px 14px;border:1px solid #f0f0f0;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <div style="font-size:9.5pt;font-weight:800;font-family:system-ui;text-transform:uppercase;letter-spacing:0.04em">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:7.5pt;color:#888;font-family:system-ui">${daysLabel}</span>
            <span style="background:${color}20;color:${color};font-size:7pt;font-weight:900;text-transform:uppercase;padding:2px 8px;font-family:system-ui">${ragLabel[rag]}</span>
            <span style="font-size:9pt;font-weight:900;color:${color};font-family:system-ui;min-width:36px;text-align:right">${pct}%</span>
          </div>
        </div>
        <div style="background:#eee;height:6px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};transition:width 0.3s"></div>
        </div>
      </div>`;
    }).join('');

  const mkSparkMatrix = () =>
    projects.map((p, i) => {
      const rag = rags[i];
      const color = rag === 'green' ? COL_GREEN : rag === 'amber' ? COL_AMBER : COL_RED;
      const tasks = p.tasks || [];
      const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
      const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
      const pct = totalW ? Math.round((doneW / totalW) * 100) : 0;
      const daysLeft = Math.ceil((new Date(p.deadline).getTime() - now) / 86400000);
      const family = p.familyId ? (state.projectFamilies ?? []).find((f) => f.id === p.familyId) : null;
      return `
      <div style="border:1px solid #e5e7eb;border-top:3px solid ${color};padding:12px 14px;background:#fff">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-family:system-ui;margin-bottom:3px">${esc(p.status)}${family ? ` · ${esc(family.name)}` : ''}</div>
        <div style="font-size:10pt;font-weight:900;font-family:system-ui;line-height:1.2;margin-bottom:6px">${esc(p.name)}</div>
        <div style="font-size:18pt;font-weight:900;color:${color};font-family:system-ui;line-height:1">${pct}%</div>
        <div style="background:#eee;height:3px;margin:5px 0">
          <div style="width:${pct}%;height:100%;background:${color}"></div>
        </div>
        <div style="font-size:7.5pt;color:#aaa;font-family:system-ui">${p.status === 'Done' ? 'Completed' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d to deadline`}</div>
      </div>`;
    }).join('');

  // ── PAGE FACTORY ────────────────────────────────────────────────────
  const page = (content: string, breakAfter = true) =>
    `<div class="page" style="page-break-after:${breakAfter ? 'always' : 'avoid'}">${content}</div>`;

  // ── PAGE 1 — Cover ──────────────────────────────────────────────────
  const coverPage = page(`
    <div style="min-height:100vh;background:#0a0a0b;color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:0;position:relative;overflow:hidden">
      <!-- Geometric decoration -->
      <div style="position:absolute;top:-80px;right:-80px;width:400px;height:400px;border:2px solid ${BRAND};opacity:0.15;transform:rotate(30deg)"></div>
      <div style="position:absolute;top:40px;right:60px;width:200px;height:200px;background:${BRAND};opacity:0.07;transform:rotate(15deg)"></div>
      <div style="position:absolute;bottom:-60px;left:-40px;width:300px;height:300px;border:2px solid ${BRAND};opacity:0.1;transform:rotate(-20deg)"></div>
      <div style="position:absolute;bottom:80px;right:120px;width:120px;height:3px;background:${BRAND};opacity:0.4"></div>
      <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${BRAND}"></div>

      <!-- Top bar -->
      <div style="padding:32px 48px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ffffff10">
        <div style="font-size:9pt;letter-spacing:0.28em;text-transform:uppercase;color:${BRAND};font-weight:900;font-family:system-ui">Portfolio Booklet</div>
        <div style="font-size:9pt;color:#555;font-family:system-ui;letter-spacing:0.1em">${todayShort}</div>
      </div>

      <!-- Main content -->
      <div style="padding:60px 48px;flex:1;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:9pt;text-transform:uppercase;letter-spacing:0.3em;color:${BRAND};font-weight:900;font-family:system-ui;margin-bottom:20px">STEERCO PRESENTATION</div>
        <div style="font-size:52pt;font-weight:900;line-height:0.9;font-family:system-ui;letter-spacing:-0.03em;margin-bottom:12px">PROJECT<br>PORTFOLIO<br><span style="color:${BRAND}">REVIEW</span></div>
        <div style="width:80px;height:4px;background:${BRAND};margin:24px 0"></div>
        <div style="font-size:12pt;color:#888;font-family:system-ui;margin-bottom:8px">${projects.length} project${projects.length !== 1 ? 's' : ''} · ${activeProjects} active · ${avgPct}% avg progress</div>
        <div style="display:flex;gap:12px;margin-top:8px">
          <span style="background:${COL_GREEN}20;color:${COL_GREEN};font-size:8.5pt;font-weight:900;text-transform:uppercase;padding:5px 14px;letter-spacing:0.1em;font-family:system-ui">${ragCounts.green} On Track</span>
          <span style="background:${COL_AMBER}20;color:${COL_AMBER};font-size:8.5pt;font-weight:900;text-transform:uppercase;padding:5px 14px;letter-spacing:0.1em;font-family:system-ui">${ragCounts.amber} At Risk</span>
          <span style="background:${COL_RED}20;color:${COL_RED};font-size:8.5pt;font-weight:900;text-transform:uppercase;padding:5px 14px;letter-spacing:0.1em;font-family:system-ui">${ragCounts.red} Off Track</span>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:28px 48px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ffffff10">
        <div style="font-size:22pt;font-weight:900;font-family:system-ui">DOINg<span style="color:${BRAND}">.AI</span></div>
        <div style="text-align:right">
          <div style="font-size:8.5pt;color:#555;font-family:system-ui;letter-spacing:0.1em;text-transform:uppercase">AI Project Operations Platform</div>
          <div style="font-size:8pt;color:#444;font-family:system-ui;margin-top:3px">Generated ${today}</div>
        </div>
      </div>
    </div>`);

  // ── PAGE 2 — Agenda ─────────────────────────────────────────────────
  const agendaRows = projects.map((p, i) => {
    const rag = rags[i];
    const color = rag === 'green' ? COL_GREEN : rag === 'amber' ? COL_AMBER : COL_RED;
    const sc = statusColor[p.status] || BRAND;
    return `
    <div style="display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <div style="font-size:28pt;font-weight:900;color:#f0f0f0;font-family:system-ui;min-width:40px;text-align:right;line-height:1">${i + 3}</div>
      <div style="width:4px;height:36px;background:${color};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:10.5pt;font-weight:800;font-family:system-ui;text-transform:uppercase;letter-spacing:0.03em">${esc(p.name)}</div>
        ${p.description ? `<div style="font-size:8pt;color:#888;font-family:system-ui;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.description.slice(0, 90))}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
        <span style="background:${sc}15;color:${sc};font-size:7.5pt;font-weight:900;text-transform:uppercase;padding:3px 10px;font-family:system-ui">${esc(p.status)}</span>
        <span style="background:${color}15;color:${color};font-size:7.5pt;font-weight:900;text-transform:uppercase;padding:3px 10px;font-family:system-ui">${ragLabel[rag]}</span>
      </div>
    </div>`;
  }).join('');

  const agendaPage = page(`
    <div style="padding:40px 48px;min-height:100vh;background:#fff;font-family:system-ui">
      <div style="border-left:4px solid ${BRAND};padding-left:16px;margin-bottom:32px">
        <div style="font-size:8.5pt;text-transform:uppercase;letter-spacing:0.28em;color:${BRAND};font-weight:900;margin-bottom:4px">Agenda</div>
        <div style="font-size:28pt;font-weight:900;color:#111;line-height:1">Table of Contents</div>
      </div>
      <!-- Fixed pages -->
      <div style="margin-bottom:4px;display:flex;align-items:center;gap:16px;padding:12px 16px;background:#0a0a0b;color:#fff">
        <div style="font-size:28pt;font-weight:900;color:#333;font-family:system-ui;min-width:40px;text-align:right;line-height:1">1</div>
        <div style="width:4px;height:36px;background:${BRAND};flex-shrink:0"></div>
        <div style="font-size:10.5pt;font-weight:800;text-transform:uppercase;letter-spacing:0.03em">Cover Page</div>
      </div>
      <div style="margin-bottom:4px;display:flex;align-items:center;gap:16px;padding:12px 16px;background:#f8f8f8">
        <div style="font-size:28pt;font-weight:900;color:#f0f0f0;font-family:system-ui;min-width:40px;text-align:right;line-height:1">2</div>
        <div style="width:4px;height:36px;background:#64748b;flex-shrink:0"></div>
        <div style="font-size:10.5pt;font-weight:800;font-family:system-ui;text-transform:uppercase;letter-spacing:0.03em">Agenda</div>
      </div>
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:16px;padding:12px 16px;background:#fff4f0">
        <div style="font-size:28pt;font-weight:900;color:#f0f0f0;font-family:system-ui;min-width:40px;text-align:right;line-height:1">3</div>
        <div style="width:4px;height:36px;background:${BRAND};flex-shrink:0"></div>
        <div style="font-size:10.5pt;font-weight:800;font-family:system-ui;text-transform:uppercase;letter-spacing:0.03em;color:${BRAND}">Executive Summary</div>
      </div>
      <!-- Project rows -->
      ${agendaRows}
    </div>`);

  // ── PAGE 3 — Executive Summary ──────────────────────────────────────
  const execPage = page(`
    <div style="min-height:100vh;background:#fff;font-family:system-ui">
      <!-- Header band -->
      <div style="background:#0a0a0b;color:#fff;padding:28px 48px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:8.5pt;text-transform:uppercase;letter-spacing:0.28em;color:${BRAND};font-weight:900;margin-bottom:4px">Executive Summary</div>
          <div style="font-size:24pt;font-weight:900;line-height:1">Portfolio Overview</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22pt;font-weight:900">DOINg<span style="color:${BRAND}">.AI</span></div>
          <div style="font-size:8pt;color:#555;margin-top:3px">${today}</div>
        </div>
      </div>

      <div style="padding:28px 48px">
        <!-- KPI row -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px">
          ${kpiTile('Total Projects', projects.length, BRAND)}
          ${kpiTile('Active', activeProjects, COL_GREEN, `${Math.round((activeProjects / (projects.length || 1)) * 100)}% of portfolio`)}
          ${kpiTile('On Track', ragCounts.green, COL_GREEN, `${Math.round((ragCounts.green / (projects.length || 1)) * 100)}%`)}
          ${kpiTile('At Risk', ragCounts.amber, COL_AMBER, `${Math.round((ragCounts.amber / (projects.length || 1)) * 100)}%`)}
          ${kpiTile('Off Track', ragCounts.red, COL_RED, `${Math.round((ragCounts.red / (projects.length || 1)) * 100)}%`)}
        </div>

        <!-- Charts row -->
        <div style="display:grid;grid-template-columns:180px 1fr;gap:20px;margin-bottom:24px;align-items:start">
          <!-- Donut + legend -->
          <div style="border:1px solid #e5e7eb;padding:16px;text-align:center">
            <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:10px">RAG Status</div>
            <div style="display:flex;justify-content:center">${mkPortfolioDonut()}</div>
            <div style="margin-top:10px">
              ${ragLegendRow(COL_GREEN, 'On Track', ragCounts.green, projects.length)}
              ${ragLegendRow(COL_AMBER, 'At Risk', ragCounts.amber, projects.length)}
              ${ragLegendRow(COL_RED, 'Off Track', ragCounts.red, projects.length)}
            </div>
          </div>
          <!-- Progress bars -->
          <div>
            <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:8px">Project Progress</div>
            ${mkProgressBars()}
          </div>
        </div>

        <!-- Spark matrix -->
        <div>
          <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:8px">Project Scorecards</div>
          <div style="display:grid;grid-template-columns:repeat(${Math.min(4, projects.length)},1fr);gap:8px">
            ${mkSparkMatrix()}
          </div>
        </div>

        <!-- Global stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">
          ${kpiTile('Total Tasks', totalTasks, '#64748b', `${doneTasks} done`)}
          ${kpiTile('Avg Progress', avgPct + '%', avgPct >= 70 ? COL_GREEN : avgPct >= 40 ? COL_AMBER : COL_RED, 'across all projects')}
          ${totalBudget > 0 ? kpiTile('Total Budget', totalBudget >= 1000 ? `${(totalBudget / 1000).toFixed(0)}k€` : `${totalBudget}€`, BRAND, 'combined allocation') : kpiTile('FTE Saved', projects.reduce((s, p) => s + (p.fteGain || 0), 0).toFixed(1), COL_GREEN, 'est. across portfolio')}
        </div>

        ${aiExecSummary ? `
        <div style="margin-top:20px;border-left:4px solid ${BRAND};padding:16px 20px;background:#fff8f5">
          <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.16em;color:${BRAND};font-weight:900;margin-bottom:8px">AI Executive Summary</div>
          <div style="font-size:9.5pt;color:#333;line-height:1.6;font-family:system-ui">${esc(aiExecSummary)}</div>
        </div>` : ''}
      </div>
    </div>`);

  // ── Per-project pages ───────────────────────────────────────────────
  const projectPages = projects.map((p, i) => {
    const rag = rags[i];
    const ragColor2 = rag === 'green' ? COL_GREEN : rag === 'amber' ? COL_AMBER : COL_RED;
    const tasks = p.tasks || [];
    const totalW = tasks.reduce((s, t) => s + (t.weight || 1), 0);
    const doneW = tasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.weight || 1), 0);
    const progress = totalW ? Math.round((doneW / totalW) * 100) : 0;
    const accentColor = statusColor[p.status] || BRAND;
    const owner = state.users.find((u) => u.id === p.managerId);
    const members = p.members.map((m) => state.users.find((u) => u.id === m.userId)).filter(Boolean) as typeof state.users;
    const techs = p.technologyIds.map((id) => state.technologies.find((t) => t.id === id)).filter(Boolean) as typeof state.technologies;
    const daysLeft = Math.ceil((new Date(p.deadline).getTime() - now) / 86400000);
    const overdue = daysLeft < 0 && p.status !== 'Done';
    const milestones = [...(p.milestones || [])].sort((a, b) => a.date.localeCompare(b.date));
    const doneMilestones = milestones.filter((m) => m.done).length;
    const taskCounts2 = {
      todo: tasks.filter((t) => t.status === 'To Do').length,
      inProgress: tasks.filter((t) => t.status === 'In Progress').length,
      paused: tasks.filter((t) => t.status === 'Paused').length,
      blocked: tasks.filter((t) => t.status === 'Blocked').length,
      done: tasks.filter((t) => t.status === 'Done').length,
    };
    const family = p.familyId ? (state.projectFamilies ?? []).find((f) => f.id === p.familyId) : null;

    return page(`
    <div style="min-height:100vh;background:#fff;font-family:system-ui">
      <!-- Project header band -->
      <div style="background:#0a0a0b;color:#fff;padding:20px 40px;display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.22em;color:${accentColor};font-weight:900">Project ${i + 1} / ${projects.length}</div>
            ${family ? `<span style="background:${family.color || BRAND}30;color:${family.color || BRAND};font-size:7pt;font-weight:900;text-transform:uppercase;padding:2px 8px;font-family:system-ui">${esc(family.name)}</span>` : ''}
          </div>
          <div style="font-size:22pt;font-weight:900;line-height:1;text-transform:uppercase;letter-spacing:-0.02em">${esc(p.name)}</div>
          ${p.description ? `<div style="font-size:9pt;color:#888;margin-top:6px">${esc(p.description.slice(0, 140))}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:24px">
          <div style="background:${accentColor};color:#fff;font-size:8pt;font-weight:900;text-transform:uppercase;padding:5px 14px;margin-bottom:6px;display:inline-block">${esc(p.status)}</div><br>
          <div style="background:${ragColor2};color:#fff;font-size:8pt;font-weight:900;text-transform:uppercase;padding:5px 14px;display:inline-block">${ragLabel[rag]}</div>
        </div>
      </div>

      <div style="padding:20px 40px">
        <!-- KPI strip -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
          ${kpiTile('Progress', progress + '%', ragColor2)}
          ${kpiTile(overdue ? 'Overdue' : 'Days Left', overdue ? `${Math.abs(daysLeft)}d` : `${daysLeft}d`, overdue ? COL_RED : daysLeft < 14 ? COL_AMBER : COL_GREEN)}
          ${kpiTile('Tasks', tasks.length, '#64748b', `${taskCounts2.done} done`)}
          ${kpiTile('Milestones', milestones.length, accentColor, `${doneMilestones} done`)}
        </div>

        <!-- Progress bar -->
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#888">Overall Progress</span>
            <span style="font-size:8pt;font-weight:900;color:${ragColor2}">${progress}%</span>
          </div>
          <div style="background:#eee;height:8px">
            <div style="width:${progress}%;height:100%;background:${ragColor2}"></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Left: details -->
          <div style="space-y:8px">
            ${owner ? `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #e5e7eb;margin-bottom:8px">
              <div style="width:28px;height:28px;background:${BRAND};color:#fff;display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:900;flex-shrink:0">${esc(owner.firstName[0] + (owner.lastName[0] || ''))}</div>
              <div>
                <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND}">Project Manager</div>
                <div style="font-size:9pt;font-weight:700">${esc(owner.firstName + ' ' + owner.lastName)}</div>
              </div>
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:8.5pt">
              <div style="padding:7px 10px;border:1px solid #e5e7eb"><div style="color:#888;font-size:7pt;text-transform:uppercase;letter-spacing:0.1em">Start</div><div style="font-weight:700">${new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
              <div style="padding:7px 10px;border:1px solid ${overdue ? COL_RED : '#e5e7eb'};${overdue ? `background:${COL_RED}08` : ''}"><div style="color:${overdue ? COL_RED : '#888'};font-size:7pt;text-transform:uppercase;letter-spacing:0.1em">Deadline</div><div style="font-weight:700;color:${overdue ? COL_RED : '#111'}">${new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
              ${p.budget ? `<div style="padding:7px 10px;border:1px solid #e5e7eb;grid-column:span 2"><div style="color:#888;font-size:7pt;text-transform:uppercase;letter-spacing:0.1em">Budget</div><div style="font-weight:700">${p.budget >= 1000 ? `${(p.budget / 1000).toFixed(0)}k€` : `${p.budget}€`}</div></div>` : ''}
            </div>
            ${techs.length > 0 ? `
            <div style="margin-top:8px">
              <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:5px">Technologies</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">${techs.map((t) => `<span style="background:#f3f4f6;color:#374151;font-size:7.5pt;font-weight:700;padding:2px 8px;text-transform:uppercase;letter-spacing:0.06em">${esc(t.name)}</span>`).join('')}</div>
            </div>` : ''}
            ${members.length > 0 ? `
            <div style="margin-top:8px">
              <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:5px">Team (${members.length})</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">${members.slice(0, 8).map((u) => `<span style="width:26px;height:26px;background:${u.avatarColor || accentColor};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:7.5pt;font-weight:900;title="${esc(u.firstName + ' ' + u.lastName)}">${esc(u.firstName[0] + u.lastName[0])}</span>`).join('')}${members.length > 8 ? `<span style="font-size:8pt;color:#888;align-self:center;margin-left:3px">+${members.length - 8}</span>` : ''}</div>
            </div>` : ''}
          </div>

          <!-- Right: task board summary -->
          <div>
            <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:6px">Task Status</div>
            ${[
              ['Done', taskCounts2.done, COL_GREEN],
              ['In Progress', taskCounts2.inProgress, COL_BLUE],
              ['To Do', taskCounts2.todo, '#94a3b8'],
              ['Paused', taskCounts2.paused, COL_AMBER],
              ['Blocked', taskCounts2.blocked, COL_RED],
            ].filter(([, count]) => (count as number) > 0).map(([label, count, color]) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <div style="width:8px;height:8px;background:${color};flex-shrink:0"></div>
              <div style="flex:1;font-size:8pt;font-family:system-ui">${label}</div>
              <div style="font-size:9pt;font-weight:900;font-family:system-ui">${count}</div>
              <div style="font-size:7.5pt;color:#aaa;width:32px;text-align:right">${tasks.length ? Math.round((count as number / tasks.length) * 100) : 0}%</div>
            </div>`).join('')}
          </div>
        </div>

        <!-- Milestones -->
        ${milestones.length > 0 ? `
        <div style="margin-bottom:12px">
          <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:6px">Milestones</div>
          <div style="display:grid;grid-template-columns:repeat(${Math.min(3, milestones.length)},1fr);gap:6px">
            ${milestones.slice(0, 6).map((m) => {
              const mColor = m.done ? COL_GREEN : now > new Date(m.date).getTime() ? COL_RED : '#64748b';
              return `<div style="border-left:3px solid ${mColor};padding:6px 10px;border:1px solid #e5e7eb;border-left-width:3px;border-left-color:${mColor}">
                <div style="font-size:7pt;color:${mColor};font-weight:900;text-transform:uppercase">${m.done ? '✓ Done' : now > new Date(m.date).getTime() ? 'Overdue' : 'Upcoming'}</div>
                <div style="font-size:8.5pt;font-weight:700;margin-top:2px">${esc(m.label)}</div>
                <div style="font-size:7.5pt;color:#aaa;margin-top:1px">${new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Tags & confidentiality -->
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${p.confidentiality ? `<span style="background:${p.confidentiality === 'restricted' ? COL_RED : p.confidentiality === 'confidential' ? COL_AMBER : p.confidentiality === 'internal' ? COL_BLUE : COL_GREEN}15;color:${p.confidentiality === 'restricted' ? COL_RED : p.confidentiality === 'confidential' ? COL_AMBER : p.confidentiality === 'internal' ? COL_BLUE : COL_GREEN};font-size:7pt;font-weight:900;text-transform:uppercase;padding:2px 8px">🔒 ${esc(p.confidentiality)}</span>` : ''}
          ${(p.tags || []).map((t) => `<span style="background:#f3f4f6;color:#666;font-size:7.5pt;padding:2px 8px">#${esc(t)}</span>`).join('')}
          ${p.fteGain ? `<span style="background:${COL_GREEN}15;color:${COL_GREEN};font-size:7.5pt;font-weight:900;padding:2px 8px">${p.fteGain} FTE saved</span>` : ''}
        </div>
      </div>
    </div>`, i < projects.length - 1);
  }).join('');

  // ── Assemble full document ───────────────────────────────────────────
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>DOINg.AI — Portfolio Booklet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f0f0f0; }
    .page { background: #fff; margin: 0 auto; width: 297mm; min-height: 210mm; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #fff; }
      .page { width: 100%; margin: 0; page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      @page { size: A4 landscape; margin: 0; }
    }
    @media screen {
      .page { box-shadow: 0 4px 20px rgba(0,0,0,0.15); margin: 20px auto; }
    }
    .no-print { display: block; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <!-- Print toolbar -->
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:1000;background:#0a0a0b;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 24px">
    <div style="font-size:11pt;font-weight:900;font-family:system-ui">DOINg<span style="color:#FF3E00">.AI</span> <span style="font-weight:400;color:#888;font-size:9pt">— Portfolio Booklet · ${projects.length} projects</span></div>
    <button onclick="window.print()" style="background:#FF3E00;color:#fff;border:none;padding:8px 24px;font-size:10pt;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;font-family:system-ui">🖨 Print / Save PDF</button>
  </div>
  <div style="height:44px" class="no-print"></div>

  ${coverPage}
  ${agendaPage}
  ${execPage}
  ${projectPages}
</body>
</html>`);
  w.document.close();
};

/* ====================================================================
   TIMELINE GANTT PDF — landscape Gantt export
   ==================================================================== */

export const buildTimelinePDF = (projects: Project[], _state: AppState): void => {
  if (projects.length === 0) {
    alert('No projects selected for export.');
    return;
  }

  const now = Date.now();
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const starts = projects.map((p) => new Date(p.startDate).getTime());
  const ends = projects.map((p) => new Date(p.deadline).getTime());
  const minTs = Math.min(...starts) - 10 * 86400000;
  const maxTs = Math.max(...ends) + 10 * 86400000;
  const totalMs = maxTs - minTs;

  const SVG_W = 1060;
  const LABEL_W = 200;
  const GANTT_W = SVG_W - LABEL_W - 20;
  const ROW_H = 36;
  const HEADER_H = 40;
  const SVG_H = HEADER_H + projects.length * ROW_H + 10;

  const toX = (ts: number) => LABEL_W + ((ts - minTs) / totalMs) * GANTT_W;

  // Month markers
  const monthLines: string[] = [];
  const cursor = new Date(minTs);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < maxTs) {
    const x = toX(cursor.getTime());
    if (x >= LABEL_W && x <= SVG_W - 20) {
      monthLines.push(
        `<line x1="${x.toFixed(1)}" y1="${HEADER_H}" x2="${x.toFixed(1)}" y2="${SVG_H}" stroke="#e5e7eb" stroke-width="1"/>`
      );
      monthLines.push(
        `<text x="${(x + 4).toFixed(1)}" y="26" font-size="8" fill="#999" font-family="system-ui" font-weight="700">${MONTHS_SHORT[cursor.getMonth()]} ${cursor.getFullYear().toString().slice(2)}</text>`
      );
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Today line
  const todayX = toX(now);
  const todayLine =
    todayX >= LABEL_W && todayX <= SVG_W - 20
      ? `<line x1="${todayX.toFixed(1)}" y1="0" x2="${todayX.toFixed(1)}" y2="${SVG_H}" stroke="${BRAND}" stroke-width="1.5" stroke-dasharray="4,3"/>
         <rect x="${(todayX - 16).toFixed(1)}" y="2" width="32" height="12" fill="${BRAND}"/>
         <text x="${todayX.toFixed(1)}" y="11" text-anchor="middle" font-size="7" fill="#fff" font-weight="900" font-family="system-ui">TODAY</text>`
      : '';

  // Project rows
  const rowsSvg = projects
    .map((p, i) => {
      const y = HEADER_H + i * ROW_H;
      const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const startX = Math.max(LABEL_W, toX(new Date(p.startDate).getTime()));
      const endX = Math.min(SVG_W - 20, toX(new Date(p.deadline).getTime()));
      const barW = Math.max(4, endX - startX);
      const overdue = new Date(p.deadline).getTime() < now && p.status !== ProjectStatus.DONE;
      const done = p.status === ProjectStatus.DONE;
      const barColor = done ? '#22c55e' : overdue ? '#ef4444' : BRAND;
      const barAlpha = done ? 'b0' : 'cc';
      const midY = y + ROW_H / 2;
      const barY = midY - 9;

      const milestonesSvg = (p.milestones || [])
        .map((m) => {
          const mx = toX(new Date(m.date).getTime());
          if (mx < LABEL_W || mx > SVG_W - 20) return '';
          const mColor = m.done ? '#22c55e' : now > new Date(m.date).getTime() ? '#ef4444' : '#f59e0b';
          return `<polygon points="${mx.toFixed(1)},${(barY - 1).toFixed(1)} ${(mx - 5).toFixed(1)},${(barY - 9).toFixed(1)} ${(mx + 5).toFixed(1)},${(barY - 9).toFixed(1)}" fill="${mColor}"/>`;
        })
        .join('');

      return `
      <rect x="0" y="${y}" width="${SVG_W}" height="${ROW_H}" fill="${rowBg}"/>
      <line x1="0" y1="${y + ROW_H}" x2="${SVG_W}" y2="${y + ROW_H}" stroke="#e5e7eb" stroke-width="0.5"/>
      <text x="${LABEL_W - 8}" y="${midY + 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#111" font-family="system-ui">${esc(p.name.slice(0, 26))}</text>
      <text x="${LABEL_W - 8}" y="${midY + 14}" text-anchor="end" font-size="7" fill="#aaa" font-family="system-ui">${esc(p.status.toUpperCase())}</text>
      <line x1="${LABEL_W}" y1="${y}" x2="${LABEL_W}" y2="${y + ROW_H}" stroke="#e5e7eb" stroke-width="1"/>
      <rect x="${startX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="18" fill="${barColor}${barAlpha}" rx="1"/>
      ${barW > 30 ? `<text x="${(startX + 4).toFixed(1)}" y="${(barY + 12).toFixed(1)}" font-size="7.5" font-weight="900" fill="#fff" font-family="system-ui">${esc(p.name.slice(0, 22))}</text>` : ''}
      ${milestonesSvg}`;
    })
    .join('');

  const svg = `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
    <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="#fff"/>
    <rect x="0" y="0" width="${SVG_W}" height="${HEADER_H}" fill="#f8fafc"/>
    <rect x="0" y="${HEADER_H - 1}" width="${SVG_W}" height="2" fill="#e5e7eb"/>
    <text x="10" y="26" font-size="8" font-weight="900" fill="#aaa" font-family="system-ui">PROJECT</text>
    ${monthLines.join('\n    ')}
    ${rowsSvg}
    ${todayLine}
  </svg>`;

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateRange = `${new Date(minTs).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} — ${new Date(maxTs).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>DOINg.AI - Portfolio Timeline</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #0a0a0b; }
    .no-print { display: block; }
    @media print { .no-print { display: none !important; } }
    .page-header { display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid #FF3E00;padding-bottom:10px;margin-bottom:14px; }
    .brand { font-size:20pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.04em;line-height:1; }
    .brand span { color:#FF3E00; }
    .legend { display:flex;align-items:center;gap:18px;margin-top:10px;font-size:8pt;color:#666; }
    .legend-dot { width:12px;height:12px;display:inline-block;margin-right:4px;vertical-align:middle; }
    .footer { margin-top:10px;font-size:7.5pt;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:6px;letter-spacing:0.1em;text-transform:uppercase; }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:1000;background:#0a0a0b;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 24px">
    <div style="font-size:11pt;font-weight:900;font-family:system-ui">DOINg<span style="color:#FF3E00">.AI</span> <span style="font-weight:400;color:#888;font-size:9pt">Portfolio Timeline &middot; ${projects.length} projects</span></div>
    <button onclick="window.print()" style="background:#FF3E00;color:#fff;border:none;padding:8px 24px;font-size:10pt;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;font-family:system-ui">Print / Save PDF</button>
  </div>
  <div class="no-print" style="height:44px"></div>
  <div style="padding:0 2px">
    <div class="page-header">
      <div>
        <div class="brand">DOINg<span>.AI</span></div>
        <div style="font-size:16pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-top:4px">Portfolio Timeline</div>
        <div style="font-size:8.5pt;color:#888;margin-top:3px;letter-spacing:0.1em">${projects.length} projects &middot; ${dateRange}</div>
      </div>
      <div style="text-align:right;font-size:8pt;color:#888;line-height:1.6;text-transform:uppercase;letter-spacing:0.1em">
        <div>Confidential</div>
        <div>${today}</div>
      </div>
    </div>
    <div style="border:1px solid #e5e7eb;overflow:hidden">${svg}</div>
    <div class="legend">
      <span><span class="legend-dot" style="background:#FF3E00cc"></span>On track</span>
      <span><span class="legend-dot" style="background:#ef4444cc"></span>Overdue</span>
      <span><span class="legend-dot" style="background:#22c55eb0"></span>Done</span>
      <span style="display:flex;align-items:center;gap:4px">
        <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 0,10 10,10" fill="#f59e0b"/></svg>
        Milestone (pending)
      </span>
      <span style="display:flex;align-items:center;gap:4px">
        <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 0,10 10,10" fill="#22c55e"/></svg>
        Milestone (done)
      </span>
      <span style="display:flex;align-items:center;gap:4px">
        <svg width="2" height="14" viewBox="0 0 2 14"><line x1="1" y1="0" x2="1" y2="14" stroke="#FF3E00" stroke-width="1.5" stroke-dasharray="3,2"/></svg>
        Today
      </span>
    </div>
    <div class="footer">DOINg.AI &middot; AI Project Operations Platform &middot; Generated ${today}</div>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1200,height=850');
  if (!w) { alert('Allow pop-ups to export PDF.'); return; }
  w.document.write(html);
  w.document.close();
};
