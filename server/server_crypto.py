"""Application-layer encrypted channel.

The server holds an RSA keypair. For each request the client generates a random
session key, RSA-OAEP-encrypts it under the server public key (sent in a header),
and AES-256-GCM-encrypts the request body under that session key. The server
decrypts the body and encrypts the response with the same per-request key.

This gives confidentiality for request/response bodies (passwords, secrets,
codes) independently of the transport — defence in depth on top of TLS.
"""
from __future__ import annotations

import os
from base64 import b64decode, b64encode
from functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import DATA_DIR

_PRIVATE_KEY_FILE = DATA_DIR / ".dev_rsa_private.pem"


@lru_cache
def _private_key() -> rsa.RSAPrivateKey:
    """Load or generate the server RSA private key (persisted for dev)."""
    env_pem = os.getenv("RSA_PRIVATE_KEY_PEM")
    if env_pem:
        return serialization.load_pem_private_key(env_pem.encode(), password=None)
    if _PRIVATE_KEY_FILE.exists():
        return serialization.load_pem_private_key(_PRIVATE_KEY_FILE.read_bytes(), password=None)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    _PRIVATE_KEY_FILE.write_bytes(pem)
    _PRIVATE_KEY_FILE.chmod(0o600)
    return key


def public_key_pem() -> str:
    pub = _private_key().public_key()
    return pub.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")


_OAEP = padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)


def unwrap_session_key(wrapped_b64: str) -> bytes:
    """RSA-OAEP-decrypt a base64 session key delivered in the X-Session-Key header."""
    return _private_key().decrypt(b64decode(wrapped_b64), _OAEP)


def aes_decrypt(session_key: bytes, payload: dict) -> bytes:
    raw = b64decode(payload["iv"]) + b64decode(payload["ct"])
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(session_key).decrypt(nonce, ct, None)


def aes_encrypt(session_key: bytes, plaintext: bytes) -> dict:
    nonce = os.urandom(12)
    ct = AESGCM(session_key).encrypt(nonce, plaintext, None)
    return {"iv": b64encode(nonce).decode("ascii"), "ct": b64encode(ct).decode("ascii")}
