# User Guide

Everything you can do in Modern SDA Web. If you haven't installed it yet, start with the
[Installation Guide](INSTALL.md).

## Contents

- [Creating your account](#creating-your-account)
- [What is a `.maFile`?](#what-is-a-mafile)
- [Adding a Steam account](#adding-a-steam-account)
- [Signing in to Steam (for confirmations & QR)](#signing-in-to-steam)
- [Steam Guard codes](#steam-guard-codes)
- [Confirmations (trades & market)](#confirmations)
- [Approving a QR login](#approving-a-qr-login)
- [Editing, proxies & favorites](#editing-proxies--favorites)
- [Revealing secrets](#revealing-secrets)
- [Settings & themes](#settings--themes)
- [Using it on your phone](#using-it-on-your-phone)

---

## Creating your account

On first launch you'll see a welcome screen.

1. Click **Sign up**.
2. Enter an email and a password (6+ characters).
3. You're in.

This account is **local to your installation** — it's how the app keeps each person's
Steam accounts private and encrypted. Your password also protects your secrets, so pick a
good one. **There is no password reset** — if you lose it, secrets encrypted with it can't
be recovered by you (keep your `.maFile` backups).

## What is a `.maFile`?

A `.maFile` is the file the Steam Mobile Authenticator (or tools like SDA) creates when
you set up Steam Guard. It contains your `shared_secret` (used to generate codes) and
`identity_secret` (used to sign confirmations). Modern SDA Web reads these to do its job.

> 🔒 Keep your `.maFile`s backed up somewhere safe. They are the keys to your Steam Guard.

## Adding a Steam account

Click **Add Account** (top-right on the Accounts screen). Two ways:

### Import a `.maFile` (easiest)
- Drag-and-drop one or more `.maFile`s onto the drop zone, or click to browse.
- Optionally set a **proxy** to route this account's Steam traffic.

### Manual entry
Fill in the fields:
- **Account name** — a label for you.
- **SteamID64** — the 17-digit id (optional; auto-filled when you sign in to Steam).
- **Shared secret** *(required)* — base64 string from your `.maFile`.
- **Identity secret** — base64 string (needed for confirmations).
- **Steam password** *(optional)* — lets you link the session immediately.
- **Proxy** *(optional)*.

New accounts appear in the list with a live, rotating Steam Guard code.

## Signing in to Steam

Generating codes works offline. **Confirmations and QR approval need a Steam session.**

1. Open an account (click its row) to reveal the detail panel.
2. Click **Sign in to Steam**.
3. Enter your **Steam password**.
4. Optionally tick **Remember password** — this stores it (encrypted) so the app can
   automatically log back in when the session eventually expires. If you leave it
   unchecked, the password is used once and never stored.

Behind the scenes this obtains a long-lived **refresh token** (stored encrypted) and
reuses it, refreshing access automatically. The account's status turns **Online** and its
Steam avatar loads.

## Steam Guard codes

- Each account row shows its current 5-character code and a ring counting down the 30
  seconds until it rotates.
- **Click a code to copy it.** On desktop, hover to see the copy button.
- Open an account for a large, easy-to-read code in the detail panel.

Codes are computed on the server from your shared secret and are correct as long as your
device clock is roughly accurate.

## Confirmations

The **Confirmations** tab shows pending trade and market confirmations across all your
signed-in accounts, grouped by account.

- **Approve** ✓ or **Decline** ✕ each one with the buttons on the right.
- **Accept all** for an account with one click (respects the Trades/Market filter).
- **Click a confirmation** to open a details view with item images and the full summary,
  where you can also approve or decline.
- Use the **All / Trades / Market** tabs to filter.
- Hit the **refresh** button (top-right) to re-sync.

> Declining only declines — it sends a single *cancel* to Steam and never approves first.

If an account can't sync, you'll see a small warning — it usually means that account needs
to be re-linked (sign in to Steam again).

## Approving a QR login

When you scan a Steam "Sign in with QR" code with the official app, it approves the login.
Modern SDA Web can do the same for a linked account:

1. Open the account → **Approve QR login** (the account must be signed in to Steam).
2. Provide the QR challenge in any of these ways:
   - **Paste image from clipboard** — copy a screenshot of the QR, click the button.
   - **Paste into the field** — `Ctrl/Cmd+V` an image, or paste the challenge link text.
   - **Scan with camera** — use your device camera to scan the QR on another screen.
3. Click **Approve** (or **Deny**).

The challenge is signed locally with the account's shared secret and sent to Steam.

## Editing, proxies & favorites

In an account's detail panel:
- **Edit** (pencil icon) — rename the account or set/change its **proxy**
  (`http://`, `https://`, or `socks` URL).
- **Favorite** (star) — pins the account to the top of the list.
- **Remove** — deletes the account from this app (your Steam account is untouched).

## Revealing secrets

Need your `shared_secret`/`identity_secret` back? Open an account → **Reveal secrets** →
enter **your Modern SDA password**. The secrets are decrypted with *your* key and shown so
you can copy them. This proves your data is recoverable by you, not just the server.

## Settings & themes

The **Settings** tab lets you:
- See which account you're signed in as, and **Sign out**.
- Switch **theme** — System / Dark / Light / High-contrast.
- Pick an **accent color**.

Preferences are saved in your browser.

## Using it on your phone

Modern SDA Web is fully responsive with a mobile bottom-nav. To use it on your phone, host
it on a machine on your network (or the internet) and open it from the phone — see
[Deployment](DEPLOYMENT.md). For camera-based QR scanning and clipboard access, the page
must be served over **HTTPS** (or `localhost`).
