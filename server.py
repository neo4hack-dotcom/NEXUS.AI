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

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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

    current = _read_db()

    # Optimistic concurrency control
    if x_base_version and x_base_version != "force":
        server_version = str(current.get("lastUpdated", 0))
        if server_version != str(x_base_version):
            print(f"[NEXUS] Conflict: client={x_base_version} server={server_version}")
            return JSONResponse(
                status_code=409,
                content={"error": "Conflict detected", "serverData": current},
            )

    new_data["lastUpdated"] = int(time.time() * 1000)
    _write_db(new_data)
    print(f"[NEXUS] Saved at {time.strftime('%H:%M:%S')} ({len(json.dumps(new_data))} bytes)")
    return JSONResponse({"ok": True, "timestamp": new_data["lastUpdated"]})


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
