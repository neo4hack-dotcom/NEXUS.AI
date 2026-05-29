"""
DOINg.AI — User Guide PDF generator.

Produces a fully branded, visual user guide that mirrors the in-app
"booklet" aesthetic (brand orange #FF3E00, brutalist typography, mono
accents, KPI strips, diagrams). All content is PUBLIC — no admin
features are described. The technical annex covers architecture and
the role/permission model.

Run:
  python3 scripts/generate_user_guide.py
Output:
  ./DOINg-AI-User-Guide.pdf
"""

from __future__ import annotations

import math
from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas

# ── Brand system ─────────────────────────────────────────────────────────────
BRAND     = HexColor('#FF3E00')          # signature orange
INK_950   = HexColor('#0A0B0E')          # near-black (cover background)
INK_900   = HexColor('#15171C')          # dark surface
INK_800   = HexColor('#1F222A')          # slightly raised
INK_700   = HexColor('#2D3038')          # borders
INK_500   = HexColor('#6E7280')          # muted text on dark
INK_400   = HexColor('#9CA1AB')
WHITE     = HexColor('#FFFFFF')
PAPER     = HexColor('#FAFAF8')          # warm off-white for content pages
TEXT      = HexColor('#0F1115')          # near-black ink for body
MUTED     = HexColor('#6E7280')
LINE      = HexColor('#E0DFD9')          # warm beige rule
ACCENT_2  = HexColor('#3B82F6')          # secondary chart blue
ACCENT_3  = HexColor('#10B981')          # secondary chart green
ACCENT_4  = HexColor('#F59E0B')          # secondary chart amber

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

# ── Page-frame helpers ───────────────────────────────────────────────────────
def page_frame_light(c: rl_canvas.Canvas, page_num: int, section: str) -> None:
    """Running header + page-number footer on content pages."""
    # Subtle top rule
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(MARGIN, PAGE_H - 12 * mm, PAGE_W - MARGIN, PAGE_H - 12 * mm)

    # Header — left: brand wordmark, right: section name
    c.setFillColor(TEXT)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(MARGIN, PAGE_H - 9 * mm, 'DOINg')
    c.setFillColor(BRAND)
    tw = c.stringWidth('DOINg', 'Helvetica-Bold', 7)
    c.drawString(MARGIN + tw, PAGE_H - 9 * mm, '.AI')
    c.setFillColor(TEXT)
    c.drawString(MARGIN + tw + c.stringWidth('.AI', 'Helvetica-Bold', 7) + 4, PAGE_H - 9 * mm, '— USER GUIDE')

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 7)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 9 * mm, section.upper())

    # Footer — page number + tagline
    c.setStrokeColor(LINE)
    c.line(MARGIN, 12 * mm, PAGE_W - MARGIN, 12 * mm)
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(MARGIN, 8 * mm, f'{page_num:02d}')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 7)
    c.drawString(MARGIN + 8, 8 * mm, 'MAKE EVERY PROJECT VISIBLE')
    c.drawRightString(PAGE_W - MARGIN, 8 * mm, 'doing.ai')


def page_frame_dark(c: rl_canvas.Canvas) -> None:
    """Full-bleed dark background for covers + section dividers."""
    c.setFillColor(INK_950)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


# ── Typography helpers (using reportlab built-ins for portability) ───────────
def text_paragraph(c, x, y, width, text, font='Helvetica', size=10,
                   leading=14, color=TEXT, align='left'):
    """Manual paragraph wrapper that doesn't depend on platypus inside canvas."""
    c.setFillColor(color)
    c.setFont(font, size)
    words = text.split()
    line, lines = '', []
    for w in words:
        candidate = (line + ' ' + w).strip()
        if c.stringWidth(candidate, font, size) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    for i, ln in enumerate(lines):
        cy = y - i * leading
        if align == 'right':
            c.drawRightString(x + width, cy, ln)
        elif align == 'center':
            c.drawCentredString(x + width / 2, cy, ln)
        else:
            c.drawString(x, cy, ln)
    return y - len(lines) * leading  # bottom of paragraph


def section_kicker(c, x, y, text, color=BRAND, size=8):
    c.setFillColor(color)
    c.setFont('Helvetica-Bold', size)
    c.drawString(x, y, text.upper())


def heading(c, x, y, text, size=22, color=TEXT):
    c.setFillColor(color)
    c.setFont('Helvetica-Bold', size)
    c.drawString(x, y, text)


def small_caption(c, x, y, text, color=MUTED, size=7, font='Helvetica'):
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, text)


def hrule(c, x, y, width, color=LINE, thickness=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(thickness)
    c.line(x, y, x + width, y)


# ── Reusable visual elements ─────────────────────────────────────────────────
def chip(c, x, y, label, color=BRAND, text_color=WHITE, size=7, pad=4):
    w = c.stringWidth(label, 'Helvetica-Bold', size) + 2 * pad
    h = size + 4
    c.setFillColor(color)
    c.rect(x, y - h + 3, w, h, stroke=0, fill=1)
    c.setFillColor(text_color)
    c.setFont('Helvetica-Bold', size)
    c.drawString(x + pad, y - h + 7, label.upper())
    return w


def kpi_card(c, x, y, w, h, label, value, color=BRAND):
    # Card border
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.rect(x, y, w, h, stroke=1, fill=0)
    # Top accent bar
    c.setFillColor(color)
    c.rect(x, y + h - 3, w, 3, stroke=0, fill=1)
    # Label
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(x + 6, y + h - 14, label.upper())
    # Value
    c.setFillColor(TEXT)
    c.setFont('Helvetica-Bold', 18)
    c.drawString(x + 6, y + 8, str(value))


def tip_box(c, x, y, w, title, body):
    """Brand-bordered pro-tip callout. Returns new bottom y."""
    pad = 8
    # Estimate height by simulating wrap
    c.setFont('Helvetica', 9)
    inner_w = w - 2 * pad - 18
    words = body.split()
    line, lines = '', []
    for word in words:
        cand = (line + ' ' + word).strip()
        if c.stringWidth(cand, 'Helvetica', 9) <= inner_w:
            line = cand
        else:
            if line: lines.append(line)
            line = word
    if line: lines.append(line)
    h = pad * 2 + 14 + 12 * len(lines)
    # Box
    c.setFillColor(HexColor('#FFF4EE'))
    c.setStrokeColor(BRAND)
    c.setLineWidth(0.8)
    c.rect(x, y - h, w, h, stroke=1, fill=1)
    # Vertical brand bar
    c.setFillColor(BRAND)
    c.rect(x, y - h, 4, h, stroke=0, fill=1)
    # Title
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(x + pad + 8, y - pad - 8, title.upper())
    # Body
    c.setFillColor(TEXT)
    c.setFont('Helvetica', 9)
    for i, ln in enumerate(lines):
        c.drawString(x + pad + 8, y - pad - 22 - i * 12, ln)
    return y - h - 4


def bullet_list(c, x, y, w, items, bullet_color=BRAND):
    """Square-bullet list with one-line items wrapped to width."""
    cy = y
    for it in items:
        c.setFillColor(bullet_color)
        c.rect(x, cy - 7, 4, 4, stroke=0, fill=1)
        cy = text_paragraph(c, x + 12, cy - 5, w - 12, it, size=9, leading=12)
        cy -= 6
    return cy


def feature_visual(c, x, y, w, h, icon_shape='grid'):
    """Stylised abstract pictogram for a feature page."""
    c.setStrokeColor(BRAND)
    c.setLineWidth(1)
    c.setFillColor(INK_950)
    c.rect(x, y - h, w, h, stroke=1, fill=1)
    if icon_shape == 'grid':
        # 3x3 grid of squares
        gw, gh = (w - 24) / 3, (h - 24) / 3
        for r in range(3):
            for col in range(3):
                fill_brand = (r + col) % 3 == 0
                cx = x + 12 + col * gw
                cy = y - 12 - (r + 1) * gh
                c.setFillColor(BRAND if fill_brand else INK_700)
                c.rect(cx, cy, gw - 4, gh - 4, stroke=0, fill=1)
    elif icon_shape == 'bars':
        # Vertical bars rising left→right
        bw = (w - 24) / 5
        hs = [0.3, 0.5, 0.4, 0.85, 0.65]
        for i, frac in enumerate(hs):
            bh = (h - 16) * frac
            c.setFillColor(BRAND if i == 3 else INK_700)
            c.rect(x + 12 + i * bw, y - h + 8, bw - 4, bh, stroke=0, fill=1)
    elif icon_shape == 'flow':
        # Three connected boxes with arrows
        box_w = (w - 50) / 3
        box_h = 18
        cy = y - h / 2 - box_h / 2
        for i in range(3):
            cx = x + 12 + i * (box_w + 10)
            c.setFillColor(BRAND if i == 2 else INK_700)
            c.rect(cx, cy, box_w, box_h, stroke=0, fill=1)
            if i < 2:
                ax = cx + box_w
                c.setStrokeColor(WHITE)
                c.setLineWidth(0.8)
                c.line(ax, cy + box_h / 2, ax + 10, cy + box_h / 2)
                c.line(ax + 7, cy + box_h / 2 - 3, ax + 10, cy + box_h / 2)
                c.line(ax + 7, cy + box_h / 2 + 3, ax + 10, cy + box_h / 2)
    elif icon_shape == 'donut':
        # Donut split into 3 slices
        cx, cy = x + w / 2, y - h / 2
        r = min(w, h) / 2 - 12
        c.setStrokeColor(INK_700)
        c.setLineWidth(8)
        c.circle(cx, cy, r, stroke=1, fill=0)
        # Brand arc (~60%)
        c.setStrokeColor(BRAND)
        c.setLineWidth(8)
        from reportlab.graphics.shapes import Path  # noqa
        # Use canvas arc
        c.arc(cx - r, cy - r, cx + r, cy + r, startAng=90, extent=-220)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 12)
        c.drawCentredString(cx, cy - 4, '60%')
    elif icon_shape == 'gantt':
        # Mini-gantt rows
        row_h = (h - 16) / 4
        widths = [(0.1, 0.4), (0.3, 0.65), (0.55, 0.85), (0.2, 0.95)]
        colors = [BRAND, INK_500, BRAND, INK_500]
        for i, ((start, end), col) in enumerate(zip(widths, colors)):
            ry = y - 12 - (i + 1) * row_h + 4
            bx = x + 12 + start * (w - 24)
            bw = (end - start) * (w - 24)
            c.setFillColor(col)
            c.rect(bx, ry, bw, row_h - 6, stroke=0, fill=1)
    elif icon_shape == 'people':
        # Three stylised heads + shoulders
        gx = w / 3
        for i in range(3):
            cx = x + gx * (i + 0.5)
            cy = y - h / 2
            c.setFillColor(BRAND if i == 1 else INK_500)
            c.circle(cx, cy + 8, 6, stroke=0, fill=1)
            c.rect(cx - 9, cy - 10, 18, 12, stroke=0, fill=1)
    elif icon_shape == 'chat':
        # Speech bubble
        bx, by = x + 14, y - h + 18
        bw, bh = w - 28, h - 32
        c.setFillColor(BRAND)
        c.rect(bx, by, bw, bh, stroke=0, fill=1)
        # Tail
        c.setFillColor(BRAND)
        from reportlab.graphics.shapes import Polygon  # noqa
        c.beginPath()
        # Draw tail manually
        c.setStrokeColor(BRAND)
        c.setLineWidth(0)
        # Use canvas path
        p = c.beginPath()
        p.moveTo(bx + bw * 0.2, by)
        p.lineTo(bx + bw * 0.15, by - 8)
        p.lineTo(bx + bw * 0.3, by)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
        # Lines inside bubble
        c.setFillColor(WHITE)
        for i in range(3):
            c.rect(bx + 8, by + bh - 14 - i * 10, bw - 16 - i * 12, 4, stroke=0, fill=1)
    elif icon_shape == 'lightbulb':
        cx, cy = x + w / 2, y - h / 2 + 8
        # Bulb
        c.setFillColor(BRAND)
        c.circle(cx, cy, 22, stroke=0, fill=1)
        # Base
        c.setFillColor(INK_500)
        c.rect(cx - 10, cy - 30, 20, 6, stroke=0, fill=1)
        c.rect(cx - 8, cy - 36, 16, 4, stroke=0, fill=1)
        # Glow rays
        c.setStrokeColor(BRAND)
        c.setLineWidth(2)
        for i in range(8):
            ang = i * math.pi / 4
            r1, r2 = 28, 36
            x1, y1 = cx + r1 * math.cos(ang), cy + r1 * math.sin(ang)
            x2, y2 = cx + r2 * math.cos(ang), cy + r2 * math.sin(ang)
            c.line(x1, y1, x2, y2)


