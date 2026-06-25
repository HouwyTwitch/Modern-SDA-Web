# Security Model

Modern SDA Web handles Steam authenticator secrets, so it's built with defence in depth.
This document explains exactly how your data is protected and what to keep in mind.

## Threat model

The design protects your secrets against:

- **Database theft** — someone who copies the SQLite database learns nothing usable.
- **Network eavesdropping** — request/response bodies are encrypted at the app layer in
  addition to TLS.
- **Other users on the same server** — strict per-user ownership checks.
- **Casual server-side exposure** — passwords are never received or stored in plaintext.

It does **not** protect against a fully compromised server *with* its master key, a
compromised client device, or malware/keyloggers on your machine — no web app can.

## Layer 1 — Client-side password hashing

Your account password is never sent to the server as-is. The browser derives a hash with
**PBKDF2-SHA256** (150k iterations, salted with your email) and sends only that hash. The
server uses the hash for authentication and as the basis for your encryption key.

_Code: `src/lib/passwordHash.ts`._

## Layer 2 — Encrypted application channel

On top of HTTPS, every API request and response **body** is encrypted:

1. The client fetches the server's **RSA public key** once (`/api/crypto/pubkey`).
2. For each request it generates a fresh **AES-256-GCM** session key, encrypts the body,
   and sends the session key **RSA-OAEP-wrapped** in the `X-Session-Key` header.
3. The server decrypts the request and encrypts the response with the same per-request key.

This keeps passwords, secrets, and codes confidential even if TLS is terminated early
(e.g. behind a misconfigured proxy). Encrypted request bodies are capped (4 MB) to guard
against memory-exhaustion.

_Code: `src/lib/secureChannel.ts`, `server/server_crypto.py`, `server/crypto_mw.py`._

## Layer 3 — Envelope-encrypted vault at rest

Each Steam account's secrets (`shared_secret`, `identity_secret`, `refresh_token`,
optional Steam password) are sealed like this:

1. A random 256-bit **data key (DEK)** encrypts each secret with **AES-256-GCM**.
2. The DEK is **wrapped twice**:
   - with a key derived from **your password** (scrypt), and
   - with the **server master key**.

Either wrap can recover the DEK, which means:

- the **server** can decrypt to generate codes and run live confirmations, and
- **you** can decrypt with your password (the “Reveal secrets” action),

while **a stolen database alone reveals nothing** — the server master key lives in the
environment/keyfile, not the database.

_Code: `server/vault.py`._

## Additional hardening

- **Authorization:** every account-scoped endpoint verifies the account belongs to the
  caller (no IDOR).
- **Brute force:** in-memory rate limiting on register/login (HTTP 429 when exceeded).
- **Input validation:** SteamIDs must be numeric; proxies must be `http(s)`/`socks` URLs —
  closing an SSRF vector in the avatar fetch.
- **Passwords:** compared in constant time; never logged.
- **JWT:** pinned to `HS256` (no algorithm-confusion); short-lived.
- **XSS:** React escapes all output; no `innerHTML`/`eval`/`dangerouslySetInnerHTML`.
- **Code generation** happens server-side; secrets are never sent to the browser unless
  you explicitly reveal them with your password.

## Your responsibilities

- **Set strong secrets in production:** `SERVER_MASTER_KEY` and `JWT_SECRET`
  (see [Deployment](DEPLOYMENT.md)). In dev they're auto-generated and gitignored.
- **Serve over HTTPS** when exposing beyond `localhost` — the `Authorization` header and
  TLS handshake are transport-level concerns the app layer can't replace.
- **Back up your `.maFile`s.** Losing your authenticator secret can lock you out of Steam.
- **Use only accounts you own.**

## Reporting a vulnerability

Please open a private security advisory on the repository rather than a public issue.
