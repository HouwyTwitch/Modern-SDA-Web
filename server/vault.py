"""Envelope encryption for Steam account secrets.

Threat model / property: each account's secrets are sealed so they can be
decrypted **only** by (a) the server, using its master key, or (b) the account
owner, using a key derived from their password. Nobody with just the database
can read them.

Scheme (per account):
  - DEK: random 256-bit data-encryption key.
  - Each secret value is AES-256-GCM encrypted under the DEK.
  - The DEK itself is wrapped twice: once under the server master key, once
    under the user's password-derived key. Either wrap recovers the DEK.

This means routine server work (live confirmations, code generation) uses the
server-wrapped DEK, while the owner can independently decrypt with their
password via the user-wrapped DEK.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from base64 import b64decode, b64encode

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import get_settings

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LEN = 32

SECRET_FIELDS = ("shared_secret", "identity_secret", "refresh_token", "password", "account_name")


# ---------------- key derivation + password hashing ----------------
def new_salt() -> str:
    return os.urandom(16).hex()


def derive_key(password: str, salt_hex: str) -> bytes:
    """Derive a 32-byte key from a password (scrypt, stdlib)."""
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=bytes.fromhex(salt_hex),
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=KEY_LEN,
        maxmem=64 * 1024 * 1024,
    )


def hash_password(password: str, salt_hex: str) -> str:
    return derive_key(password, salt_hex).hex()


def verify_password(password: str, salt_hex: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt_hex), expected_hash)


# ---------------- low-level AES-GCM helpers ----------------
def _seal(key: bytes, plaintext: bytes) -> str:
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext, None)
    return b64encode(nonce + ct).decode("ascii")


def _open(key: bytes, token: str) -> bytes:
    raw = b64decode(token)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(key).decrypt(nonce, ct, None)


# ---------------- public API ----------------
def encrypt_secrets(fields: dict[str, str | None], user_key: bytes) -> str:
    """Seal a dict of secret fields into a JSON envelope string."""
    server_key = get_settings().server_master_key
    dek = os.urandom(KEY_LEN)
    sealed_fields = {
        k: _seal(dek, v.encode("utf-8")) for k, v in fields.items() if v is not None and v != ""
    }
    blob = {
        "v": 1,
        "dek_srv": _seal(server_key, dek),
        "dek_usr": _seal(user_key, dek),
        "fields": sealed_fields,
    }
    return json.dumps(blob, separators=(",", ":"))


def _decrypt_with_dek(blob_str: str, dek: bytes) -> dict[str, str]:
    blob = json.loads(blob_str)
    return {k: _open(dek, v).decode("utf-8") for k, v in blob.get("fields", {}).items()}


def decrypt_with_server(blob_str: str) -> dict[str, str]:
    """Decrypt secrets using the server master key (for server-side operations)."""
    blob = json.loads(blob_str)
    dek = _open(get_settings().server_master_key, blob["dek_srv"])
    return _decrypt_with_dek(blob_str, dek)


def decrypt_with_user(blob_str: str, user_key: bytes) -> dict[str, str]:
    """Decrypt secrets using the owner's password-derived key."""
    blob = json.loads(blob_str)
    dek = _open(user_key, blob["dek_usr"])
    return _decrypt_with_dek(blob_str, dek)


def reseal_secrets(blob_str: str, updates: dict[str, str | None], user_key: bytes) -> str:
    """Merge updates into an existing envelope, re-encrypting with a fresh DEK."""
    current = decrypt_with_server(blob_str)
    current.update({k: v for k, v in updates.items()})
    # Drop keys explicitly set to None.
    merged = {k: v for k, v in current.items() if v is not None and v != ""}
    return encrypt_secrets(merged, user_key)