# ── Page builders ────────────────────────────────────────────────────────────
def draw_cover(c):
    page_frame_dark(c)
    # Brand bar top
    c.setFillColor(BRAND)
    c.rect(0, PAGE_H - 14, PAGE_W, 14, stroke=0, fill=1)
    # Kicker
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(MARGIN, PAGE_H - 60, 'EDITION 2026 · USER GUIDE · ENGLISH')

    # Big wordmark
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 72)
    c.drawString(MARGIN, PAGE_H - 145, 'DOINg')
    c.setFillColor(BRAND)
    tw = c.stringWidth('DOINg', 'Helvetica-Bold', 72)
    c.drawString(MARGIN + tw, PAGE_H - 145, '.AI')

    # Tagline
    c.setFillColor(INK_400)
    c.setFont('Helvetica', 14)
    c.drawString(MARGIN, PAGE_H - 175, 'Make every project visible.')
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 28)
    text_paragraph(c, MARGIN, PAGE_H - 230, PAGE_W - 2 * MARGIN,
                   'Your local-first AI Project Operations workspace.',
                   font='Helvetica-Bold', size=28, leading=32, color=WHITE)

    # Decorative grid pattern (right side)
    grid_x = PAGE_W - 80 * mm
    grid_y = PAGE_H - 280
    for r in range(8):
        for col in range(6):
            cx = grid_x + col * 12
            cy = grid_y - r * 12
            if (r + col) % 5 == 0:
                c.setFillColor(BRAND)
            elif (r + col) % 3 == 0:
                c.setFillColor(INK_700)
            else:
                continue
            c.rect(cx, cy, 8, 8, stroke=0, fill=1)

    # Three-pillar mini-summary near bottom
    pillars = [
        ('LOCAL-FIRST',    'Your data lives on your machine. Always available, never leaked.'),
        ('AI-AUGMENTED',   'Local LLM enrichment for every entity — never to the cloud.'),
        ('TEAM-AWARE',     'Real-time SSE sync across your collaborators.'),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 24) / 3
    py = 110
    for i, (k, v) in enumerate(pillars):
        cx = MARGIN + i * (col_w + 12)
        c.setFillColor(BRAND)
        c.rect(cx, py + 56, 32, 3, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(cx, py + 42, k)
        c.setFillColor(INK_400)
        text_paragraph(c, cx, py + 28, col_w, v, font='Helvetica', size=8,
                       leading=11, color=INK_400)

    # Bottom strip
    c.setFillColor(INK_900)
    c.rect(0, 0, PAGE_W, 32, stroke=0, fill=1)
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(MARGIN, 12, f'V1.0  ·  {date.today().strftime("%B %Y").upper()}')
    c.setFillColor(WHITE)
    c.setFont('Helvetica', 8)
    c.drawRightString(PAGE_W - MARGIN, 12, 'DOING.AI  ·  USER EDITION')


def draw_toc(c, page_num):
    page_frame_light(c, page_num, 'Contents')
    y = PAGE_H - 35 * mm
    section_kicker(c, MARGIN, y, 'TABLE OF CONTENTS')
    heading(c, MARGIN, y - 22, 'What you will find inside', size=24)
    hrule(c, MARGIN, y - 32, 40, color=BRAND, thickness=2)
    y -= 60

    parts = [
        ('01', 'Welcome',             'Mission, principles, and how this guide is organised.', 4),
        ('02', 'Workspace Tour',      'The sidebar, the canvas, and the always-on assistant.', 6),
        ('03', 'Project Management',  'Projects, Timeline, Risk Heatmap, Communications.', 9),
        ('04', 'Catalogs',            'Technologies, Repositories, Hackathons, MCP Hub, AI Agents.', 14),
        ('05', 'Collaboration',       'Working Groups and Weekly Check-in.', 20),
        ('06', 'Personal Tools',      'Smart ToDo and the Wish List.', 23),
        ('07', 'AI Companion',        'DOINg Assistant, AI Executive Insight, Command Palette.', 25),
        ('08', 'Notifications & You', 'Alerts, profile, theme and self-service password change.', 27),
        ('09', 'Tips & Best Practice','Habits that compound across the workspace.', 29),
        ('A',  'Annex — Architecture','Local-first storage, real-time sync, LLM integration.', 30),
        ('B',  'Annex — Permissions', 'The role × group matrix that drives every screen.', 33),
        ('C',  'Annex — Shortcuts',   'Keyboard shortcuts and glossary.', 35),
    ]
    for num, title, desc, page in parts:
        # Number block
        c.setFillColor(BRAND)
        c.rect(MARGIN, y - 16, 22, 22, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 11)
        c.drawCentredString(MARGIN + 11, y - 9, num)
        # Title
        c.setFillColor(TEXT)
        c.setFont('Helvetica-Bold', 12)
        c.drawString(MARGIN + 32, y - 4, title)
        # Description
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 9)
        c.drawString(MARGIN + 32, y - 16, desc)
        # Page number
        c.setFillColor(BRAND)
        c.setFont('Helvetica-Bold', 11)
        c.drawRightString(PAGE_W - MARGIN, y - 8, f'p. {page:02d}')
        # Subtle separator
        c.setStrokeColor(LINE)
        c.setLineWidth(0.3)
        c.line(MARGIN + 32, y - 22, PAGE_W - MARGIN, y - 22)
        y -= 32


