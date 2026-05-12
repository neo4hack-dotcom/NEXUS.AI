import React from 'react';

/* ────────────────────────────────────────────────────────────────────
   Inline markdown → HTML
──────────────────────────────────────────────────────────────────── */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inline = (s: string): string =>
  s
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(
      /`([^`\n]+)`/g,
      '<code class="md-inline-code">$1</code>',
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="md-link" target="_blank" rel="noopener noreferrer">$1</a>',
    );

/* ────────────────────────────────────────────────────────────────────
   Table parser
──────────────────────────────────────────────────────────────────── */
function parseTable(lines: string[]): string {
  const rows = lines.map((l) =>
    l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()),
  );
  const [head, , ...body] = rows;
  const th = head.map((c) => `<th class="md-th">${inline(c)}</th>`).join('');
  const tbody = body
    .map((r) => {
      const tds = r.map((c) => `<td class="md-td">${inline(c)}</td>`).join('');
      return `<tr class="md-tr">${tds}</tr>`;
    })
    .join('');
  return `<div class="md-table-wrap"><table class="md-table"><thead><tr class="md-tr">${th}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

const isTableRow = (l: string) => /^\|.+\|$/.test(l.trim());
const isSeparatorRow = (l: string) => /^\|[\s|:-]+\|$/.test(l.trim());

/* ────────────────────────────────────────────────────────────────────
   Main md → html converter
──────────────────────────────────────────────────────────────────── */
function md2html(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;

  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const flushCode = () => {
    const body = codeLines.map((l) => escapeHtml(l)).join('\n');
    const label = codeLang
      ? `<span class="md-code-lang">${escapeHtml(codeLang)}</span>`
      : '';
    out.push(`<div class="md-code-block">${label}<pre class="md-pre"><code>${body}</code></pre></div>`);
    codeLines = [];
    codeLang = '';
    inCode = false;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    /* ── Fenced code block ── */
    if (!inCode && /^```/.test(line)) {
      closeList();
      codeLang = line.slice(3).trim();
      inCode = true;
      i++;
      continue;
    }
    if (inCode) {
      if (/^```/.test(line)) {
        flushCode();
      } else {
        codeLines.push(raw);
      }
      i++;
      continue;
    }

    /* ── Table detection (look-ahead for separator row) ── */
    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      closeList();
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(parseTable(tableLines));
      continue;
    }

    /* ── HR ── */
    if (/^[-*_]{3,}$/.test(line.trim())) {
      closeList();
      out.push('<hr class="md-hr">');
      i++;
      continue;
    }

    /* ── Headings ── */
    const h4 = line.match(/^####\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h4) { closeList(); out.push(`<h4 class="md-h4">${inline(h4[1])}</h4>`); i++; continue; }
    if (h3) { closeList(); out.push(`<h3 class="md-h3">${inline(h3[1])}</h3>`); i++; continue; }
    if (h2) { closeList(); out.push(`<h2 class="md-h2">${inline(h2[1])}</h2>`); i++; continue; }
    if (h1) { closeList(); out.push(`<h1 class="md-h1">${inline(h1[1])}</h1>`); i++; continue; }

    /* ── Blockquote ── */
    const bq = line.match(/^>\s*(.*)/);
    if (bq) {
      closeList();
      out.push(`<blockquote class="md-blockquote">${inline(bq[1])}</blockquote>`);
      i++;
      continue;
    }

    /* ── Unordered list ── */
    const ul = line.match(/^[ \t]*[-*•+]\s+(.+)/);
    if (ul) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul class="md-ul">'); inUl = true; }
      out.push(`<li class="md-li">${inline(ul[1])}</li>`);
      i++;
      continue;
    }

    /* ── Ordered list ── */
    const ol = line.match(/^[ \t]*\d+\.\s+(.+)/);
    if (ol) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol class="md-ol">'); inOl = true; }
      out.push(`<li class="md-li">${inline(ol[1])}</li>`);
      i++;
      continue;
    }

    /* ── Empty line ── */
    if (line.trim() === '') {
      closeList();
      out.push('<div class="md-spacer"></div>');
      i++;
      continue;
    }

    /* ── Paragraph ── */
    closeList();
    out.push(`<p class="md-p">${inline(line)}</p>`);
    i++;
  }

  if (inCode) flushCode();
  closeList();
  return out.join('');
}

