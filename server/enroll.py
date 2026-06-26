"""Create a new Steam mobile authenticator (enroll Steam Guard), producing a
.maFile. Logic follows geel9/SteamAuth's AuthenticatorLinker.

Flow:
  1. begin_login(username, password)  -> Steam emails a guard code (usually)
  2. submit_email_code(code)          -> obtains an access token
  3. add_authenticator()              -> Steam texts an SMS code to the phone
  4. finalize(sms_code)               -> activates it, returns the maFile

The credentials login (RSA + protobuf begin/poll) is reused from aiosteampy so
we don't reimplement it; the ITwoFactorService calls are done directly. The
account being enrolled must already have a phone number attached (Steam requires
it for a mobile authenticator).

Pending enrollments hold a live Steam session in memory until finalized; nothing
is persisted here.
"""
from __future__ import annotations

import asyncio
import base64
import time
import uuid
from base64 import b64encode

import httpx
from aiosteampy import SteamClient, auth_pb2
from aiosteampy.constants import STEAM_URL
from rsa import encrypt as rsa_encrypt

import steam_guard

# EAuthSessionGuardType values we care about.
_GUARD_EMAIL_CODE = 2
_GUARD_DEVICE_CODE = 3
_GUARD_DEVICE_CONFIRM = 4
_GUARD_EMAIL_CONFIRM = 5
_REFERER = {"Referer": str(STEAM_URL.COMMUNITY) + "/"}

API = "https://api.steampowered.com"
MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
)
PENDING_TTL = 600  # seconds
_DUMMY_SECRET = base64.b64encode(bytes(20)).decode()  # never used; satisfies the ctor


class EnrollError(Exception):
    pass


class _Pending:
    def __init__(self, client: SteamClient, device_id: str, owner: str):
        self.client = client
        self.device_id = device_id
        self.owner = owner
        self.client_id: str | int | None = None
        self.request_id: str | bytes | None = None
        self.steamid: str = ""
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self.add_response: dict | None = None
        self.created = time.time()


_pending: dict[str, _Pending] = {}


def gen_device_id() -> str:
    return "android:" + str(uuid.uuid4())


def _gc() -> None:
    now = time.time()
    for key in [k for k, v in _pending.items() if now - v.created > PENDING_TTL]:
        p = _pending.pop(key, None)
        if p:
            asyncio.ensure_future(_safe_close(p.client))


async def _safe_close(client: SteamClient) -> None:
    try:
        await client.session.close()
    except Exception:
        pass


def _get(enroll_id: str, owner: str) -> _Pending:
    p = _pending.get(enroll_id)
    if not p or p.owner != owner:
        raise EnrollError("Enrollment session expired — please start again.")
    return p


async def discard(enroll_id: str, owner: str) -> None:
    p = _pending.get(enroll_id)
    if p and p.owner == owner:
        _pending.pop(enroll_id, None)
        await _safe_close(p.client)


# ---------------- step 1: credentials login ----------------
async def _begin_session(client: SteamClient) -> dict:
    """Begin a credentials auth session using the MobileApp platform (the
    authenticator flow), parsing the full response incl. allowed_confirmations."""
    pub_key, ts = await client._get_rsa_key()

    device_details = auth_pb2.CAuthentication_BeginAuthSessionViaCredentials_Request.DeviceDetails()
    device_details.device_friendly_name = "Modern SDA Web"
    device_details.platform_type = auth_pb2.k_EAuthTokenPlatformType_MobileApp

    req = auth_pb2.CAuthentication_BeginAuthSessionViaCredentials_Request()
    req.account_name = client.username
    req.encrypted_password = b64encode(rsa_encrypt(client._password.encode("utf-8"), pub_key)).decode()
    req.encryption_timestamp = ts
    req.remember_login = 1
    req.persistence = 1
    req.website_id = "Mobile"
    req.device_details.CopyFrom(device_details)
    req.additional_field = 8

    r = await client.session.post(
        STEAM_URL.API.IAuthService.BeginAuthSessionViaCredentials,
        data={"input_protobuf_encoded": b64encode(req.SerializeToString()).decode()},
        headers=_REFERER,
    )
    resp = auth_pb2.CAuthentication_BeginAuthSessionViaCredentials_Response()
    resp.ParseFromString(await r.read())
    return {
        "client_id": resp.client_id,
        "request_id": resp.request_id,
        "steamid": str(resp.steamid),
        "guards": [c.confirmation_type for c in resp.allowed_confirmations],
    }


