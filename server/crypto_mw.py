"""Pure-ASGI middleware implementing the RSA-wrapped encrypted channel.

If a request carries an `X-Session-Key` header (RSA-OAEP-wrapped AES key), the
request body is decrypted and the response body is encrypted under the same
per-request key. Requests without the header pass through untouched (bootstrap,
health, and non-encrypting clients).
"""
from __future__ import annotations

import json

import server_crypto

_SKIP = {"/api/crypto/pubkey", "/api/health"}
MAX_BODY = 4 * 1024 * 1024  # 4 MB cap on encrypted request bodies


async def _send_json(send, status: int, obj: dict) -> None:
    body = json.dumps(obj).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class EncryptedChannelMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        wrapped = headers.get(b"x-session-key")
        if not wrapped or scope.get("path") in _SKIP:
            return await self.app(scope, receive, send)

        try:
            session_key = server_crypto.unwrap_session_key(wrapped.decode())
        except Exception:
            return await _send_json(send, 400, {"detail": "Bad session key"})

        # ---- decrypt request body (if encrypted) ----
        if headers.get(b"x-enc") == b"1":
            body = b""
            more = True
            while more:
                msg = await receive()
                body += msg.get("body", b"")
                if len(body) > MAX_BODY:
                    return await _send_json(send, 413, {"detail": "Request too large"})
                more = msg.get("more_body", False)
            try:
                plaintext = server_crypto.aes_decrypt(session_key, json.loads(body))
            except Exception:
                return await _send_json(send, 400, {"detail": "Could not decrypt request"})

            sent = False

            async def receive_decrypted():
                nonlocal sent
                if sent:
                    return {"type": "http.disconnect"}
                sent = True
                return {"type": "http.request", "body": plaintext, "more_body": False}

            inner_receive = receive_decrypted
        else:
            inner_receive = receive

        # ---- buffer + encrypt response body ----
        start: dict = {}
        chunks: list[bytes] = []

        async def send_encrypted(message):
            if message["type"] == "http.response.start":
                start.update(message)
            elif message["type"] == "http.response.body":
                chunks.append(message.get("body", b""))
                if message.get("more_body", False):
                    return
                raw = b"".join(chunks)
                payload = json.dumps(server_crypto.aes_encrypt(session_key, raw)).encode()
                keep = [
                    (k, v)
                    for k, v in start.get("headers", [])
                    if k.lower() not in (b"content-length", b"content-type")
                ]
                keep.append((b"content-type", b"application/json"))
                keep.append((b"content-length", str(len(payload)).encode()))
                keep.append((b"x-enc", b"1"))
                await send({"type": "http.response.start", "status": start.get("status", 200), "headers": keep})
                await send({"type": "http.response.body", "body": payload})

        await self.app(scope, inner_receive, send_encrypted)
