/* === Export helpers === */
/* PDF: opens a self-contained print window styled for paper.
   EML: builds an RFC-822 .eml file the user can double-click to open in Outlook. */

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

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const renderMarkdownLite = (md: string): string => {
  // Minimal markdown → HTML (headings, bold, italics, bullets, code)
  let html = escapeHtml(md);
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
        <h2>${escapeHtml(s.heading)}</h2>
        <div class="body">${renderMarkdownLite(s.body || '')}</div>
      </section>
    `
    )
    .join('');

  w.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: #0a0a0b;
        background: #fff;
        font-size: 11pt;
        line-height: 1.55;
        margin: 0;
      }
      header {
        border-bottom: 4px solid #FF3E00;
        padding-bottom: 12pt;
        margin-bottom: 24pt;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
      }
      .brand {
        font-weight: 900;
        font-size: 28pt;
        letter-spacing: -0.04em;
        text-transform: uppercase;
        line-height: 0.9;
      }
      .brand .dot { color: #FF3E00; }
      .meta { text-align: right; color: #555; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 { font-size: 22pt; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase; }
      h2 { font-size: 14pt; margin-top: 22pt; border-left: 3px solid #FF3E00; padding-left: 10pt; }
      h3 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.1em; color: #FF3E00; margin-bottom: 4pt; }
      .body p { margin: 6pt 0; }
      .body ul { padding-left: 18pt; }
      .body li { margin: 3pt 0; }
      .body strong { color: #000; }
      section.print-section { break-inside: avoid; margin-bottom: 18pt; }
      footer { position: fixed; bottom: 8mm; left: 16mm; right: 16mm; color: #888; font-size: 8pt; text-align: center; border-top: 1px solid #ddd; padding-top: 6pt; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <div class="brand">NEXUS<span class="dot">.AI</span></div>
        <h1 style="margin-top:8pt">${escapeHtml(title)}</h1>
      </div>
      <div class="meta">
        <div>Confidential</div>
        <div>${today}</div>
      </div>
    </header>
    ${sectionHtml}
    <footer>NEXUS.AI • AI Project Operations Platform</footer>
    <script>
      window.onload = function () {
        setTimeout(function () { window.print(); }, 250);
      };
    </script>
  </body>
</html>`);
  w.document.close();
};
