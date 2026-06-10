# DOINg.AI

**A local-first AI Project Operations platform — run your entire AI initiative portfolio, the assets it depends on, the people behind it, and AI-assisted reporting, from a single self-contained app.**

DOINg.AI is a single-page **React 19 + TypeScript + Vite** application backed by a Python **FastAPI** server. Data lives in `db.json` on your machine and a mirrored cache in your browser's `localStorage`. There is **no cloud dependency and no third-party telemetry** — the only outbound calls are the ones you configure yourself (your local/enterprise LLM, optional SharePoint import, optional Slack/Teams webhooks).

---

## Highlights

- **DOINg Assistant** — the cornerstone: a chat that knows your whole portfolio, plus an **intelligent Canvas** that generates complete, branded HTML reports (KPIs, charts, infographics) from your real data, editable inline and exportable to PDF. Remembers your last 3 requests per user.
- **Manager View** — an admin-only executive cockpit: KPIs, attention signals, key projects, live activity, and one-tap LLM deep-dives (briefing, risk, momentum, workload, ROI).
- **Projects** — Kanban, dependencies, linked MCP servers / agents / data feeds, **telemetry** (declarative or via API), a **dynamic ROI/impact model**, AI Quick synthesis, a printable booklet, and **intelligent duplicate detection + smart merge**.
- **Working Groups** — session timeline with Notes / Decisions / Actions / Checklist, smart carry-over of unfinished items, and AI reports.
- **Data Platform** — Data Feeds registry (source → silver copy), MCP-consumer links, and an LLM-generated, shareable AI Booklet.
- **Catalogs** — Technologies, Repositories, **MCP Hub**, **AI Agents**, Hackathons.
- **Collaboration** — Communications (AI drafts + `.eml` export), Weekly Check-ins, Contributors.
- **Wish List** — a collective backlog with per-wish admin accept/decline and requester notifications.
- **Insights** — a zoomable, exportable **Knowledge Graph**, executive **Reports** (rich markdown → PDF), Activity & Capacity.
- **AI Contacts** — directory + org chart of your AI organisation.
- **Alerts** — per-user scoped, admin-sees-all, with persistent individual / global dismiss.
- **Smart ToDo** — personal Eisenhower task manager with ICS export.
- Enterprise **SSO** (OIDC/OAuth2), **SharePoint** import with a daily delta, role + IT-flag permissioning, PBKDF2 password hashing.

---

## Quick start

### Prerequisites
- **Node.js** 18+ and **Python** 3.10+

### Run

```bash
# 1. Install front-end deps
npm install

# 2. Start the FastAPI server (serves the API + persists db.json)
python3 server.py        # http://localhost:8000

# 3. In another terminal, start the Vite dev server
npm run dev              # http://localhost:3000
```

Open http://localhost:3000 and sign in with the seeded admin account:

| Field | Value |
|-------|-------|
| UID | `admin` |
| Password | `MM@2026` |

> Change the admin password immediately from the options menu (top-right → Change password).

### Build for production

```bash
npm run build           # type-checks via tsc, then bundles to dist/
```

The FastAPI server can serve the built `dist/` directly.

---

## Architecture

```
┌───────────────────────────┐         ┌──────────────────────────┐
│  React 19 SPA (Vite)      │  HTTP   │  FastAPI (server.py)     │
│  - views/ components/     │ ◀─────▶ │  - GET/POST /api/data    │
│  - services/ (storage,    │   SSE   │  - /api/events (push)    │
│    llm, analytics, …)     │ ◀────── │  - merge + tombstones    │
│  - localStorage mirror    │         │  - db.json (single doc)  │
└───────────────────────────┘         └──────────────────────────┘
```

- **Local-first sync** — every change writes to `localStorage` instantly and is debounced to the server (400 ms). The server pushes updates to other clients over **SSE**.
- **Conflict-free deletes** — the server merges concurrent writes by id; **deletion tombstones** ensure a removed entity is never resurrected (no phantom data).
- **Code-splitting** — every route view is lazy-loaded; vendor chunks are isolated.
- **Permissioning** — a role × group matrix (`services/permissions.ts`): `admin / manager / contributor / viewer`, plus an `IT` flag for the Data Platform. The sidebar, routes and state are all filtered by it.

### Key directories

| Path | What |
|------|------|
| `src/components/views/` | One file per menu (Projects, ManagerView, WorkingGroups, DataFeeds, …) |
| `src/components/NexusAssistant.tsx` | The DOINg Assistant (chat + Canvas) |
| `src/services/storage.ts` | Local + server persistence, tombstones, sanitize |
| `src/services/llmService.ts` | Local LLM calls + prompt templates |
| `src/services/projectAnalytics.ts` | Telemetry fetch + ROI evaluation |
| `src/services/duplicateDetection.ts` | Duplicate detection + smart merge |
| `src/services/permissions.ts` | Role × group access matrix |
| `src/types.ts` | The full data model |
| `server.py` | FastAPI server, merge logic, SSE, SSO, SharePoint |

---

## Menus & roles

| Menu | Who can see it |
|------|----------------|
| Dashboard, Projects, Task Board, Timeline, Communications, Wish List, Activity, Knowledge Graph, AI Contacts, Smart ToDo, Technologies, User Guide | Everyone (scoped to their access) |
| Repositories, Hackathons, MCP Hub, AI Agents, Working Groups, Weekly Check-in | Everyone; edit gated by role |
| **Manager View**, Contributors, Settings | **Admin** |
| **Data Feeds** | Admin + users with the **IT** flag |
| Reports, Capacity, Pending imports | Admin + Manager |

---

## AI configuration

All AI features run through a configurable LLM in **Admin → Settings → LLM**:

- **Ollama** (default, fully local) — e.g. `http://localhost:11434`, model `llama3`
- **OpenAI-compatible** endpoints (base URL + API key + model)
- **n8n / webhook** relay

Use **Test Connection** before relying on AI features. Nothing is sent anywhere unless you point the config at a remote endpoint.

---

## Data & backup

- All data is a single JSON document (`db.json`) plus a `localStorage` mirror.
- **Export / import** the full dataset from Admin → Settings → Backup.
- Deletions are tracked with tombstones (GC'd after 30 days) so they never come back through sync.

---

## Security

- Passwords hashed with **PBKDF2-SHA256** (Web Crypto).
- Optional enterprise **SSO** (OIDC/OAuth2 — Azure AD, Okta, Keycloak, Google) with HMAC-signed session tokens.
- Role + IT-flag access control enforced in the sidebar, route guards and state filtering.
- 100% local-first — no external SDKs, no analytics beacons.

---

## License

Internal / proprietary. All rights reserved.
