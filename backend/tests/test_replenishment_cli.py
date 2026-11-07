from pathlib import Path
import runpy
import sys
from unittest.mock import patch

import pytest

from app.scripts import replenish_recurring_events as job
from test_recurrence_replenishment import engine, parent
from sqlmodel import Session


SCRIPT = Path(__file__).parents[1] / "scripts/replenish_recurring_events.py"


@pytest.mark.parametrize("failures,code", [([], 0), (["failed"], 1)])
def test_direct_script_delegates_to_existing_job_and_prints_summary(failures, code, capsys, monkeypatch):
    backend_root = str(SCRIPT.parents[1])
    # Simulate direct execution with no backend-root entry in sys.path.
    monkeypatch.setattr(sys, "path", [entry for entry in sys.path if entry != backend_root])
    sentinel_engine = object()
    def run(engine, *, summary):
        assert engine is sentinel_engine
        assert backend_root in sys.path
        summary.update(series_processed=3, occurrences_created=4, skipped=2, failures=len(failures))
        return failures
    with patch("app.core.database.engine", sentinel_engine), patch.object(job, "run_replenishment", side_effect=run) as mocked:
        with pytest.raises(SystemExit) as exited:
            runpy.run_path(str(SCRIPT), run_name="__main__")
    assert exited.value.code == code
    mocked.assert_called_once()
    assert capsys.readouterr().out.strip() == f"Replenishment: series_processed=3 occurrences_created=4 skipped=2 failures={len(failures)}"


def test_unrecoverable_failure_is_nonzero_and_does_not_expose_exception_details(capsys):
    with patch.object(job, "run_replenishment", side_effect=RuntimeError("secret database URL")):
        with pytest.raises(SystemExit) as exited:
            runpy.run_path(str(SCRIPT), run_name="__main__")
    assert exited.value.code == 1
    output = capsys.readouterr()
    assert "failures=1" in output.out
    assert "RuntimeError" in output.err
    assert "secret database URL" not in output.out + output.err


def test_import_does_not_run_job():
    with patch.object(job, "run_replenishment") as mocked:
        entrypoint = runpy.run_path(str(SCRIPT))
    assert callable(entrypoint["main"])
    mocked.assert_not_called()


def test_summary_reports_skips_failures_committed_occurrences_and_idempotency(engine):
    from datetime import datetime
    from app.services.recurrence import replenish_recurring_parent
    with Session(engine) as session:
        parent(session)
        parent(session, rule="FREQ=WEEKLY;COUNT=3")
        bad_id = parent(session, rule="NOT_A_RULE").id
    def fixed_time(session, parent_id):
        return replenish_recurring_parent(session, parent_id, now=datetime(2026, 10, 7))
    summary = {}
    with patch.object(job, "replenish_recurring_parent", side_effect=fixed_time):
        assert job.run_replenishment(engine, summary=summary) == [bad_id]
        assert summary["series_processed"] == 2
        assert summary["occurrences_created"] > 0
        assert summary["skipped"] == 1
        assert summary["failures"] == 1
        assert job.run_replenishment(engine, summary=summary) == [bad_id]
        assert summary == dict(series_processed=2, occurrences_created=0, skipped=2, failures=1)