def draw_section_divider(c, number, title, kicker, snippet):
    page_frame_dark(c)
    # Big orange numeral
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 200)
    c.drawString(MARGIN, PAGE_H - 220, number)

    # Vertical brand line
    c.setStrokeColor(BRAND)
    c.setLineWidth(2)
    c.line(PAGE_W - MARGIN - 90, 80, PAGE_W - MARGIN - 90, PAGE_H - 80)

    # Kicker
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(PAGE_W - MARGIN - 80, PAGE_H - 220, kicker.upper())

    # Title
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 28)
    c.drawString(PAGE_W - MARGIN - 80, PAGE_H - 250, title)

    # Snippet
    c.setFillColor(INK_400)
    text_paragraph(c, PAGE_W - MARGIN - 80, PAGE_H - 285, 80, snippet,
                   font='Helvetica', size=10, leading=14, color=INK_400)

    # Decorative micro-grid bottom-left
    for r in range(4):
        for col in range(10):
            cx = MARGIN + col * 8
            cy = 70 - r * 8
            if (r + col) % 4 == 0:
                c.setFillColor(BRAND)
            else:
                c.setFillColor(INK_800)
            c.rect(cx, cy, 5, 5, stroke=0, fill=1)


def draw_welcome(c, page_num):
    page_frame_light(c, page_num, 'Welcome')
    y = PAGE_H - 35 * mm
    section_kicker(c, MARGIN, y, '01  ·  WELCOME')
    heading(c, MARGIN, y - 22, 'What is DOINg.AI?', size=26)
    hrule(c, MARGIN, y - 32, 40, color=BRAND, thickness=2)
    y -= 56

    body1 = (
        'DOINg.AI is your team\'s local-first AI Project Operations workspace. '
        'It brings together every moving part of your innovation portfolio — projects, '
        'technologies, repositories, hackathons, MCP servers, AI agents, working groups, '
        'and personal todos — under one dark, keyboard-friendly canvas. Your data lives on '
        'your machine; nothing is shipped to the cloud unless you explicitly export it.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, body1, size=10.5, leading=15)
    y -= 14

    body2 = (
        'Every entity is enriched by your locally configured language model — descriptions, '
        'summaries, briefs, risk assessments. The same LLM powers a built-in assistant that '
        'answers questions about the state of your portfolio in plain English. Whatever your '
        'role, DOINg.AI surfaces the right amount of detail for the work you actually do.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, body2, size=10.5, leading=15)
    y -= 28

    # Three pillars infographic
    section_kicker(c, MARGIN, y, 'THE THREE PILLARS', size=8)
    y -= 16
    col_w = (PAGE_W - 2 * MARGIN - 24) / 3
    pillars = [
        (BRAND,     'LOCAL-FIRST',
         'localStorage + db.json on your network. Real-time sync over SSE between teammates. Zero cloud dependency.'),
        (ACCENT_2,  'AI-AUGMENTED',
         'Plug your Ollama, LM-Studio, or n8n endpoint. Every prompt template is editable. Models never see public internet unless you wire it that way.'),
        (ACCENT_3,  'TEAM-AWARE',
         'Four roles (admin / manager / contributor / viewer) shape every screen via a centralised permission matrix.'),
    ]
    for i, (col, title, desc) in enumerate(pillars):
        cx = MARGIN + i * (col_w + 12)
        # Vertical color bar
        c.setFillColor(col)
        c.rect(cx, y - 130, 4, 130, stroke=0, fill=1)
        # Title
        c.setFillColor(TEXT)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(cx + 12, y - 12, title)
        # Desc
        text_paragraph(c, cx + 12, y - 30, col_w - 16, desc,
                       size=9, leading=12, color=MUTED)
    y -= 150

    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 'How to read this guide',
            'Sections 03–06 walk through what you can do in each part of the app. '
            'Annex A explains how it all fits together; Annex B is the full permission matrix; '
            'Annex C is for keyboard-loving users.')


def draw_workspace_tour(c, page_num):
    page_frame_light(c, page_num, 'Workspace Tour')
    y = PAGE_H - 35 * mm
    section_kicker(c, MARGIN, y, '02  ·  WORKSPACE TOUR')
    heading(c, MARGIN, y - 22, 'Three regions, one keyboard', size=24)
    hrule(c, MARGIN, y - 32, 40, color=BRAND, thickness=2)
    y -= 56

    intro = (
        'The DOINg.AI workspace has three regions: the sidebar on the left (your navigation), '
        'the main canvas (where the work happens), and the top bar (where the AI companion and '
        'command palette live). All three are keyboard-first.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, intro, size=10, leading=14)
    y -= 18

    # Sidebar mockup on the left, callouts on the right
    side_x, side_y, side_w, side_h = MARGIN, y - 280, 60, 280
    # Sidebar background
    c.setFillColor(INK_900)
    c.rect(side_x, side_y, side_w, side_h, stroke=0, fill=1)
    # DOINg.AI logo at top
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(side_x + 6, side_y + side_h - 14, 'DOINg')
    c.setFillColor(BRAND)
    c.drawString(side_x + 6 + c.stringWidth('DOINg', 'Helvetica-Bold', 7), side_y + side_h - 14, '.AI')
    # Live dot
    c.setFillColor(ACCENT_3)
    c.circle(side_x + 8, side_y + side_h - 26, 2, stroke=0, fill=1)
    c.setFillColor(INK_400)
    c.setFont('Helvetica', 5)
    c.drawString(side_x + 14, side_y + side_h - 28, 'SERVER LIVE')

    # Fake menu rows
    rows = [
        ('Dashboard', False), ('Projects', True),  ('Timeline', False),
        ('Risk Heatmap', False), ('Communications', False),
        ('Technologies', False), ('Repositories', False),
        ('Hackathons', False), ('MCP Hub', False), ('AI Agents', False),
        ('Working Groups', False), ('Weekly Check-in', False),
        ('Smart ToDo', False), ('Wish List', False), ('User Guide', False),
    ]
    rowy = side_y + side_h - 42
    for label, active in rows:
        if active:
            c.setFillColor(BRAND)
            c.rect(side_x, rowy - 9, side_w, 12, stroke=0, fill=1)
            c.setFillColor(WHITE)
        else:
            c.setFillColor(INK_500)
        c.setFont('Helvetica-Bold', 6)
        c.drawString(side_x + 8, rowy - 5, label.upper())
        rowy -= 14
        if rowy < side_y + 30: break

    # User card at bottom of sidebar
    c.setFillColor(INK_800)
    c.rect(side_x, side_y, side_w, 22, stroke=0, fill=1)
    c.setFillColor(BRAND)
    c.rect(side_x + 4, side_y + 4, 12, 12, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 5)
    c.drawCentredString(side_x + 10, side_y + 7, 'JD')
    c.setFillColor(WHITE)
    c.drawString(side_x + 20, side_y + 12, 'JANE DOE')
    c.setFillColor(BRAND)
    c.drawString(side_x + 20, side_y + 5, 'CONTRIBUTOR')

    # Callouts on the right
    callouts = [
        ('1', 'Live sync indicator',
         'Green = your backend is reachable and pushing real-time updates.'),
        ('2', 'Functional groups',
         'Items are grouped by what they DO: management, catalogs, collaboration, tools.'),
        ('3', 'Active highlight',
         'The current screen is highlighted in brand orange.'),
        ('4', 'Your identity card',
         'Always visible. Click the key icon to change your password; the door icon to sign out.'),
    ]
    cx = side_x + side_w + 24
    cy = side_y + side_h - 14
    for num, title, desc in callouts:
        c.setFillColor(BRAND)
        c.rect(cx, cy - 14, 14, 14, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(cx + 7, cy - 11, num)
        c.setFillColor(TEXT)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(cx + 22, cy - 4, title)
        text_paragraph(c, cx + 22, cy - 18, PAGE_W - MARGIN - cx - 22, desc,
                       size=9, leading=12, color=MUTED)
        cy -= 60

    y = side_y - 20
    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 'Light or dark?',
            'Use the moon/sun toggle in the bottom-left to switch themes. Your preference is '
            'remembered per device. Most users keep DOINg.AI in dark mode and run lighter apps '
            'side-by-side for contrast.')


def draw_feature_page(c, page_num, section_name, group_tag, group_color,
                      title, tagline, what_does, key_actions, tip_title, tip_body,
                      icon_shape='grid'):
    page_frame_light(c, page_num, section_name)
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, group_tag, color=group_color)
    heading(c, MARGIN, y - 14, title, size=24)
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Oblique', 11)
    c.drawString(MARGIN, y - 28, tagline)
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    # Two columns: text left, visual right
    text_w = PAGE_W - 2 * MARGIN - 90
    section_kicker(c, MARGIN, y, 'WHAT IT DOES', size=8)
    y -= 12
    y2 = text_paragraph(c, MARGIN, y, text_w, what_does, size=10, leading=14)

    # Visual on the right side, aligned with the top of the column
    feature_visual(c, PAGE_W - MARGIN - 75, y + 6, 75, 75, icon_shape=icon_shape)

    y = y2 - 22
    section_kicker(c, MARGIN, y, 'KEY ACTIONS', size=8)
    y -= 12
    y = bullet_list(c, MARGIN, y, PAGE_W - 2 * MARGIN, key_actions)
    y -= 14

    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, tip_title, tip_body)


