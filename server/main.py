"""Modern SDA Web — multi-user backend API.

- User accounts with JWT auth.
- Per-user Steam accounts, secrets sealed with envelope encryption (only the
  server or the owner can decrypt — see vault.py).
- Live Steam Guard codes, confirmations, and QR-login approval via aiosteampy.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import steam_guard
import steam_service as steam
import server_crypto
import vault
from crypto_mw import EncryptedChannelMiddleware
from auth import (
    Principal,
    cache_user_key,
    clear_session,
    current_principal,
    get_user_by_email,
    issue_token,
)
from config import get_settings
from db import get_db, init_db
from models import SteamAccount, User
from ratelimit import client_ip, rate_limit
from schemas import (
    AccountOut,
    AccountWithCode,
    ActRequest,
    AddAccountRequest,
    AuthResponse,
    CodeOut,
    LoginRequest,
    QrApproveRequest,
    RegisterRequest,
    RevealRequest,
    SteamLoginRequest,
    UpdateAccountRequest,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Modern SDA Web API", version="2.1.0", lifespan=lifespan)
# Order matters: CORS is added last so it is the outermost middleware.
app.add_middleware(EncryptedChannelMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-enc"],
)


@app.get("/api/crypto/pubkey")
async def crypto_pubkey():
    """Server RSA public key (PEM) used to bootstrap the encrypted channel."""
    return {"pubkey": server_crypto.public_key_pem()}


# ---------------- helpers ----------------
AVATAR_COLORS = ["#1a9fff", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#6366f1"]


def _avatar_color(seed: str) -> str:
    h = 0
    for ch in seed:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return AVATAR_COLORS[h % len(AVATAR_COLORS)]


def _account_out(a: SteamAccount) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "steamId": a.steam_id,
        "avatarColor": a.avatar_color,
        "avatarUrl": a.avatar_url,
        "proxy": a.proxy,
        "status": a.status,
        "favorite": a.favorite,
        "hasIdentity": a.has_identity,
        "hasSession": a.has_session,
        "lastConfirmation": a.last_confirmation * 1000 if a.last_confirmation else None,
        "lastLogin": a.last_login * 1000 if a.last_login else None,
        "createdAt": a.created_at * 1000 if a.created_at else None,
    }


async def _get_owned_account(db: AsyncSession, principal: Principal, account_id: str) -> SteamAccount:
    acc = await db.get(SteamAccount, account_id)
    if not acc or acc.user_id != principal.user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    return acc


def _server_secrets(acc: SteamAccount) -> dict:
    return vault.decrypt_with_server(acc.secrets_blob)


def _sync_steam_id(acc: SteamAccount, secrets: dict) -> None:
    """Keep the stored steamid aligned with the refresh token's account."""
    resolved = steam.resolve_steam_id(secrets, acc.steam_id)
    if resolved and resolved != acc.steam_id:
        acc.steam_id = resolved


async def _persist_new_refresh(db: AsyncSession, acc: SteamAccount, new_refresh: str | None):
    """If a Steam operation produced a fresh refresh token, re-seal it."""
    if not new_refresh:
        return
    # Re-seal using server key only path: we need a user_key to rewrap. Reuse the
    # existing user-wrapped DEK by re-encrypting with server key derivation is not
    # possible without user_key, so we keep the existing blob's DEK.
    blob = vault.json.loads(acc.secrets_blob)
    dek = vault._open(get_settings().server_master_key, blob["dek_srv"])
    blob["fields"]["refresh_token"] = vault._seal(dek, new_refresh.encode("utf-8"))
    acc.secrets_blob = vault.json.dumps(blob, separators=(",", ":"))
    acc.has_session = True
    acc.last_login = time.time()
    await db.commit()


# ---------------- health ----------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "modern-sda-web", "version": app.version}


