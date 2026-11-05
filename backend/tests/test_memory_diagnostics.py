import io
import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core import memory_diagnostics as diagnostics
from app.core.config import Settings


def complete(coroutine):
    with pytest.raises(StopIteration):
        coroutine.send(None)


async def receive():
    return {"type": "http.disconnect"}


def test_disabled_diagnostics_are_transparent(monkeypatch, caplog):
    monkeypatch.setattr(diagnostics, "memory_snapshot", Mock(side_effect=AssertionError("must not sample")))
    calls = []
    async def app(scope, recv, send):
        calls.append((scope, recv, send))
    scope = {"type": "http", "path": "/api/events"}
    send = Mock()
    middleware = diagnostics.MemoryDiagnosticsMiddleware(app)
    complete(middleware(scope, receive, send))
    assert calls == [(scope, receive, send)]
    assert middleware.inflight == 0
    assert not caplog.records
    assert Settings.model_fields["MEMORY_DIAGNOSTICS_ENABLED"].default is False


def test_sampling_streams_counts_and_never_logs_identifiers(monkeypatch, caplog):
    clock = [0]
    monkeypatch.setattr(diagnostics.time, "monotonic", lambda: clock[0])
    snapshot = Mock(return_value={"rss_bytes": 1234})
    monkeypatch.setattr(diagnostics, "memory_snapshot", snapshot)
    chunks = [
        {"type": "http.response.start", "status": 200},
        {"type": "http.response.body", "body": b"abc", "more_body": True},
        {"type": "http.response.body", "body": b"de"},
    ]
    async def app(scope, recv, send):
        for chunk in chunks:
            await send(chunk)
    sent = []
    async def send(message):
        sent.append(message)
    scope = {"type": "http", "path": "/api/events/private-event-id",
             "query_string": b"token=secret", "headers": [(b"authorization", b"private-token")]}
    middleware = diagnostics.MemoryDiagnosticsMiddleware(app, enabled=True)
    caplog.set_level("INFO", logger=diagnostics.logger.name)
    for _ in range(1000):
        complete(middleware(scope, receive, send))
    assert len(caplog.records) == 1
    assert snapshot.call_count == 2
    assert all(message is chunks[index % 3] for index, message in enumerate(sent))
    record = json.loads(caplog.records[0].message.split("memory_diagnostic ")[1])
    assert record["endpoint"] == "/api/events/*"
    assert record["response_bytes"] == 5 and record["status"] == 200
    assert record["inflight_start"] == 1 and record["inflight_end"] == 1
    assert "secret" not in caplog.text and "private" not in caplog.text
    assert middleware.inflight == 0
    # State consists only of fixed configuration and scalar counters, not requests.
    assert set(middleware.__dict__) == {
        "app", "enabled", "interval_seconds", "engine", "limiter", "last_sample_at", "inflight"
    }
    clock[0] = 60
    complete(middleware(scope, receive, send))
    assert len(caplog.records) == 2


def test_failures_release_inflight_and_log_without_exception_details(monkeypatch, caplog):
    monkeypatch.setattr(diagnostics, "memory_snapshot", lambda *args: {})
    async def app(*args):
        raise RuntimeError("private failure text")
    middleware = diagnostics.MemoryDiagnosticsMiddleware(app, enabled=True)
    caplog.set_level("INFO", logger=diagnostics.logger.name)
    with pytest.raises(RuntimeError, match="private failure text"):
        complete(middleware({"type": "http", "path": "/api/analytics/trending"}, receive, Mock()))
    assert middleware.inflight == 0
    assert "private failure text" not in caplog.text
    assert '"status": null' in caplog.text


def test_snapshot_reports_counts_without_exposing_cache_contents(monkeypatch):
    monkeypatch.setattr(diagnostics, "current_rss_bytes", lambda: 4096)
    pool = SimpleNamespace(size=lambda: 50, checkedout=lambda: 2, overflow=lambda: 0)
    engine = SimpleNamespace(pool=pool, _compiled_cache={"private query": object()})
    limiter = SimpleNamespace(_storage=SimpleNamespace(
        storage={"private IP": 1}, expirations={}, events={}, locks={}
    ))
    result = diagnostics.memory_snapshot(engine, limiter)
    assert result["pool_size"] == 50 and result["pool_checkedout"] == 2
    assert result["rss_bytes"] == 4096 and result["compiled_cache_entries"] == 1
    assert result["rate_limit_storage_keys"] == 1
    assert "private" not in json.dumps(result)


def test_linux_rss_is_current_resident_pages_and_missing_proc_is_safe(monkeypatch):
    monkeypatch.setattr("builtins.open", lambda *args, **kwargs: io.StringIO("1000 50 30 10 0"))
    monkeypatch.setattr(diagnostics.os, "sysconf", lambda key: 4096, raising=False)
    assert diagnostics.current_rss_bytes() == 50 * 4096
    monkeypatch.setattr("builtins.open", Mock(side_effect=OSError()))
    assert diagnostics.current_rss_bytes() is None


@pytest.mark.parametrize("path", ["/api/auth/login", "/api/webhooks/stripe", "/health", "/api/events/id/claim"])
def test_unrelated_paths_do_not_sample(path):
    assert diagnostics.endpoint_group(path) is None


def test_application_registers_diagnostics_disabled_by_default():
    from app.main import app
    entry = next(item for item in app.user_middleware if item.cls is diagnostics.MemoryDiagnosticsMiddleware)
    assert entry.kwargs["enabled"] is False
    assert entry.kwargs["interval_seconds"] == 60