def draw_ai_companion_page(c, page_num):
    page_frame_light(c, page_num, 'AI Companion')
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, 'PUBLIC · ⌘K', color=BRAND)
    heading(c, MARGIN, y - 14, 'Your AI Companion', size=24)
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Oblique', 11)
    c.drawString(MARGIN, y - 28, 'A locally-hosted brain that knows your portfolio.')
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    intro = (
        'DOINg.AI ships with three AI surfaces. All of them route to YOUR configured local LLM '
        '(Ollama, LM Studio, or any OpenAI-compatible endpoint). Nothing leaves your network.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, intro, size=10.5, leading=15)
    y -= 22

    # Three feature blocks side-by-side
    items = [
        ('DOINg Assistant',
         'Open the chat from the top bar. Ask "what slipped this week?", "summarise the AI Efficiency family", "draft a stakeholder email for project X" — the assistant has your filtered portfolio in context.',
         'chat'),
        ('AI Executive Insight',
         'A single-click portfolio brief generator. Click the orange "AI EXECUTIVE INSIGHT" button in the sidebar to get a structured paragraph fit for an Exco deck.',
         'lightbulb'),
        ('Command Palette',
         'Press ⌘K (or Ctrl+K). Fuzzy-jump to any view, search a project by name, or trigger a recently-used action. Faster than your cursor will ever be.',
         'bars'),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 24) / 3
    for i, (title, body, shape) in enumerate(items):
        cx = MARGIN + i * (col_w + 12)
        # Top visual
        feature_visual(c, cx, y, col_w, 70, icon_shape=shape)
        # Title
        c.setFillColor(TEXT)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(cx, y - 86, title)
        # Body
        text_paragraph(c, cx, y - 102, col_w, body, size=9, leading=12, color=MUTED)
    y -= 230

    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 'When the assistant gets stuck',
            'Open Settings → Local LLM (or ask an admin) to verify the connection. The assistant '
            'shows a single error toast and stays usable for browsing the rest of the app.')


def draw_notifications_profile_page(c, page_num):
    page_frame_light(c, page_num, 'Notifications & Profile')
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, 'PUBLIC', color=BRAND)
    heading(c, MARGIN, y - 14, 'Stay on track, stay you', size=24)
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Oblique', 11)
    c.drawString(MARGIN, y - 28, 'How DOINg.AI nudges you, and how to keep your account safe.')
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    # Two-column layout
    col_w = (PAGE_W - 2 * MARGIN - 16) / 2

    # Left: Notifications
    section_kicker(c, MARGIN, y, 'NOTIFICATIONS', size=8)
    c.setFillColor(TEXT)
    c.setFont('Helvetica-Bold', 14)
    c.drawString(MARGIN, y - 16, 'The Bell tells you when…')
    text_paragraph(c, MARGIN, y - 34, col_w,
                   'A project you own or are a member of has been silent for more than 10 days. '
                   'A task assigned to you slipped past its ETA. You haven\'t submitted a weekly '
                   'check-in in over a week. The unread count appears as a red badge on the '
                   'bell icon in the sidebar — click to open the centre and dismiss.',
                   size=9.5, leading=13, color=TEXT)

    # Right: Profile
    cx = MARGIN + col_w + 16
    section_kicker(c, cx, y, 'PROFILE & SECURITY', size=8)
    c.setFillColor(TEXT)
    c.setFont('Helvetica-Bold', 14)
    c.drawString(cx, y - 16, 'In your hands')
    text_paragraph(c, cx, y - 34, col_w,
                   'Click the KEY icon next to your name in the bottom-left to change your password '
                   'at any time. The form asks for your current password, then a new one (minimum '
                   '8 characters; a strength bar guides you to "Strong"). Passwords are hashed '
                   'with PBKDF2-SHA256 — never stored in plain text.',
                   size=9.5, leading=13, color=TEXT)

    y -= 160

    # Theme toggle visual + explanation
    section_kicker(c, MARGIN, y, 'THEME', size=8)
    y -= 12
    text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN,
                   'The moon/sun toggle next to the bell flips the entire workspace between dark '
                   '(default) and light. Your choice is remembered locally per browser. '
                   'Most regular users prefer dark mode for long sessions.',
                   size=10, leading=14)
    y -= 60

    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 'Forgot your password?',
            'Ask an admin in your team to use Settings → Security to send you a temporary '
            'password. You will be forced to choose a new one at the next sign-in.')


def draw_tips_page(c, page_num):
    page_frame_light(c, page_num, 'Tips & Best Practice')
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, 'GROW INTO IT', color=BRAND)
    heading(c, MARGIN, y - 14, 'Habits that compound', size=24)
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    tips = [
        ('Update your weekly check-in every Monday',
         'It takes two minutes and feeds the team\'s rituals, the dashboard, and any AI-generated portfolio briefs. Skip a week and the alert banner appears in your sidebar.'),
        ('Live in the command palette',
         'Press ⌘K. Type three letters. Jump. Faster than any menu, every single time.'),
        ('Treat the AI as a brain dump partner',
         'Paste in raw meeting notes, drop a competitor URL into a description, or ask the assistant "what should I prepare for the Friday review?" — it has read access to your portfolio.'),
        ('Tag aggressively, file lightly',
         'Two short tags (e.g. customer-experience, machine-learning) beat one paragraph of taxonomy. The dashboard and search both lean on tags.'),
        ('Use the Wish List instead of side-channel asks',
         'Need an MCP for system X? A new data feed? Drop it into the Wish List with a sponsor. Your sponsor and the admins see it the same day; conversations live next to the request.'),
        ('Treat the dashboard like a daily standup mirror',
         'Five minutes a morning. Anything red, you act on. Anything green, you ignore. That\'s it.'),
    ]
    for title, body in tips:
        # Number-less bullet — use the brand-coloured rule + bold title
        c.setFillColor(BRAND)
        c.rect(MARGIN, y - 6, 4, 14, stroke=0, fill=1)
        c.setFillColor(TEXT)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(MARGIN + 12, y, title)
        y -= 14
        y = text_paragraph(c, MARGIN + 12, y, PAGE_W - 2 * MARGIN - 12, body,
                           size=9.5, leading=13, color=MUTED)
        y -= 12


