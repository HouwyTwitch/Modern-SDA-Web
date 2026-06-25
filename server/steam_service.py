"""Steam integration: live sessions, confirmations, and QR-login approval.

Uses `aiosteampy` (the same library as the desktop Modern-SDA) for the new Steam
auth system (refresh tokens) and confirmation handling. QR-login approval mirrors
Modern-SDA's `approve_qr_login`: it signs the QR challenge with the account's
shared secret and posts to UpdateAuthSessionWithMobileConfirmation.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime
from types import SimpleNamespace
from urllib.parse import unquote

import httpx
from aiohttp import ClientSession
from aiosteampy import Confirmation, ConfirmationType, SteamClient

STEAM_API = "https://api.steampowered.com"


def steamid_from_jwt(token: str | None) -> str | None:
    """Extract the steamid (`sub`) from a Steam refresh/access token, unverified."""
    if not token:
        return None
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        sub = str(data.get("sub", ""))
        return sub or None
    except Exception:
        return None


def resolve_steam_id(secrets: dict, fallback: str) -> str:
    """Prefer the steamid embedded in the refresh token over the stored one, so a
    session always matches the account it was issued for."""
    return steamid_from_jwt(secrets.get("refresh_token")) or fallback


async def fetch_avatar(steam_id: str, proxy: str | None = None) -> str | None:
    """Best-effort fetch of an account's public Steam avatar URL."""
    if not steam_id:
        return None
    proxy = proxy if (proxy and proxy.startswith("http")) else None
    try:
        async with httpx.AsyncClient(
            timeout=8,
            follow_redirects=True,
            proxy=proxy,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ModernSDA/2)"},
        ) as c:
            r = await c.get(f"https://steamcommunity.com/profiles/{steam_id}?xml=1")
        m = re.search(r"<avatarFull>\s*<!\[CDATA\[(.*?)\]\]>\s*</avatarFull>", r.text, re.DOTALL)
        if not m:
            return None
        return m.group(1).strip().replace("http://", "https://")
    except Exception:
        return None

_TYPE_MAP = {
    ConfirmationType.TRADE: "trade",
    ConfirmationType.LISTING: "market",
    ConfirmationType.PURCHASE: "market",
}


class SteamServiceError(Exception):
    pass


def _client(secrets: dict, steam_id: str, proxy: str | None) -> SteamClient:
    if not secrets.get("shared_secret"):
        raise SteamServiceError("Account has no shared_secret")
    # Use the steamid the refresh token was issued for when available — this
    # avoids "token belongs to a different account" errors from a stale steamid.
    steam_id = resolve_steam_id(secrets, steam_id)
    if not steam_id:
        raise SteamServiceError("Unknown steamid for this account")
    return SteamClient(
        steam_id=int(steam_id),
        username=secrets.get("account_name") or "user",
        password=secrets.get("password") or "",
        shared_secret=secrets["shared_secret"],
        identity_secret=secrets.get("identity_secret"),
        refresh_token=secrets.get("refresh_token"),
        proxy=proxy or None,
    )


@asynccontextmanager
async def _session(secrets: dict, steam_id: str, proxy: str | None):
    """Yield a logged-in SteamClient, refreshing or logging in as needed.

    Yields (client, new_refresh_token | None) — the second value is set when a
    fresh refresh token was obtained and should be persisted.
    """
    client = _client(secrets, steam_id, proxy)
    new_refresh: str | None = None
    try:
        if secrets.get("refresh_token") and not client.is_refresh_token_expired:
            await client.session.get("https://steamcommunity.com")
            await client.refresh_access_token()
        elif secrets.get("password"):
            await client.login()
            new_refresh = client.refresh_token
        else:
            raise SteamServiceError("No valid session — sign in to Steam first")
        yield client, new_refresh
    finally:
        await client.session.close()


def _to_epoch_ms(value) -> int:
    """Normalise aiosteampy's creation_time (datetime | int | None) to epoch ms."""
    if isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    if isinstance(value, (int, float)):
        return int(value * 1000)
    return int(time.time() * 1000)


def _summary_text(value) -> str:
    # aiosteampy's `summary` is a plain string; guard against list just in case.
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return " · ".join(str(v) for v in value)
    return ""


def _to_dict(account_id: str, c: Confirmation) -> dict:
    summary = _summary_text(getattr(c, "summary", None))
    return {
        "id": str(c.id),
        "nonce": str(c.nonce),
        "accountId": account_id,
        "type": _TYPE_MAP.get(c.type, "other"),
        "title": c.headline or (c.type.name.title() if c.type else "Confirmation"),
        "subtitle": summary,
        "warn": getattr(c, "warn", None),
        "multi": bool(getattr(c, "multi", False)),
        "creatorId": str(getattr(c, "creator_id", "") or ""),
        "amount": None,
        "createdAt": _to_epoch_ms(getattr(c, "creation_time", None)),
        "iconUrls": [c.icon] if getattr(c, "icon", None) else [],
    }