/* ────────────────────────────────────────────────────────────────────
   Scoped CSS — injected once via a <style> tag
──────────────────────────────────────────────────────────────────── */
const STYLES = `
.md-root { font-size: .8rem; line-height: 1.65; color: inherit; }
.md-root .md-h1 { font-size: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 2px solid var(--md-accent, #FF3E00); color: var(--md-accent, #FF3E00); }
.md-root .md-h2 { font-size: .9rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 5px; color: var(--md-head, currentColor); }
.md-root .md-h3 { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin: 10px 0 4px; color: var(--md-head, currentColor); opacity: .85; }
.md-root .md-h4 { font-size: .75rem; font-weight: 700; margin: 8px 0 3px; opacity: .75; }
.md-root .md-p  { margin: 4px 0; }
.md-root .md-spacer { height: 6px; }
.md-root .md-hr { border: none; border-top: 1px solid rgba(128,128,128,.2); margin: 12px 0; }
.md-root .md-blockquote { border-left: 3px solid var(--md-accent, #FF3E00); margin: 8px 0; padding: 6px 12px; background: rgba(255,62,0,.06); border-radius: 0 4px 4px 0; font-style: italic; opacity: .85; }
.md-root .md-ul { list-style: none; margin: 5px 0; padding: 0; }
.md-root .md-ol { list-style: none; margin: 5px 0; padding: 0; counter-reset: md-ol; }
.md-root .md-ul > .md-li { padding-left: 14px; position: relative; margin: 2px 0; }
.md-root .md-ul > .md-li::before { content: "▸"; position: absolute; left: 0; color: var(--md-accent, #FF3E00); font-size: .65rem; top: 2px; }
.md-root .md-ol > .md-li { padding-left: 22px; position: relative; margin: 2px 0; counter-increment: md-ol; }
.md-root .md-ol > .md-li::before { content: counter(md-ol) "."; position: absolute; left: 0; color: var(--md-accent, #FF3E00); font-weight: 700; font-size: .72rem; }
.md-root .md-inline-code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: .72rem; background: rgba(255,62,0,.1); color: var(--md-accent, #FF3E00); padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(255,62,0,.2); }
.md-root .md-code-block { margin: 10px 0; border-radius: 4px; overflow: hidden; border: 1px solid rgba(128,128,128,.2); background: #1a1a1a; }
.md-root .md-code-lang { display: block; background: rgba(255,62,0,.85); color: #fff; font-family: monospace; font-size: .65rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 2px 10px; }
.md-root .md-pre { margin: 0; padding: 12px 14px; overflow-x: auto; }
.md-root .md-pre code { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; font-size: .72rem; line-height: 1.6; color: #e2e8f0; white-space: pre; }
.md-root .md-table-wrap { overflow-x: auto; margin: 10px 0; border-radius: 4px; border: 1px solid rgba(128,128,128,.2); }
.md-root .md-table { width: 100%; border-collapse: collapse; font-size: .75rem; }
.md-root .md-th { background: rgba(255,62,0,.12); color: var(--md-accent, #FF3E00); font-weight: 800; text-transform: uppercase; letter-spacing: .04em; font-size: .65rem; padding: 7px 12px; text-align: left; border-bottom: 2px solid rgba(255,62,0,.3); white-space: nowrap; }
.md-root .md-td { padding: 6px 12px; border-bottom: 1px solid rgba(128,128,128,.12); vertical-align: top; }
.md-root .md-tr:last-child .md-td { border-bottom: none; }
.md-root .md-tr:hover .md-td { background: rgba(128,128,128,.05); }
.md-root .md-link { color: var(--md-accent, #FF3E00); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px; }
.md-root .md-link:hover { text-decoration-style: solid; }
.md-root strong { font-weight: 700; }
.md-root em { font-style: italic; }
.md-root del { text-decoration: line-through; opacity: .6; }
`;

let stylesInjected = false;
const ensureStyles = () => {
  if (stylesInjected) return;
  const el = document.createElement('style');
  el.setAttribute('data-md-view', '1');
  el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
};

/* ────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────── */
interface Props {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<Props> = ({ content, className = '' }) => {
  ensureStyles();

  // If the content looks like raw HTML, render it as-is (trust level: same as before)
  const isHtml = /^\s*<[a-zA-Z]/.test(content.trim());

  return (
    <div
      className={`md-root ${className}`}
      dangerouslySetInnerHTML={{ __html: isHtml ? content : md2html(content) }}
    />
  );
};