def draw_architecture_page(c, page_num):
    page_frame_light(c, page_num, 'Annex A — Architecture')
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, 'ANNEX A · TECHNICAL', color=TEXT)
    heading(c, MARGIN, y - 14, 'How the workspace fits together', size=22)
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    intro = (
        'DOINg.AI is a local-first three-tier app. Everything below your browser runs on hardware '
        'YOU control — there are no third-party SaaS dependencies in the critical path.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, intro, size=10, leading=14)
    y -= 20

    # Architecture diagram — boxes and arrows
    diag_x = MARGIN
    diag_y = y - 220
    diag_w = PAGE_W - 2 * MARGIN
    diag_h = 210
    c.setFillColor(INK_950)
    c.rect(diag_x, diag_y, diag_w, diag_h, stroke=0, fill=1)

    # Three columns: Browser | Backend | Storage/LLM
    col_w = diag_w / 3
    # Browser column
    bx = diag_x + 14
    by_top = diag_y + diag_h - 22
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(bx, by_top, 'BROWSER (REACT 19 + TYPESCRIPT)')
    boxes_b = [('UI Components', INK_700), ('Permission filter', INK_700),
               ('localStorage cache', BRAND), ('SSE client', INK_700)]
    for i, (label, col) in enumerate(boxes_b):
        ry = by_top - 22 - i * 36
        c.setFillColor(col)
        c.rect(bx, ry - 22, col_w - 30, 22, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(bx + 6, ry - 14, label.upper())

    # Backend column
    mx = diag_x + col_w + 6
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(mx, by_top, 'BACKEND (FASTAPI · PYTHON)')
    boxes_m = [('/api/data (CRUD)', INK_700), ('SSE broadcast', BRAND),
               ('Proxy endpoints', INK_700), ('Version check', INK_700)]
    for i, (label, col) in enumerate(boxes_m):
        ry = by_top - 22 - i * 36
        c.setFillColor(col)
        c.rect(mx, ry - 22, col_w - 30, 22, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(mx + 6, ry - 14, label.upper())

    # Storage column
    sx = diag_x + 2 * col_w + 6
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(sx, by_top, 'STORAGE + AI')
    boxes_s = [('db.json on disk', BRAND), ('localStorage mirror', INK_700),
               ('Local LLM (Ollama)', BRAND), ('External REST proxies', INK_700)]
    for i, (label, col) in enumerate(boxes_s):
        ry = by_top - 22 - i * 36
        c.setFillColor(col)
        c.rect(sx, ry - 22, col_w - 30, 22, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(sx + 6, ry - 14, label.upper())

    # Arrows between columns
    c.setStrokeColor(BRAND)
    c.setLineWidth(1.2)
    arrow_y = by_top - 22 - 22 / 2  # First-row mid
    # Browser → Backend
    a1_x1 = bx + col_w - 30
    a1_x2 = mx
    c.line(a1_x1, arrow_y, a1_x2, arrow_y)
    c.line(a1_x2 - 4, arrow_y + 3, a1_x2, arrow_y)
    c.line(a1_x2 - 4, arrow_y - 3, a1_x2, arrow_y)
    # Backend → Storage
    a2_x1 = mx + col_w - 30
    a2_x2 = sx
    c.line(a2_x1, arrow_y, a2_x2, arrow_y)
    c.line(a2_x2 - 4, arrow_y + 3, a2_x2, arrow_y)
    c.line(a2_x2 - 4, arrow_y - 3, a2_x2, arrow_y)
    # SSE back: backend → browser (dotted line above)
    c.setDash(2, 2)
    sse_y = arrow_y - 36
    c.line(a2_x1, sse_y, bx + col_w - 30, sse_y)
    c.line(bx + col_w - 24, sse_y + 3, bx + col_w - 30, sse_y)
    c.line(bx + col_w - 24, sse_y - 3, bx + col_w - 30, sse_y)
    c.setDash()

    # Legend
    c.setFillColor(INK_500)
    c.setFont('Helvetica', 7)
    c.drawString(diag_x + 8, diag_y + 12, 'SOLID  =  HTTP REQUEST/RESPONSE        DASHED  =  SSE PUSH (REAL-TIME)        ORANGE  =  CRITICAL PATH')

    y = diag_y - 20

    # Below: two side-by-side narrative blocks
    col_w = (PAGE_W - 2 * MARGIN - 16) / 2
    section_kicker(c, MARGIN, y, 'WRITE PATH', size=8)
    text_paragraph(c, MARGIN, y - 14, col_w,
                   'You mutate a field. React updates state, writes to localStorage IMMEDIATELY, then '
                   'debounces a POST to /api/data 400 ms later. The backend uses X-Base-Version for '
                   'optimistic concurrency; on conflict the local state wins until you act.',
                   size=9, leading=12, color=TEXT)

    cx = MARGIN + col_w + 16
    section_kicker(c, cx, y, 'READ / SYNC PATH', size=8)
    text_paragraph(c, cx, y - 14, col_w,
                   'Server pushes a "data_updated" event over SSE the moment any client writes. '
                   'Other tabs refresh in < 100 ms. Polling every 30 s acts as a safety net. '
                   'Pending local edits always win — never silently overwritten.',
                   size=9, leading=12, color=TEXT)


def draw_permission_matrix_page(c, page_num):
    page_frame_light(c, page_num, 'Annex B — Permissions')
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, 'ANNEX B · ROLES', color=TEXT)
    heading(c, MARGIN, y - 14, 'The Role × Group matrix', size=22)
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    intro = (
        'Every screen in DOINg.AI consults the same permission module to decide what to show. '
        'There are four ROLES, and the app is organised into five functional GROUPS. The cells '
        'below tell you what each role can do in each group.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, intro, size=10, leading=14)
    y -= 16

    # Matrix table
    headers = ['ROLE', 'G1 — MGMT', 'G2 — CATALOGS', 'G4 — COLLAB', 'PUBLIC']
    rows = [
        ('admin',       'all view · edit · AI', 'all view · edit · AI', 'all',              'all'),
        ('manager',     'all view · edit · AI', 'all view · edit · AI', 'own view · edit · AI', 'all'),
        ('contributor', 'own view · edit · AI', 'all view, own edit/AI', 'own view · edit · AI', 'all'),
        ('viewer',      'own view (no edit/AI)','all view, own edit (no AI)','own view · edit (no AI)','all'),
    ]
    col_widths = [55, 105, 110, 95, 65]
    row_h = 22
    total_w = sum(col_widths)

    # Header row
    cx = MARGIN
    c.setFillColor(INK_950)
    c.rect(cx, y - row_h, total_w, row_h, stroke=0, fill=1)
    for i, h in enumerate(headers):
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(cx + 6, y - row_h / 2 - 2, h)
        cx += col_widths[i]
    y -= row_h

    # Data rows
    for r, row in enumerate(rows):
        cx = MARGIN
        # Zebra
        if r % 2 == 0:
            c.setFillColor(HexColor('#F3F2EC'))
            c.rect(cx, y - row_h, total_w, row_h, stroke=0, fill=1)
        for i, cell in enumerate(row):
            c.setFillColor(TEXT if i == 0 else MUTED)
            c.setFont('Helvetica-Bold' if i == 0 else 'Helvetica', 9 if i == 0 else 8.5)
            c.drawString(cx + 6, y - row_h / 2 - 2, cell)
            cx += col_widths[i]
        # Bottom rule
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(MARGIN, y - row_h, MARGIN + total_w, y - row_h)
        y -= row_h

    y -= 16

    # Group glossary
    section_kicker(c, MARGIN, y, 'GROUP GLOSSARY', size=8)
    y -= 12
    groups = [
        ('G1', 'Project Management', 'Projects, Timeline, Risk Heatmap, Communications.'),
        ('G2', 'Catalogs',           'Code Repositories, Hackathons, MCP Hub, AI Agents.'),
        ('G4', 'Collaboration',      'Working Groups, Weekly Check-in.'),
        ('Public', 'Open to all',    'Dashboard, Technologies, Smart ToDo, Wish List, User Guide.'),
    ]
    for tag, name, desc in groups:
        # Tag badge
        chip(c, MARGIN, y, tag, color=BRAND if tag.startswith('G') else INK_700)
        c.setFillColor(TEXT)
        c.setFont('Helvetica-Bold', 9.5)
        c.drawString(MARGIN + 38, y - 4, name)
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 9)
        c.drawString(MARGIN + 138, y - 4, desc)
        y -= 18

    y -= 4
    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 'What "own" means',
            'For projects: "own" = you are the manager OR a member. So if an admin assigns you to '
            'a project, it becomes visible to you even if you didn\'t create it. Same logic for '
            'working groups (owner + members) and for the catalogs (creator only).')


def draw_shortcuts_page(c, page_num):
    page_frame_light(c, page_num, 'Annex C — Shortcuts')
    y = PAGE_H - 35 * mm
    chip(c, MARGIN, y + 8, 'ANNEX C · QUICK REFERENCE', color=TEXT)
    heading(c, MARGIN, y - 14, 'Keyboard shortcuts & glossary', size=22)
    hrule(c, MARGIN, y - 38, 40, color=BRAND, thickness=2)
    y -= 60

    # Shortcuts
    section_kicker(c, MARGIN, y, 'KEYBOARD SHORTCUTS', size=8)
    y -= 16
    shortcuts = [
        ('⌘ K  /  Ctrl K',      'Open the Command Palette (fuzzy navigation + project jump).'),
        ('Esc',                  'Close any modal, dialog, or dropdown.'),
        ('Enter',                'Confirm in dialogs; send in the assistant chat; submit forms.'),
        ('Shift + Enter',        'New line inside the assistant chat (without sending).'),
        ('Tab  /  Shift + Tab',  'Move between form fields. The app is fully keyboard-navigable.'),
    ]
    for keys, desc in shortcuts:
        c.setFillColor(INK_950)
        c.rect(MARGIN, y - 18, 110, 18, stroke=0, fill=1)
        c.setFillColor(BRAND)
        c.setFont('Courier-Bold', 9)
        c.drawString(MARGIN + 6, y - 12, keys)
        c.setFillColor(TEXT)
        c.setFont('Helvetica', 9)
        c.drawString(MARGIN + 122, y - 12, desc)
        y -= 24

    y -= 14

    # Glossary
    section_kicker(c, MARGIN, y, 'GLOSSARY', size=8)
    y -= 16
    glossary = [
        ('MCP',         'Model Context Protocol — the standard for letting LLMs call external tools.'),
        ('Agent',       'An autonomous (or semi-autonomous) AI program with a goal, tools, and prompts.'),
        ('Family',      'A grouping label (e.g. "AI Efficiency") that bundles related projects or MCPs together.'),
        ('SSE',         'Server-Sent Events — the one-way push channel the backend uses to broadcast updates.'),
        ('Silver copy', 'A clean, query-ready copy of source data in a data warehouse.'),
        ('Working Group', 'A standing cross-functional squad with its own tasks, meeting notes, and decisions.'),
        ('Wish',        'A documented need (project / MCP / agent / feature) routed to a sponsor for triage.'),
    ]
    for term, definition in glossary:
        c.setFillColor(BRAND)
        c.setFont('Helvetica-Bold', 9.5)
        c.drawString(MARGIN, y, term)
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 9)
        text_paragraph(c, MARGIN + 90, y, PAGE_W - 2 * MARGIN - 90, definition,
                       size=9, leading=12, color=TEXT)
        y -= 22


TEAL = HexColor('#028090')   # accent for IT/G5 section

def draw_data_feeds_page(c, page_num):
    page_frame_light(c, page_num, 'Data Platform — Data Feeds')
    y = PAGE_H - 35 * mm

    # Restricted access banner
    c.setFillColor(TEAL)
    c.rect(MARGIN, y + 16, PAGE_W - 2 * MARGIN, 14, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(MARGIN + 6, y + 20,
                 '🔒  RESTRICTED ACCESS — visible to Admin + users with the IT flag (Settings → Security)')

    chip(c, MARGIN, y, 'G5 · DATA PLATFORM', color=TEAL)
    heading(c, MARGIN, y - 20, 'Data Feeds', size=26)
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Oblique', 11)
    c.drawString(MARGIN, y - 34, 'The silver-copy & data-warehouse pipeline registry.')
    hrule(c, MARGIN, y - 44, 40, color=TEAL, thickness=2)
    y -= 68

    body = (
        'Centralised registry of every data pipeline that feeds your silver copies and data warehouses. '
        'Each feed documents the source platform, data type, refresh frequency, source → destination mapping, '
        'go-live date, JIRA reference, cost in Man-Days, and who is responsible (PM + developer). '
        'This section is visible to admins and to users whose profile carries the IT flag.'
    )
    y = text_paragraph(c, MARGIN, y, PAGE_W - 2 * MARGIN, body, size=10.5, leading=15)
    y -= 18

    # Field grid — two columns of fields
    section_kicker(c, MARGIN, y, 'TRACKED FIELDS PER FEED', size=8)
    y -= 14
    col_w = (PAGE_W - 2 * MARGIN - 16) / 2
    fields = [
        [
            ('Platform name',   'Source system — ex: Salesforce, SAP, Oracle, Snowflake'),
            ('Data type',       'Nature of data — "CRM events", "Finance ledger", "Product catalog"'),
            ('Frequency',       'realtime / hourly / daily / weekly / monthly / on_demand / other'),
            ('Source',          'Origin endpoint: DB, REST API, file export, streaming bus'),
            ('Destination',     'Silver copy table or DWH schema name'),
            ('Status',          'planned → in_dev → uat → production → deprecated'),
        ],
        [
            ('Production date', 'When the feed went live — ISO date'),
            ('JIRA ref',        'Ticket reference for full delivery traceability'),
            ('Cost (Man-Days)', 'Estimated delivery effort in person-days'),
            ('ETA',             'Expected go-live if not yet in production'),
            ('Project Manager', 'PM name — free-text'),
            ('Developer',       'Developer name + optional link to a presentation'),
        ],
    ]
    for col_idx, col_fields in enumerate(fields):
        fx = MARGIN + col_idx * (col_w + 16)
        fy = y
        for label, desc in col_fields:
            c.setFillColor(TEAL)
            c.rect(fx, fy - 5, 5, 5, stroke=0, fill=1)
            c.setFillColor(TEXT)
            c.setFont('Helvetica-Bold', 9)
            c.drawString(fx + 10, fy - 3, label)
            c.setFillColor(MUTED)
            c.setFont('Helvetica', 8.5)
            c.drawString(fx + 90, fy - 3, desc[:55])
            fy -= 16

    y -= 108

    tip_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 'Who can access this section?',
            'Data Feeds is visible to admin users AND any user whose profile has the IT flag enabled. '
            'An admin can toggle the IT flag per user in Settings → Security → user row. '
            'Non-IT users simply do not see this menu item in the sidebar.')


def draw_back_cover(c):
    page_frame_dark(c)
    # Brand bar bottom
    c.setFillColor(BRAND)
    c.rect(0, 0, PAGE_W, 14, stroke=0, fill=1)
    # Big quote-ish line
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 36)
    text_paragraph(c, MARGIN, PAGE_H - 130, PAGE_W - 2 * MARGIN,
                   'Local. Fast. AI-augmented.',
                   font='Helvetica-Bold', size=36, leading=42, color=WHITE)
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 36)
    c.drawString(MARGIN, PAGE_H - 210, 'Yours.')

    # Decorative bar
    c.setFillColor(BRAND)
    c.rect(MARGIN, PAGE_H - 240, 60, 4, stroke=0, fill=1)

    # Closing paragraph
    text_paragraph(c, MARGIN, PAGE_H - 270, 380,
                   'You now know what DOINg.AI can do for your team. Keep this booklet handy '
                   'for new joiners, or jump back into the in-app User Guide whenever you need '
                   'a quick reminder — the content there is always the live source of truth.',
                   size=11, leading=15, color=INK_400)

    # Small print
    c.setFillColor(INK_500)
    c.setFont('Helvetica', 7)
    c.drawString(MARGIN, 40, f'EDITION 2026  ·  V1.0  ·  GENERATED {date.today().isoformat()}')
    c.drawString(MARGIN, 28, 'PUBLIC EDITION  ·  ADMIN FEATURES NOT INCLUDED')

    # Decorative right grid
    grid_x = PAGE_W - 100
    grid_y = PAGE_H - 280
    for r in range(20):
        for col in range(7):
            cx = grid_x + col * 12
            cy = grid_y - r * 12
            if (r * col + r) % 5 == 0:
                c.setFillColor(BRAND)
            elif (r + col) % 3 == 0:
                c.setFillColor(INK_700)
            else:
                continue
            c.rect(cx, cy, 8, 8, stroke=0, fill=1)


