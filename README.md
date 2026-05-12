# NEXUS.AI

**An end-to-end AI Project Operations platform — projects, contributors, communications, technologies, repositories, and AI-assisted reporting, all from a single self-contained app.**

NEXUS.AI is a single-page React 19 application backed by a Python **FastAPI** server. It manages an AI initiative portfolio from intake to executive reporting:

- Project tracking with Kanban and a Gantt-lite timeline
- RAG risk heatmap with one-click AI risk assessment
- Multi-role authentication (admin / manager / contributor / viewer)
- Weekly contributor check-ins with AI consolidation
- AI-generated weekly / newsletter / Exco communications
- Outlook-ready `.eml` export wired to mailing lists
- Executive-grade PDF export (A4, branded, print-pipeline)
- Local LLM admin console (Ollama / OpenAI-compatible / n8n webhook)

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
- optionally drop a **desktop shortcut** named *"NEXUS.AI"* on your Desktop.

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

---

## Features in detail

### 1. Global Dashboard
Cross-portfolio KPIs, recent projects with progress bars, upcoming milestones, technology snapshot, and a shortcut to the risk heatmap.

### 2. Projects (with Kanban)
Click any project to open its detail view:

- **Overview tab** — status, owner, dates, tags, budget, members, technologies, AI-generated project brief.
- **Kanban tab** — four columns (To Do, In Progress, Blocked, Done). Click a task's "→ next" button to advance it through the workflow. Expand a task to edit title, description, assignee, ETA, priority, and a checklist.
- **Audit tab** — every change is logged with author and timestamp.

PDF export is available from the project detail footer.

### 3. Timeline (Gantt-lite)
A high-level horizontal Gantt across all visible projects, with month markers, a "today" line, and milestone flags. Toggle completed projects on/off.

### 4. Risk Heatmap
Each project is scored Green / Amber / Red based on overdue deadlines, blocked tasks, late tasks, and staleness. The page exposes:

- Three KPI tiles with portfolio distribution.
- A grouped, color-coded card list ranked by criticality.
- An **AI Risk Assessment** button that asks your local LLM to prioritize and recommend mitigations.

### 5. Contributors
Group view by team. Admins and managers can add/edit users, set their app role (admin/manager/contributor/viewer), assign team and job title, and capture **expectations** for clarity. Every user has their own UID + password for self-service.

### 6. Weekly Check-in
Each contributor logs their weekly status (accomplishments / blockers / next steps) with a Green/Amber/Red mood marker. Managers and admins can:

- See all submissions for the current week.
- Click **AI Consolidate** to ask the local LLM to produce a structured manager-grade synthesis.
- Export both the raw submissions and the AI synthesis as a single branded PDF.

### 7. Communications (Generate / Templates / Lists / History)
- **Generate** — choose `weekly`, `newsletter`, or `exco`, optionally focus on a project, add free-text context, pick a mailing list, hit *Generate*. The draft is editable, copyable, exportable as `.eml` (drops straight into Outlook with the recipient list and subject pre-filled), and savable to history.
- **Templates** — create reusable subject/body templates with `{{projectName}}`, `{{authorName}}` variables.
- **Mailing Lists** — manage broadcast audiences (e.g. *Executive committee*, *All employees*).
- **History** — every saved draft is listed with one-click PDF export.

### 8. Technologies & Repositories
Catalog of frameworks, libraries, databases, languages, tools, and services in use — with versions, URLs, tags, and category icons. Code repositories are tracked separately with visibility (public/private/internal), language, description, and projects they are linked to.

### 9. Notification Center
Surfaces dynamic alerts:

- projects with no activity in 10+ days,
- tasks past their ETA,
- contributors who haven't submitted a weekly check-in.

### 10. AI Executive Insight (modal)
One-click portfolio-wide synthesis with executive summary, highlights, risks, and recommended actions — straight to PDF.

### Light / dark mode
A discreet sun/moon button in the sidebar toggles light mode. The choice is persisted alongside the rest of the app state.

---

## Configure your local LLM

NEXUS.AI never leaves your network. Configure your provider from **Settings → Local LLM** (admin only).

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
│   └── Create-Shortcut.ps1    # Drops a NEXUS.AI shortcut on the Desktop
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
    │   └── exports.ts         # PDF (print pipeline) and Outlook .eml builders
    └── components/
        ├── Sidebar.tsx        # Nav, theme toggle, notifications, AI insight launcher
        ├── Login.tsx
        ├── NotificationCenter.tsx
        ├── AiInsightModal.tsx
        ├── ui/                # Button, Input, Textarea, Select, Card, Badge
        └── views/
            ├── Dashboard.tsx
            ├── Projects.tsx           # + Kanban + audit log + project detail modal
            ├── Timeline.tsx
            ├── RiskHeatmap.tsx
            ├── Contributors.tsx
            ├── WeeklyCheckIn.tsx
            ├── Communications.tsx     # Generate / Templates / Lists / History
            ├── Technologies.tsx
            ├── Repositories.tsx
            └── Settings.tsx           # LLM / Prompts / Security / Data
```

---

## Data storage and conflicts

NEXUS.AI uses a **dual-layer** persistence strategy borrowed from production-grade local-first apps:

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

{ "path": "C:\\NEXUS\\my-db.json" }
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
| `weekly_email`          | Communications → Weekly                              |
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

The Vite build emits four chunks (HTML, CSS, vendor, icons, app) with `gzip ≈ 100 kB` total. Source maps are disabled in production.

If you want NEXUS.AI to autostart on Windows: drop a shortcut to `start.bat` inside `shell:startup`.

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
