# DOINg.AI

**An end-to-end AI Project Operations platform — projects, contributors, communications, technologies, repositories, hackathons, working groups, Smart ToDo, MCP Hub, and AI-assisted reporting, all from a single self-contained app.**

DOINg.AI is a single-page React 19 application backed by a Python **FastAPI** server. It manages an AI initiative portfolio from intake to executive reporting:

- Project tracking with Kanban, Gantt timeline, and exportable SteerCo booklet
- Dev workflow status (To Start / Dev / UAT / Prod) on every project
- External stakeholder contacts per project (outside the contributor directory)
- RAG risk heatmap with one-click AI risk assessment
- Multi-role authentication (admin / manager / contributor / viewer)
- Weekly contributor check-ins with AI consolidation
- Working Groups with meeting notes, tasks, and action items
- Hackathon management with candidate kits and participant roster
- Smart ToDo with Eisenhower matrix, energy levels, and ICS export
- MCP Hub — catalog and manage Model Context Protocol servers
- AI-generated weekly / newsletter / Exco communications
- Outlook-ready `.eml` export wired to mailing lists
- Executive-grade PDF export: per-project brief, multi-project booklet, Gantt timeline
- Project Families for cross-project grouping
- Local LLM admin console (Ollama / OpenAI-compatible / n8n webhook)
- First-login onboarding modal + built-in User Guide

The app is **100% local-first**: no third-party telemetry, no cloud dependency, no external SDKs. Data lives in `db.json` on your machine and a mirrored cache in your browser's `localStorage`.

---

## Table of contents

