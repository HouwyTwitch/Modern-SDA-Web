# Modern SDA Web

A fast, modern, **multi-user** Steam Desktop Authenticator for the browser — a web
port of [Modern-SDA](https://github.com/HouwyTwitch/Modern-SDA) (PyQt5) and
[Modern-SDA-Android](https://github.com/HouwyTwitch/Modern-SDA-Android) (Compose).

Each user signs in, manages their own Steam accounts, generates Steam Guard
codes, and approves trade/market confirmations and **QR logins** live — with
every account secret sealed by envelope encryption.

![accounts](docs/desktop-accounts.png)

## Highlights

- 👤 **Multi-user** — register/sign in; every user has their own private set of
  Steam accounts (JWT auth).
- 🔐 **Encrypted vaults** — each account's secrets are sealed so they can be
  decrypted **only by you** (your password) **or the server** (its master key),
  never by anyone with just the database. See [Encryption](#encryption).
- 🔑 **Live Steam Guard codes** — generated server-side, rotating every 30s with
  animated countdown rings.
- 🔄 **Live confirmations** — list, approve, decline, and bulk-accept trade &
  market confirmations directly against Steam (via `aiosteampy`).
- 📷 **QR login approval** — approve a Steam "sign in with QR" challenge by
  pasting the URL or scanning it with your camera; signed with the account's
  shared secret (mirrors Modern-SDA's `UpdateAuthSessionWithMobileConfirmation`).
- 🪪 **Refresh-token sessions** — sign in to Steam once; a refresh token is stored
  encrypted and reused, refreshing the access token automatically.
- 🎨 **Polished, responsive UI** — Dark/Light/High-contrast/System themes, accent
  colors, glass surfaces, smooth transitions; desktop sidebar + mobile bottom nav.

## Architecture

```
React + TS + Vite + Tailwind  ──HTTPS/JWT──►  FastAPI (Python)
  (UI, theming, countdowns)                     ├─ SQLite (users, accounts)
                                                ├─ envelope encryption (vault.py)
                                                └─ aiosteampy ──► Steam
```

| Layer    | Tech                                                              |
| -------- | ---------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand                |
| Backend  | FastAPI, SQLAlchemy 2 (async) + SQLite, PyJWT, `cryptography`    |
| Steam    | `aiosteampy` (auth, refresh tokens, confirmations) + QR signing  |

## Getting started

Run the backend and frontend together (the Vite dev server proxies `/api` to the
backend automatically — see `vite.config.ts`).

### 1. Backend

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

On first run it generates a dev master key + JWT secret (gitignored). **In
production set `SERVER_MASTER_KEY` and `JWT_SECRET`** to strong random values:

```bash
export SERVER_MASTER_KEY=$(python -c "import secrets;print(secrets.token_hex(32))")
export JWT_SECRET=$(python -c "import secrets;print(secrets.token_hex(32))")
```

### 2. Frontend

```bash
npm install
npm run dev          # http://localhost:5173
```

Register an account, import a `.maFile` (or add manually), then **Sign in to
Steam** on an account to enable live confirmations and QR approval.

## Encryption

Per Steam account:

1. A random 256-bit **data key (DEK)** encrypts each secret with AES-256-GCM.
2. The DEK is **wrapped twice** — once with a key derived from your password
   (scrypt), once with the server master key.

Either wrap recovers the DEK, so:

- the **server** can decrypt to run live confirmations / generate codes, and
- **you** can decrypt with your password (e.g. the “Reveal secrets” action),

while a leaked database alone reveals nothing. Codes are generated server-side
and your secrets are never sent to the browser unless you explicitly reveal them.

## API overview

| Method | Path                                                  | Purpose                       |
| ------ | ----------------------------------------------------- | ----------------------------- |
| POST   | `/api/auth/register` · `/api/auth/login`              | Account auth (returns JWT)    |
| GET    | `/api/accounts` · `/api/accounts/codes`               | List accounts + live codes    |
| POST   | `/api/accounts`                                       | Add a Steam account           |
| POST   | `/api/accounts/{id}/reveal`                           | Decrypt secrets with password |
| POST   | `/api/accounts/{id}/steam-login`                      | Get a refresh token           |
| GET    | `/api/confirmations`                                  | Live confirmations (all)      |
| POST   | `/api/accounts/{id}/confirmations/{cid}`              | Approve / decline             |
| POST   | `/api/accounts/{id}/qr-approve`                       | Approve a QR login            |

## Security notes

- Use only with accounts you own; keep backups of your `.maFile`s.
- The Steam-facing calls (login, confirmations, QR) require a reachable
  `steamcommunity.com` / `api.steampowered.com` and a valid Steam session;
  they can't be exercised from a sandbox without real credentials.

## License

MIT
