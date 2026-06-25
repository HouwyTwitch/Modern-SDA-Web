"""Steam mobile confirmation client.

Talks to Steam's `mobileconf` endpoints to list and act on pending trade/market
confirmations. This lives server-side because the browser cannot call
steamcommunity.com directly (CORS) and we don't want to relay session cookies
through third parties.

Authentication: pass either a `steamLoginSecure` cookie value (recommended) or
an OAuth access token, plus the account's `identity_secret`. These come from a
completed Steam login on the client.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import httpx

from steam_guard import confirmation_key, device_id as derive_device_id

COMMUNITY = "https://steamcommunity.com"
USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
)


@dataclass
class Session:
    steamid: str
    identity_secret: str
    steam_login_secure: str
    device_id: str | None = None
    session_id: str = field(default_factory=lambda: "")

    def resolved_device_id(self) -> str:
        return self.device_id or derive_device_id(self.steamid)


class SteamAuthError(Exception):
    pass


def _params(session: Session, tag: str) -> dict[str, str]:
    now = int(time.time())
    return {
        "p": session.resolved_device_id(),
        "a": session.steamid,
        "k": confirmation_key(session.identity_secret, tag, now),
        "t": str(now),
        "m": "react",
        "tag": tag,
    }


def _cookies(session: Session) -> dict[str, str]:
    return {
        "steamLoginSecure": session.steam_login_secure,
        "sessionid": session.session_id or "0",
        "mobileClient": "android",
        "mobileClientVersion": "777777 3.0.0",
    }


async def list_confirmations(session: Session) -> list[dict]:
    """Return the account's pending confirmations as plain dicts."""
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        resp = await client.get(
            f"{COMMUNITY}/mobileconf/getlist",
            params=_params(session, "conf"),
            cookies=_cookies(session),
        )
    if resp.status_code != 200:
        raise SteamAuthError(f"Steam returned HTTP {resp.status_code}")

    data = resp.json()
    if not data.get("success"):
        raise SteamAuthError(data.get("message") or "Steam rejected the request (session expired?)")

    out: list[dict] = []
    for c in data.get("conf", []):
        type_name = (c.get("type_name") or "").lower()
        if "trade" in type_name:
            ctype = "trade"
        elif "market" in type_name:
            ctype = "market"
        else:
            ctype = "other"
        out.append(
            {
                "id": str(c.get("id")),
                "nonce": str(c.get("nonce")),
                "type": ctype,
                "title": c.get("headline") or c.get("type_name") or "Confirmation",
                "subtitle": " · ".join(c.get("summary", [])) if c.get("summary") else "",
                "amount": None,
                "createdAt": int(c.get("creation_time", time.time())) * 1000,
                "iconUrls": [c["icon"]] if c.get("icon") else [],
            }
        )
    return out


async def act_on_confirmation(
    session: Session, confirmation_id: str, nonce: str, action: str
) -> bool:
    """Approve ('allow') or decline ('cancel') a single confirmation."""
    if action not in ("allow", "cancel"):
        raise ValueError("action must be 'allow' or 'cancel'")

    params = _params(session, action)
    params.update({"op": action, "cid": confirmation_id, "ck": nonce})

    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        resp = await client.get(
            f"{COMMUNITY}/mobileconf/ajaxop",
            params=params,
            cookies=_cookies(session),
        )
    if resp.status_code != 200:
        raise SteamAuthError(f"Steam returned HTTP {resp.status_code}")
    return bool(resp.json().get("success"))
