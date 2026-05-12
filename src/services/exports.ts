/* === Export helpers === */
/* PDF: opens a self-contained print window styled for paper.
   EML: builds an RFC-822 .eml file the user can double-click to open in Outlook. */

import { AppState } from '../types';

export const exportEML = (subject: string, body: string, recipients: string[]): void => {
  const safeSubj = (subject || 'NEXUS.AI Update').replace(/[\r\n]+/g, ' ').trim();
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
        <div class="brand">NEXUS<span class="dot">.AI</span></div>
        <h1 style="margin-top:8pt">${esc(title)}</h1>
      </div>
      <div class="meta"><div>Confidential</div><div>${today}</div></div>
    </header>
    ${sectionHtml}
    <footer>NEXUS.AI • AI Project Operations Platform</footer>
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
    <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.18em;color:#aaa;font-weight:700;font-family:system-ui">NEXUS.AI</div>
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
        <div style="font-size:22pt;font-weight:900;font-family:system-ui;color:#111">NEXUS<span style="color:${accentColor}">.AI</span></div>
        <div style="font-size:8pt;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;font-family:system-ui;margin-top:2px">Confidential</div>
        <div style="font-size:8pt;color:#888;font-family:system-ui;margin-top:2px">${today}</div>
      </div>
    </div>
  </div>`;
};

const pdfFooter = (type: string) =>
  `<div style="position:fixed;bottom:8mm;left:16mm;right:16mm;color:#bbb;font-size:7.5pt;text-align:center;border-top:1px solid #e5e7eb;padding-top:6px;font-family:system-ui">
    NEXUS.AI • AI Project Operations Platform • ${esc(type)} Report
  </div>`;

const openPrintWindow = (title: string, body: string): void => {
  const w = window.open('', '_blank', 'width=960,height=1200');
  if (!w) { alert('Allow pop-ups to export PDF.'); return; }
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <style>
    @page { size: A4; margin: 15mm 16mm 20mm; }
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
  </style>
</head>
<body>
  ${body}
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body>
</html>`);
  w.document.close();
};

/* --- Weekly Status Report --- */
const buildWeeklyPDF = (title: string, content: string, state: AppState): void => {
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

    ${sectionHeader('Weekly Summary')}
    <div class="ai-content" style="border:1px solid #e5e7eb;padding:16px;background:#fafafa">
      ${renderMarkdownLite(content)}
    </div>

    ${pdfFooter('Weekly')}`;

  openPrintWindow(`Weekly Status — ${title}`, body);
};

/* --- Newsletter --- */
const buildNewsletterPDF = (title: string, content: string, state: AppState): void => {
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
        <div style="font-size:18pt;font-weight:900;font-family:system-ui">NEXUS<span style="color:${BRAND}">.AI</span></div>
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

  openPrintWindow(`Newsletter — ${title}`, body);
};

/* --- Executive Brief --- */
const buildExcoPDF = (title: string, content: string, state: AppState): void => {
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

  openPrintWindow(`Executive Brief — ${title}`, body);
};

export const exportCommunicationPDF = (
  type: 'weekly' | 'newsletter' | 'exco',
  title: string,
  content: string,
  state: AppState
): void => {
  if (type === 'weekly') buildWeeklyPDF(title, content, state);
  else if (type === 'newsletter') buildNewsletterPDF(title, content, state);
  else buildExcoPDF(title, content, state);
};
