# Installation Guide

Modern SDA Web runs on **Windows, macOS, and Linux**. Pick the path that suits you:

- [Option A — Run scripts](#option-a--run-scripts-recommended) (needs Python + Node.js)
- [Option B — Docker](#option-b--docker) (needs only Docker)
- [Manual setup](#manual-setup) (for development)

---

## Prerequisites

### Option A needs two free tools (install once):

| Tool | Why | Download |
| ---- | --- | -------- |
| **Python 3.10+** | Runs the backend | <https://www.python.org/downloads/> |
| **Node.js 18+ (LTS)** | Builds the web UI | <https://nodejs.org> |

> **Windows tip:** when installing Python, tick **“Add Python to PATH”** on the first
> screen of the installer. This lets `run.bat` find it.

To check they're installed, open a terminal (Command Prompt / PowerShell / Terminal) and run:

```bash
python --version
node --version
```

### Option B needs only:

| Tool | Download |
| ---- | -------- |
| **Docker Desktop** | <https://www.docker.com/products/docker-desktop/> |

---

## Option A — Run scripts (recommended)

1. **Download the project** — either `git clone` it or download the ZIP from GitHub and
   extract it.
2. **Start it:**
   - **Windows:** double-click **`run.bat`**
   - **macOS / Linux:** open a terminal in the folder and run `./run.sh`
3. The first launch installs everything (1–2 minutes). When you see
   *“Starting Modern SDA Web at http://localhost:8000”*, your browser opens automatically.
4. **Register an account** on the welcome screen and you're in. See the
   [User Guide](USER_GUIDE.md).

Later launches skip setup and start in a couple of seconds.

**Useful flags:**
```bash
./run.sh --rebuild     # rebuild the UI after pulling updates
./run.sh --setup       # install/build only, don't start the server
PORT=9000 ./run.sh     # use a different port
```
On Windows: `run.bat --rebuild`, or `set PORT=9000` then `run.bat`.

---

## Option B — Docker

No need for Python or Node — Docker builds everything inside a container.

```bash
# 1. (Recommended) set secrets so data survives rebuilds with known keys:
cp .env.example .env
#    then edit .env and paste two values from:
#    python -c "import secrets;print(secrets.token_hex(32))"

# 2. Build and run:
docker compose up --build
```

Open **http://localhost:8000**. Your data lives in a Docker volume (`msda-data`) and
persists across restarts and rebuilds.

To stop: `Ctrl+C`, or `docker compose down` (add `-v` to also delete data).

---

## Manual setup

For development with hot-reload, or if you prefer running the pieces yourself.

**Backend:**
```bash
cd server
python -m venv .venv
# Windows:  .venv\Scripts\activate
# mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend (separate terminal):**
```bash
npm install
npm run dev          # http://localhost:5173 — proxies /api to the backend
```

For a production-style single server, build the UI first (`npm run build`) and just run
the backend — it serves the built `dist/` automatically.

---

## Updating

```bash
git pull
./run.sh --rebuild          # Windows: run.bat --rebuild
# Docker:
docker compose up --build
```

Your accounts and settings are stored locally (SQLite database) and are **not** affected
by updating the code.

---

## Uninstalling

Modern SDA Web doesn't install anything globally. To remove it:

- Delete the project folder.
- Docker users: `docker compose down -v` removes the data volume too.

Your Steam accounts are unaffected — this app never changes your Steam settings; it only
generates codes and approves the confirmations you click.

---

Stuck? See [Troubleshooting](TROUBLESHOOTING.md).