async def begin_login(username: str, password: str, owner: str) -> tuple[str, str]:
    """Start a credentials login. Returns (enroll_id, next_step):
      - 'email_code' : Steam emailed a code to enter
      - 'confirm'    : approve via the email link or the Steam app, then continue
      - 'ready'      : no guard — continue immediately
    """
    _gc()
    client = SteamClient(0, username, password, _DUMMY_SECRET, user_agent=MOBILE_UA)
    try:
        await client.session.get("https://steamcommunity.com")
        data = await _begin_session(client)
    except Exception as exc:  # noqa: BLE001
        await _safe_close(client)
        raise EnrollError(f"Could not start Steam login: {exc}") from exc

    if not data["client_id"]:
        await _safe_close(client)
        raise EnrollError("Steam rejected the username/password.")

    guards = data["guards"]
    if _GUARD_DEVICE_CODE in guards:
        await _safe_close(client)
        raise EnrollError("This account already has a mobile authenticator.")

    p = _Pending(client, gen_device_id(), owner)
    p.client_id = data["client_id"]
    p.request_id = data["request_id"]
    p.steamid = data["steamid"]
    enroll_id = str(uuid.uuid4())
    _pending[enroll_id] = p

    if _GUARD_EMAIL_CODE in guards:
        return enroll_id, "email_code"
    if _GUARD_EMAIL_CONFIRM in guards or _GUARD_DEVICE_CONFIRM in guards:
        return enroll_id, "confirm"
    return enroll_id, "ready"


# ---------------- step 2: obtain access token ----------------
async def obtain_token(enroll_id: str, owner: str, email_code: str | None = None) -> None:
    """Submit the email code (if any) and poll for the access token. For the
    'confirm' flow the user must approve the email link / Steam app first."""
    p = _get(enroll_id, owner)
    try:
        if email_code:
            await p.client.session.post(
                STEAM_URL.API.IAuthService.UpdateAuthSessionWithSteamGuardCode,
                data={"client_id": p.client_id, "steamid": p.steamid, "code_type": 2, "code": email_code.strip()},
                headers=_REFERER,
            )
        access, refresh = await p.client._poll_auth_session_status(p.client_id, p.request_id)
    except Exception as exc:  # noqa: BLE001
        raise EnrollError(
            "Login not confirmed yet — approve it (email link / Steam app) or check the code, then retry."
            if not email_code
            else f"Login failed — wrong code? ({exc})"
        ) from exc
    if not access:
        raise EnrollError(
            "Login not confirmed yet — approve the email/app prompt, then continue."
            if not email_code
            else "Login failed — the code may be incorrect or expired."
        )
    p.access_token, p.refresh_token = access, refresh


