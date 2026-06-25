# Modern SDA Web

A fast, modern **Steam Desktop Authenticator** for the browser — a web port of
[Modern-SDA](https://github.com/HouwyTwitch/Modern-SDA) (PyQt5) and
[Modern-SDA-Android](https://github.com/HouwyTwitch/Modern-SDA-Android) (Jetpack
Compose).

Generate Steam Guard codes, manage multiple accounts, and approve/decline
trade & market confirmations — all from a single responsive web app that works
on desktop and mobile.

![desktop](docs/desktop-accounts.png)

## Features

- 🔑 **Real Steam Guard codes** — generated locally in your browser with the Web
  Crypto API (HMAC-SHA1). Secrets never leave your device for code generation.
- 👥 **Multiple accounts** — import one or many `.maFile`s (drag & drop) or add
  them manually. Search, filter, favorite.
- ⏱️ **Animated 30s countdown rings** with one-tap copy.
- ✅ **Confirmations** — view, approve, decline, or bulk-accept trade and market
  confirmations, grouped per account.
- 🎨 **Modern theming** — Dark / Light / High-contrast / System, seven accent
  colors, live switching. Respects `prefers-reduced-motion`.
- 🔒 **Safe to use** — optional master password encrypts the local vault with
  **AES-GCM** (PBKDF2, 250k iterations). Auto-lock after inactivity.
- 📱 **Fully responsive** — desktop sidebar + detail pane, mobile bottom-nav.
- 💾 **Backup** — export / import an encrypted JSON backup.

## Tech stack

| Layer    | Tech                                                        |
| -------- | ---------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand          |
| Crypto   | Web Crypto API (codes + vault encryption)                  |
| Backend  | Python · FastAPI · httpx (Steam confirmation proxy)        |

## Getting started

### Frontend

```bash
npm install
npm run dev          # http://localhost:5173
```

That's all you need for code generation and the full UI (with demo data).

### Backend (optional — for live Steam confirmation syncing)

The browser cannot call `steamcommunity.com` directly (CORS), so live
confirmation listing/acting is handled by a small Python service. Code
generation does **not** require it.

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Vite proxies `/api/*` to the backend automatically (see `vite.config.ts`).

#### API

| Method | Path                        | Purpose                                  |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/api/health`               | Liveness check                           |
| POST   | `/api/code`                 | Generate a Steam Guard code              |
| POST   | `/api/confirmations/list`   | List pending confirmations              |
| POST   | `/api/confirmations/act`    | Approve / decline a confirmation         |

Confirmation endpoints take per-request Steam session credentials
(`steamLoginSecure` cookie + `identity_secret`). Nothing is persisted
server-side.

## How Steam Guard codes work

A Steam Guard code is a TOTP variant: `HMAC-SHA1(shared_secret, ⌊unixtime / 30⌋)`
truncated and mapped onto the alphabet `23456789BCDFGHJKMNPQRTVWXY` to produce a
5-character code. The frontend (`src/lib/steamGuard.ts`) and backend
(`server/steam_guard.py`) implement the identical algorithm and produce
byte-for-byte matching codes.

## Security notes

- Your `shared_secret` / `identity_secret` are stored **locally** (browser
  `localStorage`). Enabling a master password encrypts them at rest with
  AES-GCM; the password is never stored and cannot be recovered if lost.
- Use this only with accounts you own. Keep backups of your `.maFile`s — losing
  your authenticator secret can lock you out of your Steam account.

## Project structure

```
src/
  lib/          steamGuard, crypto (AES-GCM), maFile parsing, formatting
  store/        Zustand store + persistence
  hooks/        live codes, theme, auto-lock
  components/   layout, accounts, confirmations, common UI
  pages/        Accounts, Confirmations, Settings
server/         FastAPI backend (Steam confirmation proxy)
```

## License

MIT
