"""Steam Guard code + confirmation key generation (server-side mirror of the
browser implementation). Pure standard library."""
from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time

CODE_ALPHABET = "23456789BCDFGHJKMNPQRTVWXY"
CODE_PERIOD = 30


def generate_code(shared_secret: str, at: float | None = None) -> str:
    """Return the 5-character Steam Guard code for a base64 shared secret."""
    if at is None:
        at = time.time()
    key = base64.b64decode(shared_secret)
    counter = int(at // CODE_PERIOD)
    msg = struct.pack(">Q", counter)
    mac = hmac.new(key, msg, hashlib.sha1).digest()

    start = mac[19] & 0x0F
    code_point = (
        ((mac[start] & 0x7F) << 24)
        | ((mac[start + 1] & 0xFF) << 16)
        | ((mac[start + 2] & 0xFF) << 8)
        | (mac[start + 3] & 0xFF)
    )

    code = ""
    for _ in range(5):
        code += CODE_ALPHABET[code_point % len(CODE_ALPHABET)]
        code_point //= len(CODE_ALPHABET)
    return code


def seconds_remaining(at: float | None = None) -> int:
    if at is None:
        at = time.time()
    return CODE_PERIOD - int(at) % CODE_PERIOD


def confirmation_key(identity_secret: str, tag: str, at: float | None = None) -> str:
    """Generate the base64 confirmation key used to sign mobileconf requests."""
    if at is None:
        at = time.time()
    key = base64.b64decode(identity_secret)
    msg = struct.pack(">Q", int(at)) + tag.encode("ascii")
    mac = hmac.new(key, msg, hashlib.sha1).digest()
    return base64.b64encode(mac).decode("ascii")


def device_id(steamid: str) -> str:
    """Derive the Steam mobile device id from a steamid (android:<uuid> form)."""
    h = hashlib.sha1(steamid.encode("ascii")).hexdigest()
    return f"android:{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def is_valid_secret(secret: str) -> bool:
    """True if `secret` is base64 decoding to at least 16 bytes."""
    try:
        return len(base64.b64decode(secret, validate=True)) >= 16
    except Exception:
        return False