# ---------------- step 3: add authenticator ----------------
async def add_authenticator(enroll_id: str, owner: str) -> dict:
    """Request a new authenticator. Steam sends an SMS to the account's phone.
    Returns minimal info (account name + revocation code) to show the user."""
    p = _get(enroll_id, owner)
    if not p.access_token:
        raise EnrollError("Not signed in yet.")
    try:
        async with httpx.AsyncClient(timeout=25, headers={"User-Agent": MOBILE_UA}) as c:
            r = await c.post(
                f"{API}/ITwoFactorService/AddAuthenticator/v1/?access_token={p.access_token}",
                data={
                    "steamid": p.steamid,
                    "authenticator_type": "1",
                    "device_identifier": p.device_id,
                    "sms_phone_id": "1",
                    "version": "2",
                },
            )
        resp = r.json().get("response")
    except Exception as exc:  # noqa: BLE001
        raise EnrollError(f"Steam error while adding authenticator: {exc}") from exc

    if not resp:
        raise EnrollError("Steam returned an empty response.")
    status = resp.get("status")
    if status == 2:
        raise EnrollError("This account has no phone number. Add a phone in Steam first, then retry.")
    if status == 29:
        raise EnrollError("This account already has an authenticator.")
    if status != 1:
        raise EnrollError(f"Steam rejected enrollment (status {status}).")

    p.add_response = resp
    return {"accountName": resp.get("account_name"), "revocationCode": resp.get("revocation_code")}


# ---------------- step 4: finalize ----------------
async def _steam_time_offset() -> int:
    try:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": MOBILE_UA}) as c:
            r = await c.post(f"{API}/ITwoFactorService/QueryTime/v0001/")
        return int(r.json()["response"]["server_time"]) - int(time.time())
    except Exception:
        return 0


async def finalize(enroll_id: str, sms_code: str, owner: str) -> dict:
    """Activate the authenticator with the SMS code. Returns the maFile dict."""
    p = _get(enroll_id, owner)
    if not p.add_response:
        raise EnrollError("Add the authenticator first.")
    shared = p.add_response["shared_secret"]
    offset = await _steam_time_offset()

    tries = 0
    while tries <= 5:
        t = int(time.time()) + offset
        code = steam_guard.generate_code(shared, t)
        try:
            async with httpx.AsyncClient(timeout=25, headers={"User-Agent": MOBILE_UA}) as c:
                r = await c.post(
                    f"{API}/ITwoFactorService/FinalizeAddAuthenticator/v1/?access_token={p.access_token}",
                    data={
                        "steamid": p.steamid,
                        "authenticator_code": code,
                        "authenticator_time": str(t),
                        "activation_code": sms_code.strip(),
                        "validate_sms_code": "1",
                    },
                )
            resp = r.json().get("response")
        except Exception as exc:  # noqa: BLE001
            raise EnrollError(f"Steam error during finalize: {exc}") from exc

        if not resp:
            raise EnrollError("Steam returned an empty response.")
        if resp.get("status") == 89:
            raise EnrollError("Incorrect SMS code.")
        if not resp.get("success"):
            if resp.get("status") == 88 and tries >= 5:
                raise EnrollError("Could not sync codes — please try enrolling again.")
            tries += 1
            await asyncio.sleep(1)
            continue
        if resp.get("want_more"):
            # Steam wants the next code; wait for the next 30s window.
            tries += 1
            await asyncio.sleep(max(1, 31 - (t % 30)))
            continue

        mafile = _build_mafile(p)
        _pending.pop(enroll_id, None)
        await _safe_close(p.client)
        return mafile

    raise EnrollError("Enrollment failed — please try again.")


def _build_mafile(p: _Pending) -> dict:
    m = p.add_response or {}
    return {
        "shared_secret": m.get("shared_secret"),
        "serial_number": m.get("serial_number"),
        "revocation_code": m.get("revocation_code"),
        "uri": m.get("uri"),
        "server_time": m.get("server_time"),
        "account_name": m.get("account_name"),
        "token_gid": m.get("token_gid"),
        "identity_secret": m.get("identity_secret"),
        "secret_1": m.get("secret_1"),
        "status": m.get("status"),
        "device_id": p.device_id,
        "fully_enrolled": True,
        "Session": {
            "SteamID": int(p.steamid) if p.steamid.isdigit() else 0,
            "AccessToken": p.access_token,
            "RefreshToken": p.refresh_token,
            "SessionID": "",
            "WebCookie": None,
            "OAuthToken": None,
        },
    }
