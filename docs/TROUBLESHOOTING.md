# Troubleshooting

## Setup & launch

**`run.bat` says Python isn't found / closes immediately**
Install Python from <https://www.python.org/downloads/> and **tick “Add Python to PATH”**
during install. Reopen the terminal and try again. You can verify with `python --version`.

**“Node.js (npm) is required to build the UI but was not found.”**
Install Node.js LTS from <https://nodejs.org>, then re-run. Or use Docker, which doesn't
need Node (`docker compose up --build`).

**Port 8000 is already in use**
Run on another port:
- macOS/Linux: `PORT=9000 ./run.sh`
- Windows: `set PORT=9000` then `run.bat`
- Docker: change the `ports:` mapping in `docker-compose.yml` to e.g. `"9000:8000"`.

**The UI didn't open / shows a blank page**
Open `http://localhost:8000` manually. If blank, rebuild the UI: `./run.sh --rebuild`
(Windows: `run.bat --rebuild`). Check the terminal for errors.

**Backend dependencies fail to install**
Make sure you have Python **3.10+** (`python --version`). Behind a corporate proxy you may
need to configure `pip`'s proxy settings.

## Accounts & codes

**Codes don't match the Steam app**
Steam Guard codes depend on the clock. Make sure your device's time is accurate
(enable automatic time sync).

**“Invalid shared_secret”**
The shared secret must be the base64 string from your `.maFile` (16+ bytes). Copy it
exactly, with no surrounding quotes or spaces.

**Avatars don't load**
Avatars are fetched from your public Steam profile. They won't appear if the profile is
private, if the server can't reach `steamcommunity.com`, or if a local proxy/ad-blocker
blocks Steam's image CDN. The app falls back to colored initials. Avatars are backfilled
automatically on load and after you sign in to Steam.

## Steam sign-in & confirmations

**“No valid session — sign in to Steam first”**
Open the account → **Sign in to Steam** and enter your Steam password. This is needed for
confirmations and QR approval (code generation works without it).

**“Provided token belongs to a different account”**
The stored SteamID didn't match the signed-in account. This is handled automatically now —
sign in to Steam again and it will correct itself.

**Confirmations won't sync for one account**
That account likely needs re-linking — open it and **Sign in to Steam** again. A
per-account warning appears on the Confirmations screen when this happens.

**Steam login fails**
Double-check the Steam password and that the account's `shared_secret` is correct (the app
uses it to answer the Steam Guard challenge automatically). Rate limits or temporary Steam
issues can also cause failures — wait and retry.

## QR login

**“Reading QR from images needs a Chromium-based browser.”**
This message is from an old version. Update and rebuild — QR decoding now uses jsQR and
works in all browsers.

**Clipboard paste button does nothing**
Browsers only allow clipboard image access on **HTTPS** or `localhost`, and may ask for
permission. As a fallback, click in the field and press **Ctrl/Cmd+V**, or use
**Scan with camera**.

**Camera scan won't start**
Camera access also requires HTTPS or `localhost` and a permission grant.

## Security & accounts

**I forgot my Modern SDA password**
There is no reset — your password protects your encrypted secrets. You can register a new
account and re-import your `.maFile`s. (The server could still technically read existing
secrets with its master key, but the app intentionally doesn't expose a backdoor.)

**Too many attempts / HTTP 429**
Brute-force protection kicks in after repeated login/register attempts. Wait a minute and
try again.

## Docker

**Data disappeared after rebuild**
Make sure you didn't run `docker compose down -v` (the `-v` deletes the data volume). Set
`SERVER_MASTER_KEY` in `.env` so keys stay stable across rebuilds.

**Can't reach it from another device**
The container binds `0.0.0.0:8000`; open your host's firewall and use the host's IP. For
QR/clipboard features and safety, put HTTPS in front (see [Deployment](DEPLOYMENT.md)).

---

Still stuck? Open an issue with your OS, how you launched it, and the terminal output.
