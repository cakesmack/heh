"""Focused allocation/query regressions; use only the isolated pytest database."""
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy import event as sa_event
from sqlalchemy.dialects import postgresql
from sqlmodel import Session, select

from app.api import analytics
from app.core.database import engine
from app.core.query_utils import deduplicate_recurring_events
from app.models.analytics import AnalyticsEvent
from app.models.event import Event


def test_trending_aggregates_without_loading_analytics_objects(monkeypatch):
    now = datetime(2026, 11, 5, 12)
    class Clock:
        @staticmethod
        def utcnow():
            return now
    monkeypatch.setattr(analytics, "datetime", Clock)
    AnalyticsEvent.__table__.create(engine, checkfirst=True)
    loaded = []
    with Session(engine) as session:
        # Current threshold, growth boundary, falling counts, ID normalization,
        # missing metadata, non-view traffic, and exact period boundaries.
        rows = []
        def views(target, count, when, kind="event_view"):
            rows.extend(dict(event_type=kind, session_id="test", url="/events/test",
                             event_metadata={"target_id": target} if target is not None else {},
                             created_at=when) for _ in range(count))
        views("new", 10, now)
        views("too-small", 9, now)
        views("growth", 6, now - timedelta(days=7))
        views("growth", 5, now - timedelta(days=14))
        views("falling", 5, now)
        views("falling", 6, now - timedelta(days=8))
        views("a-b", 5, now)
        views("ab", 5, now)
        views("old", 20, now - timedelta(days=14, seconds=1))
        views(None, 20, now)
        views("not-view", 20, now, "page_view")
        # Thousands of large log payloads still produce only one aggregate row.
        views("busy", 3000, now)
        for row in rows:
            row["event_metadata"]["extra"] = "x" * 1024
        session.execute(AnalyticsEvent.__table__.insert(), rows)
        sa_event.listen(session, "loaded_as_persistent", lambda *args: loaded.append(1))
        statements = []
        original_exec = session.exec
        def capture(statement, *args, **kwargs):
            statements.append(statement)
            return original_exec(statement, *args, **kwargs)
        monkeypatch.setattr(session, "exec", capture)
        for _ in range(5):
            assert set(analytics.get_trending_events(7, session, None)) == {"new", "growth", "ab", "busy"}
            assert len(session.identity_map) == 0
        assert loaded == []
        for statement in statements:
            sql = str(statement.compile(dialect=postgresql.dialect()))
            assert "GROUP BY" in sql and "count(analytics_events.id)" in sql
            assert "->>" in sql
            assert len(statement.selected_columns) == 2


@pytest.mark.parametrize("sort_field", ["date", "date_desc", "created", "random"])
@pytest.mark.parametrize("limit,offset", [(5, 2), (None, 0)])
def test_postgres_discovery_keeps_candidate_ids_in_sql(sort_field, limit, offset):
    session = Mock()
    session.bind.dialect.name = "postgresql"
    rows = [Event(id="event", title="Required title", description="Required description", date_start=datetime(2026, 11, 5))]
    count_result = Mock()
    count_result.one.return_value = 50
    page_result = Mock()
    page_result.all.return_value = rows
    session.exec.side_effect = [count_result, page_result]
    base = select(Event).where(Event.status == "published", Event.is_cancelled == False)
    result, total = deduplicate_recurring_events(
        session, base, limit=limit, offset=offset, sort_field=sort_field,
        excluded_series_ids=["excluded"],
    )
    assert result == rows and total == 50
    assert result[0].description == "Required description"
    # No separate query returns the entire candidate ID set to Python.
    assert session.exec.call_count == 2
    statement = session.exec.call_args_list[1].args[0]
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "events.id IN (SELECT DISTINCT ON" in sql
    assert "events.status =" in sql and "events.is_cancelled = false" in sql
    assert "NOT IN" in sql and "GROUP BY events.id" in sql
    assert statement._limit == limit
    assert (statement._offset or 0) == offset
    if sort_field == "random":
        assert "random()" in sql
    else:
        assert f"events.{'created_at' if sort_field == 'created' else 'date_start'} {'DESC' if sort_field in ('created', 'date_desc') else 'ASC'}" in sql


def test_postgres_discovery_empty_results_preserve_total():
    session = Mock()
    session.bind.dialect.name = "postgresql"
    session.exec.side_effect = [SimpleNamespace(one=lambda: 0), SimpleNamespace(all=lambda: [])]
    assert deduplicate_recurring_events(session, select(Event), limit=5) == ([], 0)
