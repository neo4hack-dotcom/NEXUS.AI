import React from 'react';

const inline = (s: string): string =>
  s
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code style="font-family:monospace;font-size:0.75rem;background:rgba(255,62,0,.12);color:#FF3E00;padding:1px 5px;border-radius:2px">$1</code>');

function md2html(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^---+$/.test(line)) {
      closeList();
      out.push('<hr style="border:none;border-top:1px solid rgba(128,128,128,.25);margin:12px 0">');
      continue;
    }

    const m3 = line.match(/^###\s+(.+)/);
    const m2 = line.match(/^##\s+(.+)/);
    const m1 = line.match(/^#\s+(.+)/);
    if (m3) { closeList(); out.push(`<h3 style="font-size:.8rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 4px">${inline(m3[1])}</h3>`); continue; }
    if (m2) { closeList(); out.push(`<h2 style="font-size:.95rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 6px">${inline(m2[1])}</h2>`); continue; }
    if (m1) { closeList(); out.push(`<h1 style="font-size:1.1rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px">${inline(m1[1])}</h1>`); continue; }

    const bq = line.match(/^>\s*(.+)/);
    if (bq) { closeList(); out.push(`<blockquote style="border-left:2px solid #FF3E00;padding-left:10px;color:#888;font-style:italic;margin:6px 0">${inline(bq[1])}</blockquote>`); continue; }

    const ul = line.match(/^[ \t]*[-*•+]\s+(.+)/);
    if (ul) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul style="list-style:disc;margin:6px 0;padding-left:18px">'); inUl = true; }
      out.push(`<li style="margin:2px 0">${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^[ \t]*\d+\.\s+(.+)/);
    if (ol) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol style="list-style:decimal;margin:6px 0;padding-left:18px">'); inOl = true; }
      out.push(`<li style="margin:2px 0">${inline(ol[1])}</li>`);
      continue;
    }

    if (line === '') {
      closeList();
      out.push('<br>');
      continue;
    }

    closeList();
    out.push(`<p style="margin:3px 0;line-height:1.6">${inline(line)}</p>`);
  }

  closeList();
  return out.join('');
}

interface Props {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<Props> = ({ content, className = '' }) => (
  <div
    className={`text-sm text-neutral-800 dark:text-neutral-200 ${className}`}
    dangerouslySetInnerHTML={{ __html: md2html(content) }}
  />
);
