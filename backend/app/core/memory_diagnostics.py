"""Temporary opt-in memory sampling. Never retains request/ORM objects or payloads."""
import json
import logging
import os
import sys
import time

# Reuse Uvicorn's stderr handler; the application's root logger has no INFO handler.
logger = logging.getLogger("uvicorn.error.memory_diagnostics")


def current_rss_bytes():
    """Current resident memory on Linux/Render, rather than lifetime peak RSS."""
    try:
        with open("/proc/self/statm", encoding="ascii") as statm:
            return int(statm.read().split()[1]) * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError, AttributeError):
        return None


def endpoint_group(path):
    path = path.rstrip("/")
    if path in {
        "/api/events", "/api/events/top", "/api/events/promoted", "/api/venues",
        "/api/collections", "/api/analytics/trending", "/api/analytics/track", "/api/locations",
        "/api/events/map", "/api/map/events",
    }:
        return path
    if path.startswith("/api/recommendations/") or path == "/api/recommendations":
        return "/api/recommendations/*"
    if path.startswith("/api/events/") and len(path.split("/")) == 4:
        return "/api/events/*"
    if path.startswith("/api/collections/slug/"):
        return "/api/collections/slug/*"
    if path.startswith("/api/locations/feed/"):
        return "/api/locations/feed/*"
    return None


def memory_snapshot(engine, limiter):
    result = {"rss_bytes": current_rss_bytes(), "allocated_blocks": sys.getallocatedblocks()}
    # Counts only: no SQL, connection strings, IP keys, or cached payloads.
    try:
        pool = engine.pool
        for name in ("size", "checkedin", "checkedout", "overflow"):
            method = getattr(pool, name, None)
            if callable(method):
                result[f"pool_{name}"] = method()
        cache = getattr(engine, "_compiled_cache", None)
        result["compiled_cache_entries"] = len(cache) if cache is not None else 0
        storage = limiter._storage
        for name in ("storage", "expirations", "events", "locks"):
            values = getattr(storage, name, None)
            if isinstance(values, dict):
                result[f"rate_limit_{name}_keys"] = len(values)
    except Exception:
        # Diagnostics must never make a request fail if provider internals differ.
        result["counts_unavailable"] = True
    return result


class MemoryDiagnosticsMiddleware:
    """At most one sampled request per interval per worker; no response buffering.

    RSS deltas include overlapping requests and background work, so they identify
    correlations rather than attributing allocations exclusively to one endpoint.
    """
    def __init__(self, app, enabled=False, interval_seconds=60, engine=None, limiter=None):
        self.app = app
        self.enabled = enabled
        self.interval_seconds = max(1, interval_seconds)
        self.engine = engine
        self.limiter = limiter
        self.last_sample_at = float("-inf")
        self.inflight = 0

    async def __call__(self, scope, receive, send):
        if not self.enabled or scope["type"] != "http":
            return await self.app(scope, receive, send)
        self.inflight += 1
        try:
            endpoint = endpoint_group(scope.get("path", ""))
            started = time.monotonic()
            if endpoint is None or started - self.last_sample_at < self.interval_seconds:
                return await self.app(scope, receive, send)
            self.last_sample_at = started
            before = memory_snapshot(self.engine, self.limiter)
            inflight_start = self.inflight
            response_bytes = 0
            status = None

            async def sampled_send(message):
                nonlocal response_bytes, status
                if message["type"] == "http.response.start":
                    status = message["status"]
                elif message["type"] == "http.response.body":
                    response_bytes += len(message.get("body", b""))
                await send(message)

            try:
                await self.app(scope, receive, sampled_send)
            finally:
                logger.info("memory_diagnostic %s", json.dumps({
                    "pid": os.getpid(), "endpoint": endpoint, "status": status,
                    "elapsed_ms": round((time.monotonic() - started) * 1000),
                    "response_bytes": response_bytes,
                    "inflight_start": inflight_start, "inflight_end": self.inflight,
                    "before": before, "after": memory_snapshot(self.engine, self.limiter),
                }))
        finally:
            self.inflight -= 1