# ── Main ─────────────────────────────────────────────────────────────────────
def build_pdf(output_path: Path) -> None:
    c = rl_canvas.Canvas(str(output_path), pagesize=A4)
    c.setTitle('DOINg.AI — User Guide')
    c.setAuthor('DOINg.AI')
    c.setSubject('User Guide — Public Edition')
    c.setKeywords(['DOINg.AI', 'User Guide', 'AI Project Operations'])

    page_num = 1

    # 1. Cover
    draw_cover(c)
    c.showPage()
    page_num += 1

    # 2. TOC
    draw_toc(c, page_num)
    c.showPage()
    page_num += 1

    # 3. Section 01 divider — Welcome
    draw_section_divider(c, '01', 'WELCOME', 'YOUR LOCAL-FIRST WORKSPACE',
        'A quick orientation to what DOINg.AI is, the three pillars that shape every screen, and how to use this booklet.')
    c.showPage()
    page_num += 1

    # 4. Welcome content
    draw_welcome(c, page_num)
    c.showPage()
    page_num += 1

    # 5. Section 02 divider — Workspace Tour
    draw_section_divider(c, '02', 'WORKSPACE TOUR', 'NAVIGATE WITHOUT FRICTION',
        'The three regions of the workspace, how the sidebar is organised, and the always-on AI surfaces.')
    c.showPage()
    page_num += 1

    # 6. Workspace Tour content
    draw_workspace_tour(c, page_num)
    c.showPage()
    page_num += 1

    # 7. Section 03 divider — Project Management
    draw_section_divider(c, '03', 'PROJECT MANAGEMENT', 'WHERE THE WORK LANDS',
        'Projects, Timeline, Risk Heatmap, Communications — the four screens that drive day-to-day delivery.')
    c.showPage()
    page_num += 1

    # 8. Projects
    draw_feature_page(
        c, page_num, 'Project Management', 'G1 · PROJECT MANAGEMENT', BRAND,
        'Projects',
        'The heart of your portfolio.',
        'Each project lives as a rich record: description, context, manager, members, tasks, milestones, '
        'tags, technologies, repositories, audit log. Status, dev stage, and innovation maturity are all '
        'first-class. Use the inline AI button to generate a structured project brief or a 1-page exec '
        'summary from your notes.',
        ['Create a project from scratch, from a template, or by importing raw notes via AI.',
         'Assign a manager and members; the assignment opens visibility for them.',
         'Add tasks with priority, ETA, weight, and dependencies — they roll up to the timeline.',
         'Flag a project as "important" or "archived"; filters everywhere honour those flags.',
         'Drop a presentation URL or linked-app reference for stakeholder-ready context.'],
        'Pro tip — use the Family field',
        'Group projects under a Family (e.g. "AI Efficiency", "Customer Experience"). The Dashboard '
        'breaks down KPIs by family, and the Wish List can reference them directly.',
        icon_shape='grid')
    c.showPage()
    page_num += 1

    # 9. Timeline
    draw_feature_page(
        c, page_num, 'Project Management', 'G1 · PROJECT MANAGEMENT', BRAND,
        'Timeline',
        'A Gantt across the whole portfolio.',
        'Every project becomes a bar from its start date to its deadline. Milestones appear as '
        'diamonds; tasks are nested rows. Filter by family, status, manager, or tag to focus on '
        'a slice, or zoom out to spot deadline clashes a quarter ahead.',
        ['Drag a bar to shift a project window — the change persists immediately.',
         'Click a milestone diamond to mark it done or edit its date.',
         'Use the today line to spot what should land this week.',
         'Hover any bar for a 2-line tooltip with project status + manager.'],
        'Pro tip — print this view',
        'The browser print dialog (⌘P / Ctrl P) renders the timeline as a landscape PDF — perfect '
        'for a quarterly steering deck.',
        icon_shape='gantt')
    c.showPage()
    page_num += 1

    # 10. Risk Heatmap
    draw_feature_page(
        c, page_num, 'Project Management', 'G1 · PROJECT MANAGEMENT', BRAND,
        'Risk Heatmap',
        'Probability × Impact, at a glance.',
        'Every project carries a risk profile. The Heatmap renders the whole portfolio on a 2D '
        'grid: probability on one axis, impact on the other. Hot zones glow brand orange so the '
        'highest-priority items pop. Hover any dot to inspect; click to jump into the project.',
        ['Adjust a project\'s risk score inline — heatmap updates instantly.',
         'Filter by family to compare risk profiles across initiatives.',
         'Use the AI mitigation generator to draft a starter mitigation plan from any project\'s context.'],
        'Pro tip — review weekly',
        'Treat the heatmap like a pre-meeting check. Anything in the top-right quadrant deserves '
        'a 60-second talk in your next stand-up — even if everything else is green.',
        icon_shape='donut')
    c.showPage()
    page_num += 1

    # 11. Communications
    draw_feature_page(
        c, page_num, 'Project Management', 'G1 · PROJECT MANAGEMENT', BRAND,
        'Communications',
        'Drafts, newsletters, weeklies — in one place.',
        'Compose weekly status updates, monthly newsletters, exec committee briefs, or info posts. '
        'Target one or more mailing lists, attach the project context, and let the LLM draft the '
        'body from your bullet points. Track draft vs sent.',
        ['Pick a template (weekly, newsletter, exco, info) — each has its own prompt.',
         'Attach related projects so the AI has full context when drafting.',
         'Choose mailing lists; the recipient count is computed live.',
         'Save as draft or mark as sent — the audit log preserves the trail.'],
        'Pro tip — start from a brief',
        'On a project page, click "Generate exec brief". Copy that into a new Communication and '
        'the AI will tighten it into a 3-paragraph newsletter — no blank-page anxiety.',
        icon_shape='chat')
    c.showPage()
    page_num += 1

    # 12. Section 04 divider — Catalogs
    draw_section_divider(c, '04', 'CATALOGS', 'SHARED ASSETS · LIVING INVENTORY',
        'Technologies, repositories, hackathons, MCP servers, AI agents — the building blocks the whole team can reach for.')
    c.showPage()
    page_num += 1

    # 13. Technologies
    draw_feature_page(
        c, page_num, 'Catalogs', 'PUBLIC · CATALOG', ACCENT_2,
        'Technologies',
        'A living radar of your stack.',
        'Catalogue every framework, library, database, language, or service your team has touched. '
        'Each entry carries a layer (frontend / backend / data / ML-AI / …) and a maturity status '
        '(evaluating / adopted / deprecated / hold). Projects link to the technologies they use; '
        'the dashboard counts adoption.',
        ['Add a tech in one click with name, category, layer, and maturity.',
         'Browse by layer or maturity; filter to "evaluating" to see your innovation funnel.',
         'Link a project to a tech — it appears on both pages.',
         'Use the AI enrichment to auto-fill description, version, license, and url.'],
        'Pro tip — quarterly tech review',
        'Once a quarter, scan the "Evaluating" tier with the team. Promote what stuck, deprecate '
        'what you stopped using. The catalog should reflect reality, not aspirations.',
        icon_shape='grid')
    c.showPage()
    page_num += 1

    # 14. Repositories
    draw_feature_page(
        c, page_num, 'Catalogs', 'G2 · CATALOGS', ACCENT_2,
        'Code Repositories',
        'Source-control, mapped to projects.',
        'A directory of every repo (Bitbucket, GitHub, GitLab, Azure) your team owns or contributes '
        'to. Visibility, provider, language, and project links are all first-class. The built-in '
        'AI provider scanner can bulk-import an entire workspace or org.',
        ['Add a repo manually or bulk-import from your provider with a single token.',
         'Link a repo to one or more projects — appears on both records.',
         'Use the visibility chip to spot private repos at a glance.',
         'Search by language to find your Python or TypeScript estate in a click.'],
        'Pro tip — keep it accurate',
        'When you spin up a new repo, add it here the same day. A 30-second discipline; the '
        'catalog stays trustworthy for everyone else.',
        icon_shape='bars')
    c.showPage()
    page_num += 1

    # 15. Hackathons
    draw_feature_page(
        c, page_num, 'Catalogs', 'G2 · CATALOGS', ACCENT_2,
        'Hackathons',
        'From kick-off to retrospective in one place.',
        'Run hackathons end-to-end: theme, objective, challenge, dates, location, participants '
        '(devs, SMEs, experts, PMs, designers), docs (briefs, guides, results), and a live message '
        'thread. The AI can synthesise outputs into a one-page wrap-up at the end.',
        ['Plan with status (upcoming / active / completed / archived) and dates.',
         'Add participants with roles and teams; export the roster as CSV.',
         'Drop briefs and guides as docs; participants can author and edit.',
         'When done, generate the AI synthesis for a polished retrospective.'],
        'Pro tip — link to a project',
        'If a hackathon produces something real, create a project AND a Wish List entry that '
        'references both. The lineage is captured forever in your audit log.',
        icon_shape='people')
    c.showPage()
    page_num += 1

    # 16. MCP Hub
    draw_feature_page(
        c, page_num, 'Catalogs', 'G2 · CATALOGS', ACCENT_2,
        'MCP Hub',
        'Your Model Context Protocol catalogue.',
        'Every MCP server (the bridges that let LLMs call your internal systems) lives here. '
        'Each card carries description, tools, deploy status (dev / UAT / production), family, '
        'scope, data source, owning IT team, and an AI-driven code analysis with security/perf '
        'recommendations.',
        ['Add a server declaratively or by URL — the Hub tries to inventory its tools.',
         'Group servers in families with a custom colour for cross-portfolio visibility.',
         'Run AI code analysis to surface security/perf issues — track fixes inline.',
         'Export a PDF booklet of the whole Hub for an exec committee.',
         'Filter by status, scope, or family; switch between list and grid views.'],
        'Pro tip — share with sponsors',
        'The PDF booklet is purpose-built for non-technical stakeholders. One click, polished '
        'output, brand-consistent. Drop it in a Slack channel or attach to a steering deck.',
        icon_shape='flow')
    c.showPage()
    page_num += 1

    # 17. AI Agents
    draw_feature_page(
        c, page_num, 'Catalogs', 'G2 · CATALOGS', ACCENT_2,
        'AI Agents',
        'Track your internal agents from idea to production.',
        'A purpose-built tracker that mirrors the MCP Hub but adds agent-specific fields: model, '
        'framework (LangChain, LlamaIndex, CrewAI, AutoGen, n8n, custom), system prompt, '
        'knowledge bases, tools, and release/eval history with operational metrics.',
        ['Track agents through 6 stages: idea → design → dev → testing → production → deprecated.',
         'Link an agent to the MCP servers it depends on — cross-references appear on both.',
         'Capture monthly invocations, cost, success rate, user satisfaction for ops dashboards.',
         'Use families and tags to group by business domain (Support, Data, DevOps…).'],
        'Pro tip — log every eval',
        'After each regression run, add an evaluation record. Three months in, you have a real '
        'time series — quality and cost trends you can show to leadership.',
        icon_shape='donut')
    c.showPage()
    page_num += 1

    # IT Platform — Data Feeds (G5: admin + IT flag)
    draw_section_divider(c, 'IT', 'DATA PLATFORM', 'G5 · ADMIN + IT FLAG REQUIRED',
        'Data Feeds — silver-copy & data-warehouse pipeline registry. '
        'Visible to admins and users with the IT flag activated by an admin.')
    c.showPage()
    page_num += 1

    draw_data_feeds_page(c, page_num)
    c.showPage()
    page_num += 1

    # 18. Section 05 divider — Collaboration
    draw_section_divider(c, '05', 'COLLABORATION', 'WORKING TOGETHER, ASYNC-FIRST',
        'Working Groups for standing squads and Weekly Check-in to keep the team rhythm.')
    c.showPage()
    page_num += 1

    # 19. Working Groups
    draw_feature_page(
        c, page_num, 'Collaboration', 'G4 · COLLABORATION', ACCENT_3,
        'Working Groups',
        'Standing squads with memory.',
        'A working group is a long-running, cross-functional squad. Each carries an objective, '
        'a roster (lead / contributor / observer), a task board (Kanban with priorities and '
        'checklists), and meeting notes with decisions and action items that carry across sessions.',
        ['Create a working group; invite members with role.',
         'Run sessions: capture an agenda, notes, decisions, and action items.',
         'Action items carry forward — open ones surface in the next meeting prep.',
         'Track tasks in a focused board (todo / doing / review / done).'],
        'Pro tip — close the loop',
        'At every session, do a 2-minute "carried action" review. The system shows you what was '
        'opened last time. Nothing falls through the cracks.',
        icon_shape='people')
    c.showPage()
    page_num += 1

    # 20. Weekly Check-in
    draw_feature_page(
        c, page_num, 'Collaboration', 'G4 · COLLABORATION', ACCENT_3,
        'Weekly Check-in',
        'Two minutes, every Monday.',
        'A short structured form: accomplishments, blockers, next steps, mood (green / amber / red). '
        'Submit it; it shows up on the team dashboard and feeds the AI weekly digest. Skipping '
        'a week triggers a friendly nudge in your notifications.',
        ['Reuse last week as a starting point — only edit what changed.',
         'Set mood with one click; the dashboard shows team weather at a glance.',
         'Read peers\' check-ins in the dashboard digest for async stand-up vibes.'],
        'Pro tip — block 2 minutes Monday morning',
        'Make it the very first thing. Same time every week. After a month, it\'s automatic and '
        'your manager has constant, low-overhead visibility.',
        icon_shape='bars')
    c.showPage()
    page_num += 1

    # 21. Section 06 divider — Personal Tools
    draw_section_divider(c, '06', 'PERSONAL TOOLS', 'YOUR SPACE INSIDE THE WORKSPACE',
        'Smart ToDo for everything that doesn\'t deserve a project, and the Wish List for what you want from the team.')
    c.showPage()
    page_num += 1

    # 22. Smart ToDo
    draw_feature_page(
        c, page_num, 'Personal Tools', 'PUBLIC · PERSONAL', ACCENT_4,
        'Smart ToDo',
        'A personal task tracker with AI-grade structure.',
        'For anything that isn\'t a full project but still needs tracking. Each item carries '
        'requester, sponsor, priority, Eisenhower quadrant, energy required, estimated duration, '
        'planning horizon (today / week / month / quarter / year), and dependencies. The AI helps '
        'extract structure from a single sentence.',
        ['Create todos in one line; the AI parses dates and priority.',
         'Plan by horizon (today vs this week vs this quarter) — the focus mode hides the rest.',
         'Track time spent vs estimated — useful for personal calibration.',
         'Mark recurring tasks with a recurrence rule; new instances roll forward automatically.'],
        'Pro tip — sponsor field matters',
        'When a todo has a sponsor, you can resurface "what does this person need from me" in '
        'two clicks. Big psychological win when you start a tough conversation.',
        icon_shape='gantt')
    c.showPage()
    page_num += 1

    # 23. Wish List
    draw_feature_page(
        c, page_num, 'Personal Tools', 'PUBLIC · TEAM BACKLOG', ACCENT_4,
        'Wish List',
        'Document your needs. Find your sponsor.',
        'A collective backlog where anyone can submit a need — a new project, an MCP server, an '
        'AI agent, a data feed, a feature, an integration. Each wish carries a sponsor, dates, '
        'business justification, expected impact, and a comment thread for triage.',
        ['Submit a wish in 30 seconds — title + description + category is enough to start.',
         'Pick an internal sponsor from your colleagues, or free-text an external name.',
         'Cross-link to existing projects, MCPs or agents — the dropdown is category-aware.',
         'Comment on anyone\'s wish; track status (submitted → accepted → in progress → done).'],
        'Pro tip — sponsor before you submit',
        'A quick 5-minute chat with your potential sponsor before you submit dramatically '
        'increases acceptance. The Wish List is the contract; the conversation is the trust.',
        icon_shape='lightbulb')
    c.showPage()
    page_num += 1

    # 24. Section 07 divider — AI Companion
    draw_section_divider(c, '07', 'AI COMPANION', 'YOUR LOCALLY HOSTED BRAIN',
        'Three AI surfaces, one model, zero cloud calls. Everything you ask stays on your network.')
    c.showPage()
    page_num += 1

    # 25. AI Companion content
    draw_ai_companion_page(c, page_num)
    c.showPage()
    page_num += 1

    # 26. Section 08 divider — Notifications & You
    draw_section_divider(c, '08', 'NOTIFICATIONS & YOU', 'STAY ON TRACK, STAY YOU',
        'How the workspace nudges you back when you drift, and how to keep your account safe.')
    c.showPage()
    page_num += 1

    # 27. Notifications + Profile content
    draw_notifications_profile_page(c, page_num)
    c.showPage()
    page_num += 1

    # 28. Section 09 divider — Tips
    draw_section_divider(c, '09', 'TIPS & BEST PRACTICE', 'HABITS THAT COMPOUND',
        'Six habits that, over a quarter, make the workspace feel like a second brain.')
    c.showPage()
    page_num += 1

    # 29. Tips content
    draw_tips_page(c, page_num)
    c.showPage()
    page_num += 1

    # 30. Annex A divider
    draw_section_divider(c, 'A', 'ANNEX · ARCHITECTURE', 'HOW IT IS BUILT',
        'The local-first, three-tier system that puts you in full control of your data.')
    c.showPage()
    page_num += 1

    # 31. Architecture content
    draw_architecture_page(c, page_num)
    c.showPage()
    page_num += 1

    # 32. Annex B divider
    draw_section_divider(c, 'B', 'ANNEX · PERMISSIONS', 'WHO SEES WHAT',
        'The centralised role × group matrix that every screen in the workspace consults.')
    c.showPage()
    page_num += 1

    # 33. Permission matrix content
    draw_permission_matrix_page(c, page_num)
    c.showPage()
    page_num += 1

    # 34. Annex C divider
    draw_section_divider(c, 'C', 'ANNEX · SHORTCUTS', 'KEYBOARD + GLOSSARY',
        'For the keyboard-first user and anyone new to the vocabulary.')
    c.showPage()
    page_num += 1

    # 35. Shortcuts content
    draw_shortcuts_page(c, page_num)
    c.showPage()
    page_num += 1

    # 36. Back cover
    draw_back_cover(c)
    c.showPage()

    c.save()


if __name__ == '__main__':
    output = Path(__file__).resolve().parent.parent / 'DOINg-AI-User-Guide.pdf'
    build_pdf(output)
    print(f'OK — wrote {output}')
    print(f'Size: {output.stat().st_size / 1024:.1f} KB')
