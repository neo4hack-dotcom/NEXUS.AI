"""
NEXUS.AI — FastAPI Backend
Stores the entire app state in db.json (single document, versioned).
Endpoints:
  GET  /api/data            -> current db
  POST /api/data            -> write db (uses X-Base-Version header for optimistic concurrency)
  GET  /api/health          -> liveness
  GET  /api/config/db-path  -> introspect DB path
  POST /api/config/db-path  -> change DB path (admin)
Run:  python3 server.py
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, Optional, Set

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse
import uvicorn

BASE_DIR = Path(__file__).resolve().parent
SERVER_CONFIG_FILE = BASE_DIR / "server-config.json"
DEFAULT_DB_FILE = BASE_DIR / "db.json"
DIST_DIR = BASE_DIR / "dist"
PORT = 3001


def get_db_path() -> Path:
    if SERVER_CONFIG_FILE.exists():
        try:
            cfg = json.loads(SERVER_CONFIG_FILE.read_text(encoding="utf-8"))
            p = cfg.get("dbPath")
            if p:
                return Path(p)
        except Exception as e:  # noqa: BLE001
            print(f"[NEXUS] Config read failed: {e}")
    return DEFAULT_DB_FILE


DB_FILE: Path = get_db_path()


def _initial_data() -> Dict[str, Any]:
    """Empty shell. The frontend seeds itself on first use."""
    return {
        "users": [],
        "projects": [],
        "technologies": [],
        "repositories": [],
        "communications": [],
        "emailTemplates": [],
        "mailingLists": [],
        "weeklyCheckIns": [],
        "notifications": [],
        "llmConfig": {
            "provider": "ollama",
            "baseUrl": "http://localhost:11434",
            "apiKey": "",
            "model": "llama3",
            "systemPrompt": "You are NEXUS.AI, an expert AI Operations assistant.",
        },
        "prompts": {},
        "lastUpdated": int(time.time() * 1000),
    }


def init_db_if_needed() -> None:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DB_FILE.exists():
        DB_FILE.write_text(json.dumps(_initial_data(), indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[NEXUS] Created fresh DB at {DB_FILE}")
    else:
        print(f"[NEXUS] Using DB at {DB_FILE}")


init_db_if_needed()


app = FastAPI(title="NEXUS.AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Base-Version"],
)


def _read_db() -> Dict[str, Any]:
    try:
        return json.loads(DB_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return _initial_data()
    except Exception as e:  # noqa: BLE001
        print(f"[NEXUS] DB read failed: {e}")
        return _initial_data()


def _write_db(payload: Dict[str, Any]) -> None:
    tmp = DB_FILE.with_suffix(DB_FILE.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(DB_FILE)


# Serialises the read-modify-write cycle so two concurrent POSTs can't interleave
# their read and write phases (which would silently drop one writer's changes).
_db_write_lock = asyncio.Lock()

# Every top-level collection that is an array of {id, ...} entities. On a
# concurrent-write conflict we merge these by id instead of rejecting, so two
# users editing DIFFERENT entities never lose each other's work.
_MERGEABLE_COLLECTIONS = (
    "users", "projects", "projectTemplates", "projectFamilies",
    "technologies", "repositories", "communications", "emailTemplates",
    "mailingLists", "weeklyCheckIns", "notifications", "hackathons",
    "workingGroups", "smartTodos", "mcpServers", "mcpFamilies",
    "mcpBestPractices", "agents", "agentFamilies", "dataFeeds",
    "wishes", "pendingProjects",
)


def _entity_recency(entity: Dict[str, Any]) -> float:
    """Best-effort 'how fresh is this entity' for conflict resolution."""
    for key in ("updatedAt", "createdAt"):
        v = entity.get(key)
        if isinstance(v, str):
            # ISO strings compare lexicographically in chronological order.
            # Convert to a sortable number via length-safe fallback.
            return _iso_to_epoch(v)
        if isinstance(v, (int, float)):
            return float(v)
    return 0.0


def _iso_to_epoch(s: str) -> float:
    try:
        from datetime import datetime
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:  # noqa: BLE001
        return 0.0


def _merge_entity(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    """
    Field-level merge of two versions of the SAME entity (same id).
      - Nested arrays of {id, ...} are themselves merged by id (recursively),
        so two users editing the same Working Group but DIFFERENT sessions /
        tasks both keep their additions.
      - Scalar / object fields take the value from the newer version (by
        updatedAt/createdAt), so the latest edit to a field wins.
    """
    newer, older = (a, b) if _entity_recency(a) >= _entity_recency(b) else (b, a)
    out = dict(newer)  # newer scalars win

    for key, older_val in older.items():
        newer_val = newer.get(key)
        # Recursively union nested entity arrays present on either side.
        if (isinstance(newer_val, list) and isinstance(older_val, list)
                and (_looks_like_entity_list(newer_val) or _looks_like_entity_list(older_val))):
            out[key] = _merge_collection(older_val, newer_val)
        elif key not in newer:
            out[key] = older_val  # field only the older side had
    return out


def _looks_like_entity_list(v: Any) -> bool:
    return isinstance(v, list) and any(isinstance(x, dict) and "id" in x for x in v)


def _merge_collection(current: list, incoming: list) -> list:
    """
    Union two entity arrays by `id`.
      - present in both  → field-level merge (see _merge_entity), so nested
                           additions from both writers survive.
      - present in one   → keep it (covers concurrent creations on either side).
    Order: incoming order first (writer's view), then any extras only on server.
    NOTE: a just-deleted entity that the OTHER client still holds may be
    resurrected. We accept this rare, low-damage trade-off — it is vastly
    preferable to losing a freshly-created project or a whole meeting session.
    """
    if not isinstance(current, list):
        return incoming
    if not isinstance(incoming, list):
        return current

    cur_by_id = {e.get("id"): e for e in current if isinstance(e, dict) and e.get("id") is not None}

    merged: list = []
    seen = set()

    for e in incoming:
        if not isinstance(e, dict) or e.get("id") is None:
            merged.append(e)
            continue
        eid = e["id"]
        seen.add(eid)
        other = cur_by_id.get(eid)
        if other is not None:
            merged.append(_merge_entity(other, e))   # field-level union
        else:
            merged.append(e)

    # Append entities that exist only on the server (created by another client).
    for e in current:
        if not isinstance(e, dict):
            continue
        eid = e.get("id")
        if eid is not None and eid not in seen:
            merged.append(e)

    return merged


def _merge_states(current: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """
    Three-way-ish merge used on the concurrent-write path. Starts from the
    incoming document (the writer's full intent), then for every mergeable
    collection unions in any entities the other writer added/updated on the
    server. Scalar/object config fields keep the incoming value.
    """
    merged = dict(incoming)
    for key in _MERGEABLE_COLLECTIONS:
        if key in current or key in incoming:
            merged[key] = _merge_collection(
                current.get(key, []) or [],
                incoming.get(key, []) or [],
            )
    return merged


# ────────────────────────────────────────────────────────────────────────────
# SSE — Server-Sent Events for real-time push to connected clients.
# Replaces the previous polling-based sync. Each connected client gets its own
# asyncio.Queue; a successful POST broadcasts an event into every queue.
# ────────────────────────────────────────────────────────────────────────────
_sse_clients: Set[asyncio.Queue] = set()
_sse_lock = asyncio.Lock()


async def _broadcast_update(event_type: str, payload: Dict[str, Any]) -> None:
    """Push an event to every connected SSE client (best-effort, drops dead queues)."""
    async with _sse_lock:
        dead = set()
        for q in _sse_clients:
            try:
                q.put_nowait({"type": event_type, "data": payload})
            except asyncio.QueueFull:
                dead.add(q)
        _sse_clients.difference_update(dead)


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "db": str(DB_FILE), "ts": int(time.time() * 1000)}


@app.get("/api/data")
async def get_data() -> JSONResponse:
    data = _read_db()
    return JSONResponse(data)


@app.post("/api/data")
async def save_data(
    request: Request,
    x_base_version: Optional[str] = Header(default=None, alias="X-Base-Version"),
) -> JSONResponse:
    try:
        new_data: Dict[str, Any] = await request.json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    # Serialise the whole read-modify-write so two concurrent POSTs can't
    # interleave (read-old / read-old / write-A / write-B → A lost).
    async with _db_write_lock:
        current = _read_db()
        merged_flag = False

        # Optimistic concurrency control with AUTO-MERGE on conflict.
        # Instead of rejecting a stale write (which used to strand the client's
        # changes), we merge by-id so concurrent edits to DIFFERENT entities both
        # survive. Same-entity edits resolve by recency (updatedAt/createdAt).
        if x_base_version and x_base_version != "force":
            server_version = str(current.get("lastUpdated", 0))
            if server_version != str(x_base_version):
                print(f"[NEXUS] Concurrent write (client={x_base_version} "
                      f"server={server_version}) → merging by id")
                new_data = _merge_states(current, new_data)
                merged_flag = True

        new_data["lastUpdated"] = int(time.time() * 1000)
        _write_db(new_data)
        print(f"[NEXUS] Saved at {time.strftime('%H:%M:%S')} "
              f"({len(json.dumps(new_data))} bytes{', merged' if merged_flag else ''})")

    # Notify every SSE-connected client that fresh data is available.
    await _broadcast_update("data_updated", {"lastUpdated": new_data["lastUpdated"]})

    # On a merge we return the full merged document so the writer adopts the
    # union (their change + whatever the other writer did) without another fetch.
    body: Dict[str, Any] = {"ok": True, "timestamp": new_data["lastUpdated"]}
    if merged_flag:
        body["merged"] = True
        body["serverData"] = new_data
    return JSONResponse(body)


@app.get("/api/version")
async def get_version() -> Dict[str, Any]:
    data = _read_db()
    return {"lastUpdated": data.get("lastUpdated", 0)}


@app.get("/api/events")
async def sse_events(request: Request) -> EventSourceResponse:
    """
    Server-Sent Events stream. Pushes a 'data_updated' event each time
    POST /api/data succeeds, so connected clients can refresh instantly
    instead of polling. A 'ping' is emitted every 25s as a keepalive
    (proxies often drop idle SSE connections after 30-60s).
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)

    async with _sse_lock:
        _sse_clients.add(queue)

    async def event_generator() -> AsyncGenerator[Dict[str, Any], None]:
        try:
            # Initial event: tell the client the current server version so it
            # can immediately decide whether it's out of date.
            current = _read_db()
            yield {
                "event": "hello",
                "data": json.dumps({"lastUpdated": current.get("lastUpdated", 0)}),
            }

            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield {
                        "event": event.get("type", "message"),
                        "data": json.dumps(event.get("data", {})),
                    }
                except asyncio.TimeoutError:
                    # Heartbeat — keeps the connection alive through proxies.
                    yield {"event": "ping", "data": str(int(time.time() * 1000))}
        finally:
            async with _sse_lock:
                _sse_clients.discard(queue)

    return EventSourceResponse(event_generator())


@app.get("/api/config/db-path")
async def get_db_path_endpoint() -> Dict[str, Any]:
    return {"path": str(DB_FILE)}


@app.post("/api/config/db-path")
async def update_db_path(payload: Dict[str, Any]) -> Dict[str, Any]:
    global DB_FILE
    new_path = payload.get("path")
    if not new_path:
        raise HTTPException(status_code=400, detail="path required")
    p = Path(new_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    SERVER_CONFIG_FILE.write_text(json.dumps({"dbPath": str(p)}, indent=2), encoding="utf-8")
    DB_FILE = p
    if not DB_FILE.exists():
        DB_FILE.write_text(json.dumps(_initial_data(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[NEXUS] DB path updated to {DB_FILE}")
    return {"ok": True, "path": str(DB_FILE)}


# --- MCP discovery proxy ---
#
# Browsers cannot speak the MCP protocol directly (SSE / streamable HTTP, custom
# handshake, no CORS on most servers). This endpoint uses the official Python
# MCP SDK to connect, list tools, and return them as JSON for the frontend
# McpHub editor's "Discover tools" button.
#
# Inspired by the implementation in neo4hack-dotcom/RAG-Chat.

@app.post("/api/mcp/test")
async def test_mcp_connection(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Connect to an MCP server and return its available tools."""
    url = str(payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    auth_token = str(payload.get("authToken") or payload.get("token") or "").strip()
    api_key = str(payload.get("apiKey") or "").strip()
    api_key_header = str(payload.get("apiKeyHeader") or "x-api-key").strip() or "x-api-key"
    disable_ssl = bool(payload.get("disableSslVerification", False))

    # Lazy-import so the rest of the server keeps working if the MCP SDK
    # is not installed yet.
    try:
        from mcp import ClientSession  # type: ignore
        from mcp.client.sse import sse_client  # type: ignore
        from mcp.client.streamable_http import streamablehttp_client  # type: ignore
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "The 'mcp' Python SDK is not installed on the server. "
                "Install it with: pip install 'mcp[cli]'"
            ),
        ) from e

    headers: Dict[str, str] = {"Accept": "application/json, text/event-stream"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    if api_key:
        headers[api_key_header] = api_key

    from urllib.parse import urlparse

    parsed = urlparse(url)
    path = (parsed.path or "").rstrip("/").lower()
    is_sse = path.endswith("/sse") or path == "/sse"

    try:
        if is_sse:
            async with sse_client(url, headers=headers) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tool_defs = await session.list_tools()
                    tools = [
                        {"name": t.name, "description": t.description or ""}
                        for t in (tool_defs.tools or [])
                    ]
                    return {"status": "ok", "tools": tools, "tool_count": len(tools), "transport": "sse"}
        else:
            async with streamablehttp_client(url, headers=headers) as (read_stream, write_stream, _):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tool_defs = await session.list_tools()
                    tools = [
                        {"name": t.name, "description": t.description or ""}
                        for t in (tool_defs.tools or [])
                    ]
                    return {"status": "ok", "tools": tools, "tool_count": len(tools), "transport": "http"}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Surface a useful error to the UI. The transport hint is the most
        # common cause of failures (server expects SSE but URL has no /sse, etc.).
        hint = ""
        msg = str(e).strip() or e.__class__.__name__
        if "406" in msg:
            hint = (
                " | The server rejected the request. Check whether the endpoint"
                " expects SSE (URL should end in /sse) or streamable HTTP."
            )
        raise HTTPException(status_code=400, detail=f"MCP connection failed: {msg}{hint}") from e


# --- Code-repository inventory proxy ---
#
# Browsers running on localhost can't reach internal Bitbucket Server /
# GitHub Enterprise / GitLab Self-Managed instances directly (CORS, intranet
# DNS, self-signed certs). This proxy lets the user provide the URL and
# credentials once and we do the actual HTTP from the FastAPI process.

@app.post("/api/repos/list")
async def list_repos(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Inventory repositories from Bitbucket, GitHub or GitLab.

    Expected payload:
      {
        "provider": "bitbucket_cloud" | "bitbucket_server" | "github" | "gitlab",
        "baseUrl": "https://bitbucket.example.com"          (Server / self-hosted only)
        "workspace": "my-org"                                (Bitbucket Cloud / GitHub org)
        "projectKey": "PROJ"                                 (Bitbucket Server, optional)
        "username": "user"                                   (Basic auth)
        "token": "..."                                       (PAT / Bearer)
        "disableSslVerification": false
      }
    Returns: { "repos": [ { name, url, description, language, visibility }, ... ] }
    """
    try:
        import httpx  # bundled with FastAPI dependency chain
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="httpx not installed on the server. Run: pip install httpx",
        ) from e

    provider = str(payload.get("provider") or "").strip().lower()
    base_url = str(payload.get("baseUrl") or "").strip().rstrip("/")
    workspace = str(payload.get("workspace") or "").strip()
    project_key = str(payload.get("projectKey") or "").strip()
    username = str(payload.get("username") or "").strip()
    token = str(payload.get("token") or "").strip()
    disable_ssl = bool(payload.get("disableSslVerification", False))

    if not provider:
        raise HTTPException(status_code=400, detail="provider is required")

    headers: Dict[str, str] = {"Accept": "application/json"}
    auth = None
    if username and token:
        auth = (username, token)
    elif token:
        # GitHub / GitLab personal access tokens go in Authorization
        if provider == "github":
            headers["Authorization"] = f"token {token}"
        elif provider == "gitlab":
            headers["PRIVATE-TOKEN"] = token
        else:
            headers["Authorization"] = f"Bearer {token}"

    timeout = httpx.Timeout(20.0, read=120.0)

    try:
        async with httpx.AsyncClient(
            headers=headers,
            auth=auth,
            verify=not disable_ssl,
            timeout=timeout,
            follow_redirects=True,
        ) as client:

            if provider == "bitbucket_cloud":
                ws = workspace or username
                if not ws:
                    raise HTTPException(status_code=400, detail="workspace is required for Bitbucket Cloud")
                url = f"https://api.bitbucket.org/2.0/repositories/{ws}?pagelen=100&sort=-updated_on"
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()
                repos = [
                    {
                        "name": v.get("slug") or v.get("name", ""),
                        "url": (v.get("links", {}).get("html") or {}).get("href")
                               or f"https://bitbucket.org/{ws}/{v.get('slug', '')}",
                        "description": v.get("description") or "",
                        "language": v.get("language") or None,
                        "visibility": "private" if v.get("is_private") else "public",
                    }
                    for v in (data.get("values") or [])
                ]
                return {"repos": repos, "provider": provider}

            if provider == "bitbucket_server":
                if not base_url:
                    raise HTTPException(status_code=400, detail="baseUrl is required for Bitbucket Server")
                if project_key:
                    url = f"{base_url}/rest/api/1.0/projects/{project_key}/repos?limit=100"
                else:
                    url = f"{base_url}/rest/api/1.0/repos?limit=100"
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()
                repos = []
                for v in (data.get("values") or []):
                    clone_links = (v.get("links") or {}).get("clone") or []
                    http_clone = next((c.get("href") for c in clone_links if c.get("name") == "http"), None)
                    self_links = (v.get("links") or {}).get("self") or []
                    browse = self_links[0].get("href") if self_links else http_clone
                    repos.append({
                        "name": v.get("slug") or v.get("name", ""),
                        "url": browse or f"{base_url}/projects/{(v.get('project') or {}).get('key')}/repos/{v.get('slug')}",
                        "description": v.get("description") or "",
                        "language": None,
                        "visibility": "public" if v.get("public") else "private",
                    })
                return {"repos": repos, "provider": provider}

            if provider == "github":
                # Per-user or per-org listing
                if workspace:
                    url = f"https://api.github.com/orgs/{workspace}/repos?per_page=100&sort=updated"
                    # If org listing fails (404 for users), retry as user
                    r = await client.get(url)
                    if r.status_code == 404:
                        url = f"https://api.github.com/users/{workspace}/repos?per_page=100&sort=updated"
                        r = await client.get(url)
                else:
                    url = "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,organization_member"
                    r = await client.get(url)
                r.raise_for_status()
                data = r.json()
                repos = [
                    {
                        "name": v.get("name", ""),
                        "url": v.get("html_url") or v.get("clone_url", ""),
                        "description": v.get("description") or "",
                        "language": v.get("language") or None,
                        "visibility": "private" if v.get("private") else "public",
                    }
                    for v in data
                ]
                return {"repos": repos, "provider": provider}

            if provider == "gitlab":
                root = base_url or "https://gitlab.com"
                if workspace:
                    # Group projects
                    url = f"{root}/api/v4/groups/{workspace}/projects?per_page=100&order_by=last_activity_at&include_subgroups=true"
                else:
                    url = f"{root}/api/v4/projects?per_page=100&order_by=last_activity_at&membership=true"
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()
                repos = [
                    {
                        "name": v.get("path") or v.get("name", ""),
                        "url": v.get("web_url", ""),
                        "description": v.get("description") or "",
                        "language": None,
                        "visibility": v.get("visibility") or "private",
                    }
                    for v in data
                ]
                return {"repos": repos, "provider": provider}

            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        detail = f"HTTP {e.response.status_code} from {provider}"
        try:
            body = e.response.text
            if body:
                detail += f" — {body[:280]}"
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=detail) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Repo inventory failed: {e.__class__.__name__}: {e}") from e


@app.post("/api/sharepoint/fetch")
async def sharepoint_fetch(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Proxy endpoint that fetches list items from an on-premise SharePoint via
    its REST API. Doing it server-side avoids browser CORS / mixed-content
    issues and lets us use NTLM authentication that the browser cannot.

    Expected payload:
      {
        "siteUrl":   "https://sharepoint.acme.local/sites/projects",
        "listName":  "Projects",
        "authMethod": "basic" | "bearer" | "ntlm",
        "username":  "user",                  (basic + ntlm)
        "password":  "pwd",                   (basic + ntlm)
        "domain":    "ACME",                  (ntlm only — optional)
        "bearerToken": "...",                 (bearer only)
        "scopeFilter": "Status eq 'Active'",  (OData $filter, optional)
        "maxItems": 200,                      (optional, default 200)
        "disableSslVerification": false
      }

    Returns: { "items": [ {Id, Title, ...}, ... ], "count": N }
    """
    try:
        import httpx
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="httpx not installed on the server. Run: pip install httpx",
        ) from e

    site_url   = str(payload.get("siteUrl") or "").strip().rstrip("/")
    list_name  = str(payload.get("listName") or "").strip()
    auth_method = str(payload.get("authMethod") or "basic").strip().lower()
    username   = str(payload.get("username") or "").strip()
    password   = str(payload.get("password") or "")
    domain     = str(payload.get("domain") or "").strip()
    bearer     = str(payload.get("bearerToken") or "").strip()
    scope_flt  = str(payload.get("scopeFilter") or "").strip()
    max_items  = int(payload.get("maxItems") or 200)
    disable_ssl = bool(payload.get("disableSslVerification", False))

    if not site_url or not list_name:
        raise HTTPException(status_code=400, detail="siteUrl and listName are required")
    if max_items < 1 or max_items > 5000:
        max_items = 200

    # Build the SharePoint REST URL.
    # GET /_api/web/lists/getbytitle('Name')/items?$top=N&$filter=...
    from urllib.parse import quote
    url = f"{site_url}/_api/web/lists/getbytitle('{quote(list_name)}')/items?$top={max_items}"
    if scope_flt:
        url += f"&$filter={quote(scope_flt)}"

    headers: Dict[str, str] = {
        "Accept": "application/json;odata=verbose",
    }
    auth = None

    if auth_method == "bearer":
        if not bearer:
            raise HTTPException(status_code=400, detail="bearerToken required for bearer auth")
        headers["Authorization"] = f"Bearer {bearer}"
    elif auth_method == "ntlm":
        try:
            from httpx_ntlm import HttpNtlmAuth  # type: ignore
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail="httpx-ntlm not installed. Run: pip install httpx-ntlm",
            ) from e
        ntlm_user = f"{domain}\\{username}" if domain else username
        auth = HttpNtlmAuth(ntlm_user, password)
    else:  # basic
        if not username:
            raise HTTPException(status_code=400, detail="username required for basic auth")
        auth = (username, password)

    timeout = httpx.Timeout(20.0, read=120.0)

    try:
        async with httpx.AsyncClient(
            headers=headers,
            auth=auth,
            verify=not disable_ssl,
            timeout=timeout,
            follow_redirects=True,
        ) as client:
            res = await client.get(url)
            if res.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"SharePoint returned HTTP {res.status_code}: {res.text[:200]}",
                )
            data = res.json()
            # OData "verbose" wraps results in { d: { results: [...] } }
            if isinstance(data, dict):
                if "d" in data and isinstance(data["d"], dict) and "results" in data["d"]:
                    items = data["d"]["results"]
                elif "value" in data and isinstance(data["value"], list):
                    items = data["value"]   # nodata or odata=nometadata
                else:
                    items = []
            else:
                items = []
            return {"items": items, "count": len(items)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"SharePoint fetch failed: {e.__class__.__name__}: {e}",
        ) from e



# --- Optional: serve built frontend from /dist ---
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        target = DIST_DIR / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(target)
        index = DIST_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built. Run `npm run build`."}, status_code=404)


if __name__ == "__main__":
    print(
        "\n==================================================\n"
        f"  NEXUS.AI API (FastAPI)  •  http://localhost:{PORT}\n"
        f"  DB : {DB_FILE}\n"
        "==================================================\n"
    )
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=True)
