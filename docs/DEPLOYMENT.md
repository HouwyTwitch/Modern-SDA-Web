# Deployment

How to host Modern SDA Web for yourself or others. For just running it locally, the
[Installation Guide](INSTALL.md) is all you need.

## Single-server model

In production the FastAPI backend **serves the built web UI**, so the entire app is one
process on one port — no separate frontend server, proxy, or CORS needed.

```bash
npm run build                 # produces dist/
cd server
uvicorn main:app --host 0.0.0.0 --port 8000
```

The backend automatically serves `dist/` (see `server/static_site.py`). Open the port and
you have the full app.

## Environment variables

Set these in production (see `server/.env.example`):

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `SERVER_MASTER_KEY` | auto-generated | 32-byte hex key that wraps every vault. **Set this and keep it stable** — changing it makes stored secrets unreadable. |
| `JWT_SECRET` | auto-generated | 32-byte hex key signing session tokens. |
| `RSA_PRIVATE_KEY_PEM` | auto-generated | Optional PEM for the encrypted channel. |
| `DATABASE_URL` | SQLite in `DATA_DIR` | Async SQLAlchemy URL. |
| `DATA_DIR` | `server/` | Where the DB + auto-generated keys live (mount as a volume). |
| `CORS_ORIGINS` | `localhost:5173` | Comma-separated allowed origins (only needed if the UI is on a different origin). |
| `JWT_TTL_MINUTES` | `720` | Session lifetime. |
| `UNLOCK_TTL_MINUTES` | `60` | How long your password-derived key stays cached. |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Bind address (the launcher/Docker use these). |

Generate strong secrets:
```bash
python -c "import secrets;print(secrets.token_hex(32))"
```

## Docker (recommended for hosting)

```bash
cp .env.example .env     # fill in SERVER_MASTER_KEY and JWT_SECRET
docker compose up --build -d
```

- Data and keys persist in the `msda-data` volume.
- Update with `git pull && docker compose up --build -d`.
- Logs: `docker compose logs -f`.

## Put HTTPS in front

Always serve over HTTPS when exposing beyond `localhost` (also required for camera/QR and
clipboard features in the browser). Terminate TLS with a reverse proxy — e.g. **Caddy**:

```caddyfile
sda.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

…or **nginx**:

```nginx
server {
    listen 443 ssl;
    server_name sda.example.com;
    # ssl_certificate ...; ssl_certificate_key ...;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;   # used for rate limiting
    }
}
```

Set `CORS_ORIGINS=https://sda.example.com` if you serve the UI from a different origin
(not needed in single-server mode).

## Scaling notes

The app is designed for personal / small-group use. Two things are **process-local**:

- the **rate limiter** (`server/ratelimit.py`), and
- the **unlock cache** of password-derived keys.

If you run multiple worker processes or replicas, run a **single worker** (the default) or
move these to a shared store (e.g. Redis). SQLite is fine for this workload; switch
`DATABASE_URL` to Postgres if you expect many concurrent users.

## Backups

Back up your `DATA_DIR` (the SQLite `*.db` file) and your `SERVER_MASTER_KEY`. You need
**both** to restore — the database is useless without the key. Keep the key somewhere
separate from the database backup.