# ---------------- auth ----------------
@app.post("/api/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    rate_limit(f"register:{client_ip(request)}", limit=10, window=3600)
    email = req.email.strip().lower()
    if await get_user_by_email(db, email):
        raise HTTPException(status_code=409, detail="Email already registered")
    pw_salt = vault.new_salt()
    enc_salt = vault.new_salt()
    user = User(
        email=email,
        password_hash=vault.hash_password(req.password, pw_salt),
        password_salt=pw_salt,
        enc_salt=enc_salt,
    )
    db.add(user)
    await db.commit()
    token, sid = issue_token(user.id)
    cache_user_key(sid, vault.derive_key(req.password, enc_salt))
    return AuthResponse(token=token, email=user.email, user_id=user.id)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    rate_limit(f"login:{client_ip(request)}", limit=15, window=900)
    user = await get_user_by_email(db, req.email.strip().lower())
    if not user or not vault.verify_password(req.password, user.password_salt, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token, sid = issue_token(user.id)
    cache_user_key(sid, vault.derive_key(req.password, user.enc_salt))
    return AuthResponse(token=token, email=user.email, user_id=user.id)


@app.get("/api/auth/me")
async def me(principal: Principal = Depends(current_principal)):
    return {"email": principal.user.email, "user_id": principal.user.id, "unlocked": principal.user_key is not None}


@app.post("/api/auth/logout")
async def logout(principal: Principal = Depends(current_principal)):
    clear_session(principal.sid)
    return {"ok": True}


# ---------------- accounts ----------------
@app.get("/api/accounts", response_model=list[AccountWithCode])
async def list_accounts(
    principal: Principal = Depends(current_principal), db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(SteamAccount)
        .where(SteamAccount.user_id == principal.user.id)
        .order_by(SteamAccount.favorite.desc(), SteamAccount.sort_index, SteamAccount.created_at)
    )
    accounts = res.scalars().all()
    out = []
    for a in accounts:
        secrets = _server_secrets(a)
        code = steam_guard.generate_code(secrets["shared_secret"]) if secrets.get("shared_secret") else "•••••"
        out.append({**_account_out(a), "code": code, "codeExpiresIn": steam_guard.seconds_remaining()})
    return out


@app.get("/api/accounts/codes", response_model=list[CodeOut])
async def list_codes(
    principal: Principal = Depends(current_principal), db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(SteamAccount).where(SteamAccount.user_id == principal.user.id))
    rem = steam_guard.seconds_remaining()
    out = []
    for a in res.scalars().all():
        secrets = _server_secrets(a)
        code = steam_guard.generate_code(secrets["shared_secret"]) if secrets.get("shared_secret") else "•••••"
        out.append({"id": a.id, "code": code, "codeExpiresIn": rem})
    return out


@app.post("/api/accounts/refresh-profiles", response_model=list[AccountOut])
async def refresh_profiles(
    principal: Principal = Depends(current_principal), db: AsyncSession = Depends(get_db)
):
    """Backfill missing Steam avatars for the user's accounts (best-effort)."""
    res = await db.execute(select(SteamAccount).where(SteamAccount.user_id == principal.user.id))
    accounts = list(res.scalars().all())
    pending = [a for a in accounts if not a.avatar_url and a.steam_id]
    if pending:
        fetched = await asyncio.gather(
            *[steam.fetch_avatar(a.steam_id, a.proxy) for a in pending], return_exceptions=True
        )
        for acc, url in zip(pending, fetched):
            if isinstance(url, str) and url:
                acc.avatar_url = url
        await db.commit()
    return [_account_out(a) for a in accounts]


@app.post("/api/accounts", response_model=AccountOut)
async def add_account(
    req: AddAccountRequest,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    user_key = principal.user_key
    if user_key is None:
        raise HTTPException(status_code=401, detail="Session locked — please sign in again")
    if not steam_guard.is_valid_secret(req.shared_secret):
        raise HTTPException(status_code=400, detail="Invalid shared_secret")
    steam_id_in = req.steamId.strip()
    if steam_id_in and not steam_id_in.isdigit():
        raise HTTPException(status_code=400, detail="SteamID must be numeric")
    if req.proxy and not req.proxy.strip().startswith(("http://", "https://", "socks")):
        raise HTTPException(status_code=400, detail="Proxy must be an http(s)/socks URL")

    name = (req.name or req.account_name or (f"Account {steam_id_in[-4:]}" if steam_id_in else "New Account")).strip()
    fields = {
        "shared_secret": req.shared_secret.strip(),
        "identity_secret": (req.identity_secret or "").strip() or None,
        "account_name": (req.account_name or "").strip() or None,
        "password": req.password or None,
        "refresh_token": req.refresh_token or None,
    }
    steam_id = (steam.steamid_from_jwt(req.refresh_token) or steam_id_in).strip()
    acc = SteamAccount(
        user_id=principal.user.id,
        name=name,
        steam_id=steam_id,
        avatar_color=_avatar_color(name + steam_id),
        avatar_url=await steam.fetch_avatar(steam_id, req.proxy),
        proxy=(req.proxy or None),
        has_identity=bool(fields["identity_secret"]),
        has_session=bool(fields["refresh_token"]),
        status="online" if fields["refresh_token"] else ("needs_login" if not fields["identity_secret"] else "offline"),
        secrets_blob=vault.encrypt_secrets(fields, user_key),
    )
    db.add(acc)
    await db.commit()
    return _account_out(acc)


@app.patch("/api/accounts/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: str,
    req: UpdateAccountRequest,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    acc = await _get_owned_account(db, principal, account_id)
    if req.name is not None:
        acc.name = req.name.strip() or acc.name
    if req.proxy is not None:
        proxy = req.proxy.strip()
        if proxy and not proxy.startswith(("http://", "https://", "socks")):
            raise HTTPException(status_code=400, detail="Proxy must be an http(s)/socks URL")
        acc.proxy = proxy or None
    if req.favorite is not None:
        acc.favorite = req.favorite
    await db.commit()
    return _account_out(acc)


@app.delete("/api/accounts/{account_id}")
async def delete_account(
    account_id: str,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    acc = await _get_owned_account(db, principal, account_id)
    await db.delete(acc)
    await db.commit()
    return {"ok": True}


@app.post("/api/accounts/{account_id}/reveal")
async def reveal_secrets(
    account_id: str,
    req: RevealRequest,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    """Decrypt secrets using the OWNER's password (proves user-side decryption)."""
    acc = await _get_owned_account(db, principal, account_id)
    if not vault.verify_password(req.password, principal.user.password_salt, principal.user.password_hash):
        raise HTTPException(status_code=403, detail="Incorrect password")
    user_key = vault.derive_key(req.password, principal.user.enc_salt)
    try:
        secrets = vault.decrypt_with_user(acc.secrets_blob, user_key)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Could not decrypt with user key") from exc
    # Never return the password back.
    secrets.pop("password", None)
    return {"secrets": secrets}


# ---------------- steam session ----------------
@app.post("/api/accounts/{account_id}/steam-login")
async def steam_login(
    account_id: str,
    req: SteamLoginRequest,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    """Log in to Steam (password + shared_secret) to obtain a refresh token."""
    user_key = principal.user_key
    if user_key is None:
        raise HTTPException(status_code=401, detail="Session locked — please sign in again")
    acc = await _get_owned_account(db, principal, account_id)
    secrets = _server_secrets(acc)
    if req.password:
        secrets["password"] = req.password
    if not secrets.get("password"):
        raise HTTPException(status_code=400, detail="Steam password required")
    try:
        refresh = await steam.login_for_refresh_token(secrets, acc.steam_id, acc.proxy)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Steam login failed: {exc}") from exc

    # Only persist the password if the user asked us to remember it.
    updates: dict[str, str | None] = {"refresh_token": refresh}
    updates["password"] = (req.password or secrets.get("password")) if req.remember else None
    acc.secrets_blob = vault.reseal_secrets(acc.secrets_blob, updates, user_key)

    # Correct the stored steamid to match the account we actually logged into.
    real_steam_id = steam.steamid_from_jwt(refresh)
    if real_steam_id:
        acc.steam_id = real_steam_id
        acc.avatar_url = (await steam.fetch_avatar(real_steam_id, acc.proxy)) or acc.avatar_url
    acc.has_session = True
    acc.status = "online"
    acc.last_login = time.time()
    await db.commit()
    return _account_out(acc)


# ---------------- confirmations ----------------
@app.get("/api/accounts/{account_id}/confirmations")
async def account_confirmations(
    account_id: str,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    acc = await _get_owned_account(db, principal, account_id)
    secrets = _server_secrets(acc)
    _sync_steam_id(acc, secrets)
    try:
        items, new_refresh = await steam.list_confirmations(acc.id, secrets, acc.steam_id, acc.proxy)
    except steam.SteamServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Steam error: {exc}") from exc
    await _persist_new_refresh(db, acc, new_refresh)
    await db.commit()
    return {"confirmations": items}


@app.get("/api/confirmations")
async def all_confirmations(
    principal: Principal = Depends(current_principal), db: AsyncSession = Depends(get_db)
):
    """Aggregate live confirmations across all of the user's session-ready accounts."""
    res = await db.execute(
        select(SteamAccount).where(
            SteamAccount.user_id == principal.user.id, SteamAccount.has_session == True  # noqa: E712
        )
    )
    out: list[dict] = []
    errors: list[dict] = []
    for acc in res.scalars().all():
        secrets = _server_secrets(acc)
        _sync_steam_id(acc, secrets)
        try:
            items, new_refresh = await steam.list_confirmations(acc.id, secrets, acc.steam_id, acc.proxy)
            out.extend(items)
            await _persist_new_refresh(db, acc, new_refresh)
        except Exception as exc:  # noqa: BLE001
            errors.append({"accountId": acc.id, "error": str(exc)})
    await db.commit()
    return {"confirmations": out, "errors": errors}


@app.post("/api/accounts/{account_id}/confirmations/{confirmation_id}")
async def act_confirmation(
    account_id: str,
    confirmation_id: str,
    req: ActRequest,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    acc = await _get_owned_account(db, principal, account_id)
    secrets = _server_secrets(acc)
    try:
        ok, new_refresh = await steam.act_on_confirmation(
            secrets, acc.steam_id, acc.proxy, confirmation_id, req.action, req.nonce
        )
    except steam.SteamServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Steam error: {exc}") from exc
    acc.last_confirmation = time.time()
    await _persist_new_refresh(db, acc, new_refresh)
    await db.commit()
    return {"success": ok}


@app.post("/api/accounts/{account_id}/confirmations-accept-all")
async def accept_all_confirmations(
    account_id: str,
    type_filter: str | None = None,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    acc = await _get_owned_account(db, principal, account_id)
    secrets = _server_secrets(acc)
    try:
        count, new_refresh = await steam.accept_all(secrets, acc.steam_id, acc.proxy, type_filter)
    except steam.SteamServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Steam error: {exc}") from exc
    acc.last_confirmation = time.time()
    await _persist_new_refresh(db, acc, new_refresh)
    await db.commit()
    return {"accepted": count}


# ---------------- QR login approval ----------------
@app.post("/api/accounts/{account_id}/qr-approve")
async def qr_approve(
    account_id: str,
    req: QrApproveRequest,
    principal: Principal = Depends(current_principal),
    db: AsyncSession = Depends(get_db),
):
    acc = await _get_owned_account(db, principal, account_id)
    secrets = _server_secrets(acc)
    try:
        result = await steam.approve_qr_login(secrets, acc.steam_id, acc.proxy, req.challenge_url, req.confirm)
    except steam.SteamServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Steam error: {exc}") from exc
    await _persist_new_refresh(db, acc, result.pop("new_refresh", None))
    return result
