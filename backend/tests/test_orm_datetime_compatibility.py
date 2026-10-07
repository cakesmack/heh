"""Focused guard for the event datetime behaviour of the declared ORM pair."""
import unittest
from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB, psycopg2
from sqlalchemy.ext.compiler import compiles
from sqlmodel import SQLModel, Session, create_engine, select

from app.models.event import Event


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kwargs):
    return "JSON"


class EventDatetimeCompatibilityTest(unittest.TestCase):
    def test_naive_event_filter_uses_existing_postgresql_binding(self):
        cutoff = datetime(2026, 10, 7, 10)
        query = select(Event.id).where(Event.date_start >= cutoff)
        dialect = psycopg2.dialect()
        compiled = query.compile(dialect=dialect)
        self.assertIn("events.date_start >=", str(compiled))
        bind = compiled.binds["date_start_1"]
        processor = bind.type._cached_bind_processor(dialect)
        bound_value = processor(cutoff) if processor else cutoff
        self.assertEqual(bound_value, cutoff)
        self.assertIsNone(bound_value.tzinfo)
        self.assertFalse(Event.__table__.c.date_start.type.timezone)

    def test_existing_naive_datetime_filter_executes_in_memory(self):
        # Same disposable SQLite setup as the existing backend tests. No
        # persistent or production database is contacted or changed.
        engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(engine)
        try:
            with Session(engine) as session:
                cutoff = datetime(2026, 10, 7, 10)
                query = select(Event).where(Event.date_start >= cutoff)
                self.assertEqual(session.exec(query).all(), [])
                session.add(Event(id="orm-datetime-check", title="Datetime check",
                                  date_start=datetime(2026, 10, 7, 12),
                                  date_end=datetime(2026, 10, 7, 14)))
                session.commit()
                result = session.exec(query).one()
                self.assertEqual(result.id, "orm-datetime-check")
                self.assertEqual(result.date_start, datetime(2026, 10, 7, 12))
                self.assertIsNone(result.date_start.tzinfo)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
