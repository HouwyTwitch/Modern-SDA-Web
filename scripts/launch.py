#!/usr/bin/env python3
"""One-command launcher for Modern SDA Web (Windows / macOS / Linux).

Sets up the Python virtualenv + dependencies, builds the web UI if needed, then
starts the single-server app and opens your browser. Re-running is fast: each
step is skipped when already done.

Usage:
    python scripts/launch.py            # set up (if needed) and run
    python scripts/launch.py --rebuild  # force-rebuild the UI
    python scripts/launch.py --setup    # set up only, don't start the server

Environment:
    PORT   port to listen on (default 8000)
    HOST   host to bind     (default 127.0.0.1)
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
VENV = SERVER / ".venv"
DIST = ROOT / "dist"
REQS = SERVER / "requirements.txt"

IS_WINDOWS = os.name == "nt"
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = os.environ.get("PORT", "8000")


# ---------- pretty output ----------
def info(msg: str) -> None:
    print(f"  \033[36m›\033[0m {msg}" if not IS_WINDOWS else f"  > {msg}")


def ok(msg: str) -> None:
    print(f"  \033[32m✓\033[0m {msg}" if not IS_WINDOWS else f"  [ok] {msg}")


def die(msg: str) -> None:
    print(f"\n  \033[31m✗ {msg}\033[0m\n" if not IS_WINDOWS else f"\n  [error] {msg}\n")
    sys.exit(1)


def run(cmd: list[str], cwd: Path | None = None, shell: bool = False) -> None:
    result = subprocess.run(cmd, cwd=cwd, shell=shell)
    if result.returncode != 0:
        die(f"Command failed: {' '.join(cmd)}")


# ---------- tool discovery ----------
def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def find_npm() -> str | None:
    return shutil.which("npm.cmd") or shutil.which("npm") if IS_WINDOWS else shutil.which("npm")


def check_python() -> None:
    if sys.version_info < (3, 10):
        die(f"Python 3.10+ is required (you have {sys.version.split()[0]}). See docs/INSTALL.md")


# ---------- setup steps ----------
def ensure_venv() -> None:
    if not venv_python().exists():
        info("Creating Python virtual environment…")
        run([sys.executable, "-m", "venv", str(VENV)])
        ok("Virtual environment created")


def reqs_hash() -> str:
    return hashlib.sha256(REQS.read_bytes()).hexdigest()[:16]


def ensure_backend_deps() -> None:
    marker = VENV / ".deps-installed"
    current = reqs_hash()
    if marker.exists() and marker.read_text().strip() == current:
        return
    info("Installing backend dependencies (first run can take a minute)…")
    run([str(venv_python()), "-m", "pip", "install", "--quiet", "--upgrade", "pip"])
    run([str(venv_python()), "-m", "pip", "install", "--quiet", "-r", str(REQS)])
    marker.write_text(current)
    ok("Backend dependencies ready")


def ensure_frontend(rebuild: bool = False) -> None:
    npm = find_npm()
    if (DIST / "index.html").exists() and not rebuild:
        ok("Web UI already built")
        return
    if not npm:
        die(
            "Node.js (npm) is required to build the UI but was not found.\n"
            "    Install it from https://nodejs.org (LTS), then re-run.\n"
            "    Tip: Docker users can skip Node — see docs/INSTALL.md."
        )
    if not (ROOT / "node_modules").exists():
        info("Installing frontend dependencies…")
        run([npm, "install"], cwd=ROOT, shell=IS_WINDOWS)
    info("Building the web UI…")
    run([npm, "run", "build"], cwd=ROOT, shell=IS_WINDOWS)
    ok("Web UI built")


def open_browser_later(url: str) -> None:
    def _open() -> None:
        time.sleep(2.0)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()


def start_server() -> None:
    url = f"http://{HOST}:{PORT}"
    print()
    ok(f"Starting Modern SDA Web at \033[1m{url}\033[0m" if not IS_WINDOWS else f"Starting Modern SDA Web at {url}")
    info("Press Ctrl+C to stop.")
    print()
    open_browser_later(url if HOST not in ("0.0.0.0", "::") else f"http://127.0.0.1:{PORT}")
    env = os.environ.copy()
    try:
        subprocess.run(
            [str(venv_python()), "-m", "uvicorn", "main:app", "--host", HOST, "--port", PORT],
            cwd=SERVER,
            env=env,
        )
    except KeyboardInterrupt:
        pass


def main() -> None:
    args = sys.argv[1:]
    print("\n  Modern SDA Web — launcher\n")
    check_python()
    ensure_venv()
    ensure_backend_deps()
    ensure_frontend(rebuild="--rebuild" in args)
    if "--setup" in args:
        ok("Setup complete. Run again without --setup to start.")
        return
    start_server()


if __name__ == "__main__":
    main()