async def login_for_refresh_token(secrets: dict, steam_id: str, proxy: str | None) -> str:
    """Full login (username+password+shared_secret) to obtain a refresh token."""
    client = _client(secrets, steam_id, proxy)
    try:
        await client.login()
        if not client.refresh_token:
            raise SteamServiceError("Login completed but no refresh token returned")
        return client.refresh_token
    finally:
        await client.session.close()


async def list_confirmations(account_id: str, secrets: dict, steam_id: str, proxy: str | None):
    async with _session(secrets, steam_id, proxy) as (client, new_refresh):
        confs = await client.get_confirmations()
        return [_to_dict(account_id, c) for c in confs], new_refresh


async def act_on_confirmation(
    secrets: dict,
    steam_id: str,
    proxy: str | None,
    confirmation_id: str,
    action: str,
    nonce: str | None = None,
):
    """Perform exactly one confirmation op: 'allow' approves, 'cancel' declines.

    When the nonce is known we send the op directly (a single request) instead of
    re-listing confirmations — so declining can only ever decline.
    """
    if action not in ("allow", "cancel"):
        raise SteamServiceError("action must be 'allow' or 'cancel'")
    async with _session(secrets, steam_id, proxy) as (client, new_refresh):
        if nonce:
            target = SimpleNamespace(id=int(confirmation_id), nonce=str(nonce))
        else:
            confs = await client.get_confirmations(update_listings=False)
            target = next((c for c in confs if str(c.id) == str(confirmation_id)), None)
            if not target:
                raise SteamServiceError("Confirmation not found (already handled?)")
        # send_confirmation only reads .id and .nonce; tag is the op verbatim.
        await client.send_confirmation(target, action)
        return True, new_refresh


async def accept_all(
    secrets: dict, steam_id: str, proxy: str | None, type_filter: str | None = None
):
    async with _session(secrets, steam_id, proxy) as (client, new_refresh):
        confs = await client.get_confirmations()
        if type_filter:
            wanted = "trade" if type_filter == "trade" else "market"
            confs = [c for c in confs if _TYPE_MAP.get(c.type, "other") == wanted]
        for c in confs:
            await client.allow_confirmation(c)
        return len(confs), new_refresh


# ---------------- QR login approval ----------------
def _extract_qr_client_id(url: str) -> int | None:
    try:
        decoded = unquote(url)
    except Exception:
        decoded = url
    patterns = (
        r"[?&](?:client_id|clientid)=([0-9]{5,})",
        r"(?:client_id|clientid)[:=]([0-9]{5,})",
        r"/q/\d+/([0-9]{5,})(?:[/?#]|$)",
        r"/qr/([0-9]{5,})(?:[/?#]|$)",
    )
    for pattern in patterns:
        m = re.search(pattern, decoded, re.IGNORECASE)
        if m:
            try:
                return int(m.group(1))
            except (ValueError, TypeError):
                continue
    return None


async def approve_qr_login(
    secrets: dict, steam_id: str, proxy: str | None, challenge_url: str, confirm: bool = True
) -> dict:
    """Approve (or deny) a Steam QR-code sign-in challenge using this account."""
    client_id = _extract_qr_client_id(challenge_url)
    if client_id is None:
        raise SteamServiceError("Could not find client_id in the QR URL")
    if not secrets.get("shared_secret"):
        raise SteamServiceError("Missing shared_secret")

    secret = base64.b64decode(secrets["shared_secret"])
    steam_id_int = int(resolve_steam_id(secrets, steam_id))
    payload = (
        (1).to_bytes(2, "little")
        + client_id.to_bytes(8, "little")
        + steam_id_int.to_bytes(8, "little")
    )
    signature = hmac.new(secret, payload, hashlib.sha256).digest()
    signature_b64 = base64.b64encode(signature).decode("ascii")

    # Need a valid access token to authorize the approval.
    async with _session(secrets, steam_id, proxy) as (client, new_refresh):
        access_token = client.access_token
        if not access_token:
            raise SteamServiceError("Account not authenticated")
        url = (
            f"{STEAM_API}/IAuthenticationService/UpdateAuthSessionWithMobileConfirmation/v1"
            f"?access_token={access_token}"
        )
        form = {
            "version": "1",
            "client_id": str(client_id),
            "steamid": str(steam_id_int),
            "signature": signature_b64,
            "confirm": "true" if confirm else "false",
            "persistence": "1",
        }
        kwargs = {"data": form}
        if proxy:
            kwargs["proxy"] = proxy
        async with ClientSession() as s:
            async with s.post(url, **kwargs) as resp:
                status_code = resp.status
                text = await resp.text()

    if status_code >= 400:
        raise SteamServiceError(f"Steam returned HTTP {status_code}")
    return {"success": True, "confirmed": confirm, "client_id": client_id, "new_refresh": new_refresh}