1. [Quick start (Windows)](#quick-start-windows)
2. [Quick start (macOS / Linux)](#quick-start-macos--linux)
3. [Login](#login)
4. [Features in detail](#features-in-detail)
5. [Configure your local LLM](#configure-your-local-llm)
6. [Architecture](#architecture)
7. [Project layout](#project-layout)
8. [Data storage and conflicts](#data-storage-and-conflicts)
9. [Customising prompts](#customising-prompts)
10. [Production build](#production-build)
11. [Troubleshooting](#troubleshooting)
12. [License](#license)

---

## Quick start (Windows)

**Prerequisites** — install once:

1. **Node.js 20+** — <https://nodejs.org/> (the LTS installer is fine).
2. **Python 3.10+** — <https://www.python.org/downloads/>. During the installer, tick **"Add python.exe to PATH"**.

**Install:**

```cmd
:: 1. Get the code (or unzip it) and open the folder in a Command Prompt
cd C:\path\to\NEXUS.AI

:: 2. Run the installer
install.bat
```

`install.bat` will:

- check for Node.js and Python on `PATH`,
- run `npm install`,
- create a Python virtual environment in `.venv\`,
- install FastAPI and Uvicorn into it,
- build the production frontend (`dist\`),
- optionally drop a **desktop shortcut** named *"DOINg.AI"* on your Desktop.

**Run:**

```cmd
start.bat
```

That single command (or double-clicking the desktop shortcut) will:

- boot FastAPI on `http://localhost:3001`,
- serve the built UI from the same origin,
- open your default browser on the app.

For coding on the UI with hot reload, use `start-dev.bat` instead — it opens two terminals (Vite on `:3000`, FastAPI on `:3001`) with the standard `/api` proxy.

---

## Quick start (macOS / Linux)

**Prerequisites** — install once:

- **Node.js 20+** (`brew install node`, `apt install nodejs npm`, …)
- **Python 3.10+** with `pip`

**Install + run:**

```bash
# 1. Install npm + python dependencies
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Production mode (FastAPI serves the built UI on 3001)
npm run build
python3 server.py

# OR, dev mode (Vite HMR on 3000 + FastAPI on 3001)
#   Terminal 1:
python3 server.py
#   Terminal 2:
npm run dev
```

Open <http://localhost:3001> in production mode, or <http://localhost:3000> in dev mode.

---

## Login

A default admin account is seeded the first time the app runs:

| Field    | Value     |
| -------- | --------- |
| User ID  | `admin`   |
| Password | `MM@2026` |

Change the admin password from **Settings → Security** as soon as you are in.

The seed also creates two example contributors (`emma`, `lucas`) with password `changeme`, used by the project demo data. Replace them once you start adding your real team.

On first login, each user sees a **4-step onboarding modal** that introduces the platform and role-specific capabilities. It only appears once per account.

---

## Features in detail

### 1. Global Dashboard
Cross-portfolio KPIs, recent projects with progress bars, upcoming milestones, technology snapshot, and a shortcut to the risk heatmap.

### 2. Projects

A full project lifecycle manager with **Kanban board**, **detail modal**, and multiple export options.

**Project card** — shows name, status badge, dev workflow stage (To Start / Dev / UAT / Prod), priority, deadline, and RAG indicator.

**Detail modal tabs:**

- **Overview** — status, dates (with slip detection), budget, FTE gain, confidentiality level, project family, owner, internal members, **external stakeholders** (contacts outside the contributor directory — name, email, role, company), technologies, linked apps, presentations (PPT/PPTX viewer), tags, and notes.
- **Kanban** — four swim-lanes (To Do · In Progress · Blocked · Done) with blue highlight for active tasks and green for done. Per-task detail: description, assignee, ETA, priority, weight, checklist.
- **Audit log** — every change recorded with author and timestamp.
- **AI Brief** — LLM-generated structured project brief.

**Toolbar actions:**

- **Booklet presentation** — choose one or more projects, generate a full SteerCo PDF deck (landscape A4): dark cover page, agenda, executive summary with KPI tiles and portfolio donut, per-project pages with progress bars, task breakdown, team and milestones.
- **Export PDF** — single-project A4 brief with milestone roadmap SVG.
- **Project Families** — admins can define colour-coded families (e.g. *Digital Transformation*, *Infrastructure*) to group related projects. Managed from Admin Settings.
- **Templates** — create reusable project skeletons with pre-defined tasks and milestones.

### 3. Timeline (Gantt)

A high-level horizontal Gantt across all visible projects.

- Month markers, dashed "today" line, coloured bars (orange = on track, red = overdue, green = done), milestone flags.
- Toggle completed projects on/off.
- **Select & Export PDF** — enter selection mode to check individual projects, or "Export all" for a one-click landscape Gantt PDF with DOINg.AI branding, legend, and print toolbar.

### 4. Risk Heatmap *(admin only)*

Each project is scored Green / Amber / Red based on overdue deadlines, blocked tasks, late tasks, and staleness. Exposes:

- Three KPI tiles with portfolio distribution.
- A grouped, color-coded card list ranked by criticality.
- **AI Risk Assessment** — asks your local LLM to prioritize and recommend mitigations.

### 5. Technologies & Repositories

**Technologies** — catalog of frameworks, libraries, databases, languages, tools, and services with versions, URLs, layer (frontend/backend/data/ML-AI…), maturity status (adopted/evaluating/deprecated/hold), and tags.

**Repositories** — code repos tracked with provider (GitHub/GitLab/Bitbucket/Azure), visibility, language, description, and linked projects.

### 6. Hackathons

End-to-end hackathon management:

- Status lifecycle: Upcoming → Active → Completed → Archived.
- Participant roster with roles (Dev, SME, Expert, PM, Designer).
- Documents (brief, guide, results, resources) with inline rich text editor.
- Live message board.
- **Candidate Kit PDF** — branded A4 document with objective, challenge, team roster, documents, and AI synthesis.

### 7. MCP Hub

Catalog and manage **Model Context Protocol** servers used across the team:

- Add servers by URL or declarative definition.
- Per-server tool listing with AI-enriched descriptions.
- Category and tag taxonomy, active/inactive toggle.
- Used as a shared reference for AI tooling standardisation.

### 8. Contributors

Team directory with role-based visibility:

- All roles see the directory (name, team, function, avatar).
- Managers and admins can edit profiles.
- **Login credentials** (UID + password) are visible only to admins — fully hidden from managers and contributors.
- Group view by team with search/filter.

### 9. Communications *(manager and above)*

- **Generate** — choose type (Summary / Newsletter / Exco / Info), optionally focus on a project, add context, pick a mailing list, hit *Generate*. The draft is editable, copyable, and exportable as `.eml` (drops straight into Outlook with recipients and subject pre-filled) or branded PDF.
- **Templates** — reusable subject/body templates with `{{projectName}}`, `{{authorName}}` variables.
- **Mailing Lists** — manage broadcast audiences.
- **History** — every saved draft listed with one-click re-export.

### 10. Working Groups

Lightweight collaboration spaces outside formal projects:

- Status: Active / Paused / Closed.
- Member roster with Lead / Contributor / Observer roles.
- Kanban task board (To Do / Doing / Review / Done).
- Meeting notes with agenda, decisions, and action items — unresolved actions are automatically carried forward.

### 11. Weekly Check-in *(contributor and above)*

Each contributor logs their weekly status (accomplishments / blockers / next steps) with a Green/Amber/Red mood marker. Managers and admins can:

- See all submissions for the current week.
- Click **AI Consolidate** to produce a manager-grade synthesis.
- Export the raw submissions and synthesis as a branded PDF.

### 12. Smart ToDo *(contributor and above)*

Personal task manager beyond project tracking:

- Eisenhower matrix (Urgent-Important quadrants) with drag-style assignment.
- Priority, energy level, estimated duration, actual time spent.
- Planning horizon: Today / This week / This month / This quarter / TBD.
- Recurring tasks with recurrence rules.
- Schedule picker with date + time slot.
- **ICS export** for calendar integration.
- AI synthesis of your task load.

### 13. User Guide

Built-in contextual help:

- 13 sections covering every feature.
- Admin-only sections (LLM setup, data management, user management) are hidden from non-admins.
- Always accessible from the sidebar — no external docs needed.

### 14. Notification Center

Surfaces dynamic alerts:

- Projects with no activity in 10+ days.
- Tasks past their ETA.
- Contributors who haven't submitted a weekly check-in.

### 15. AI Executive Insight (modal)

One-click portfolio-wide synthesis — executive summary, highlights, risks, and recommended actions — straight to PDF.

### Light / dark mode

A sun/moon button in the sidebar toggles themes. The choice persists alongside the rest of the app state.

---

## Configure your local LLM

DOINg.AI never leaves your network. Configure your provider from **Settings → Local LLM** (admin only).

| Provider | Base URL example | API key | Notes |
| -------- | ---------------- | ------- | ----- |
| **Ollama** (default) | `http://localhost:11434` | — | Pull a model first: `ollama pull llama3` |
| **OpenAI-compatible** | `http://localhost:8000` | optional Bearer | Works with LM Studio, LocalAI, vLLM, Text Generation WebUI, etc. |
| **n8n webhook** | `https://your-n8n/webhook/...` | optional header | Send `{ prompt, model, timestamp }` and return text |

Hit **Test** to ping the provider and list available models. Click a model name in the result to set it as active.

Override individual prompts under **Settings → AI Prompts** — every prompt has a *Reset* button to fall back to the built-in default.

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
                │                  Browser                     │
                │                                              │
                │   React 19 SPA  (Tailwind 3.4, Lucide)       │
                │   ├── localStorage cache (nexus_ai_data_v1)  │
                │   ├── CustomEvent bus on `window`            │
                │   └── StorageEvent cross-tab sync            │
                └──────────────────┬───────────────────────────┘
                                   │  /api/data  (X-Base-Version)
                                   ▼
                ┌──────────────────────────────────────────────┐
                │              FastAPI + Uvicorn               │
                │  - GET  /api/data                            │
                │  - POST /api/data  (optimistic concurrency)  │
                │  - GET  /api/health                          │
                │  - GET  /api/config/db-path                  │
                │  - serves /dist  (production mode only)      │
                └──────────────────┬───────────────────────────┘
                                   │
                                   ▼
                       ┌──────────────────────┐
                       │      db.json         │  <- single source of truth
                       └──────────────────────┘
```

| Layer            | Technology                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| Language         | TypeScript 5.8 (strict, ESNext, ES2022 target)                              |
| JSX              | `react-jsx` (no React import needed)                                        |
| Frontend         | React 19, Tailwind CSS 3.4 (class dark mode), Lucide React 0.563            |
| Bundler          | Vite 6.4 + `@vitejs/plugin-react`                                           |
| Dev server       | `localhost:3000`, exposes network, `/api` proxy → `localhost:3001`          |
| Charts           | Pure SVG / DOM (no external chart library)                                  |
| Routing          | **None** — single-page tab state in `App.tsx`                               |
| State management | Plain `useState` / `useMemo` / `useEffect`                                  |
| Backend          | Python 3.10+ · FastAPI · Uvicorn                                            |
| Persistence      | `db.json` (server) + `localStorage` (browser)                               |
| Concurrency      | `X-Base-Version` request header → HTTP **409** on conflict                  |
| Fonts            | System stack only (no Google Fonts, fully offline)                          |
| Telemetry        | **None.** No analytics, no Google, no third-party tracking.                 |

---

## Project layout

```
NEXUS.AI/
├── install.bat                # Windows installer (Node + Python + venv + build)
├── start.bat                  # Windows: production launcher (opens browser)
├── start-dev.bat              # Windows: dev launcher (Vite + FastAPI in 2 terms)
├── scripts/
│   └── Create-Shortcut.ps1    # Drops a DOINg.AI shortcut on the Desktop
├── server.py                  # FastAPI backend
├── requirements.txt           # Python deps (fastapi, uvicorn)
├── package.json               # Node deps and scripts
├── index.html                 # Vite entry (no Google Fonts, system fonts only)
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts             # Port 3000, /api proxy to 3001, manual vendor chunks
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx                # Mono-page tab routing + theme + permission filter
    ├── index.css
    ├── types.ts               # All domain types and enums
    ├── services/
    │   ├── storage.ts         # localStorage + /api/data + version + conflict handling
    │   ├── llmService.ts      # Ollama / OpenAI-compat / n8n + default prompts
    │   └── exports.ts         # PDF (print pipeline), booklet, timeline Gantt, .eml builders
    └── components/
        ├── Sidebar.tsx        # Grouped nav, theme toggle, notifications, AI insight launcher
        ├── Login.tsx
        ├── OnboardingModal.tsx        # First-login 4-step onboarding
        ├── NotificationCenter.tsx
        ├── AiInsightModal.tsx
        ├── ui/                        # Button, Input, Textarea, Select, Card, Badge
        └── views/
            ├── Dashboard.tsx
            ├── Projects.tsx           # Kanban, booklet, dev status, external members
            ├── Timeline.tsx           # Gantt + PDF export with project selection
            ├── RiskHeatmap.tsx
            ├── Contributors.tsx       # Split view/edit, UID/password admin-only
            ├── WeeklyCheckIn.tsx
            ├── Communications.tsx     # Generate / Templates / Lists / History
            ├── Technologies.tsx
            ├── Repositories.tsx
            ├── Hackathons.tsx         # + candidate kit PDF
            ├── WorkingGroups.tsx      # Tasks + meeting notes + action items
            ├── SmartTodo.tsx          # Eisenhower matrix + schedule + ICS
            ├── McpHub.tsx             # MCP server catalog
            ├── UserGuide.tsx          # Built-in contextual help (role-filtered)
            └── Settings.tsx           # LLM / Prompts / Security / Data / Families
```

---

## Data storage and conflicts

DOINg.AI uses a **dual-layer** persistence strategy borrowed from production-grade local-first apps:

1. **Browser localStorage** (key `nexus_ai_data_v1`) — instant writes, instant reads, survives reloads.
2. **`db.json` on disk**, owned by the FastAPI server — canonical source of truth, atomic writes (`tmp + rename`), shared between users on the same machine, picked up first on next boot.

Every state mutation triggers:

- An immediate local write.
- An asynchronous `POST /api/data` with an `X-Base-Version` header carrying the timestamp of the data the client started from.
- A `StorageEvent` dispatch so other tabs of the same browser refresh.

If the server detects that its `lastUpdated` timestamp is newer than the client's base version (someone else saved meanwhile), it returns **HTTP 409** along with the server payload. The client listens for `window.dispatchEvent(new CustomEvent('nexus_conflict', ...))` and rebases on the server state.

The local cache is also **schema-versioned**: bumping `CURRENT_APP_VERSION` in `src/services/storage.ts` automatically clears stale caches on next load.

You can change `db.json`'s location at runtime via the admin **Settings → Data** screen or via:

```
POST /api/config/db-path
Content-Type: application/json

{ "path": "C:\\DOINg\\my-db.json" }
```

A `server-config.json` file persists the choice across restarts.

---

## Customising prompts

All AI prompts live in `src/services/llmService.ts` under `DEFAULT_PROMPTS`. Keys:

| Key                     | Used by                                              |
| ----------------------- | ---------------------------------------------------- |
| `portfolio_summary`     | AI Executive Insight modal                           |
| `project_brief`         | Project detail → AI Project Brief                    |
| `risk_assessment`       | Risk Heatmap → AI Risk Assessment                    |
| `weekly_email`          | Communications → Summary                             |
| `newsletter`            | Communications → Newsletter                          |
| `exco_update`           | Communications → Exco                                |
| `weekly_consolidation`  | Weekly Check-in → AI Consolidate                     |

Each is fully overridable from **Settings → AI Prompts** without touching code. Custom prompts persist in `db.json` under the `prompts` key. Available variables:

- `{{DATA}}` — the structured context passed to the LLM
- `{{TITLE}}` — feature-specific title (project name, week of, etc.)
- `{{AUTHOR}}` — current user's full name

---

## Production build

```bash
# Cross-platform
npm run build       # outputs ./dist
python server.py    # FastAPI serves dist + the API on port 3001
```

The Vite build emits four chunks (HTML, CSS, vendor, icons, app) with `gzip ≈ 170 kB` total. Source maps are disabled in production.

If you want DOINg.AI to autostart on Windows: drop a shortcut to `start.bat` inside `shell:startup`.

---

## Troubleshooting

**`install.bat` says "Python was not found"**
Re-run the Python installer and tick *"Add python.exe to PATH"*. Or pick the `py` launcher: `py -3 --version` should report 3.10+.

**`install.bat` fails on `npm install`**
Make sure your corporate proxy is whitelisted, or set `npm config set registry https://registry.npmjs.org/`.

**Browser opens on `localhost:3001` but the page is empty**
You ran `start.bat` before `dist/` was built. Run `npm run build` once, then restart `start.bat`. If you ran the installer, this is already done.

**Conflict (409) loops**
Caused by two browser tabs writing aggressively at the same time. Reload the most recent one — the loser will rebase on server state automatically. If it persists, wipe local cache from **Settings → Data**.

**AI generation errors out with `ECONNREFUSED`**
Your local LLM is not running. For Ollama: `ollama serve` then `ollama pull llama3`. Test the connection from **Settings → Local LLM → Test**.

**PDF export does nothing**
Allow popups for `localhost`. The export opens a temporary print window.

**Reset everything**
Stop the server, delete `db.json`, restart `start.bat`. The DB will be re-seeded on the frontend's first load.

---

## License

Private — internal use only. Copyright © 2026 Mathieu Masson.
