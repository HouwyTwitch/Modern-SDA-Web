"""Tiny in-memory sliding-window rate limiter for sensitive endpoints.

Process-local (resets on restart); enough to blunt brute-force attempts against
auth. For multi-process deployments put a real limiter (e.g. Redis) in front.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(key: str, *, limit: int, window: float) -> None:
    now = time.time()
    bucket = _hits[key]
    while bucket and bucket[0] <= now - window:
        bucket.popleft()
    if len(bucket) >= limit:
        retry = int(window - (now - bucket[0])) + 1
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait a moment and try again.",
            headers={"Retry-After": str(retry)},
        )
    bucket.append(now)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
