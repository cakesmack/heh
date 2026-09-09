from __future__ import annotations

import os
import socket
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, patch


# Pytest loads this file before importing test modules. Override every database and
# external-service setting here so app-level globals cannot inherit a developer or
# production environment.
TEST_DATABASE_PATH = (
    Path(tempfile.gettempdir()).resolve()
    / f"highland_events_hub_pytest_{os.getpid()}.sqlite3"
)
TEST_DATABASE_URL = f"sqlite:///{TEST_DATABASE_PATH.as_posix()}"

TEST_ENVIRONMENT = {
    "DATABASE_URL": TEST_DATABASE_URL,
    "DATABASE_URL_POOLER": "",
    "SECRET_KEY": "pytest-only-secret-key",
    "ALLOWED_ORIGINS": '["http://testserver"]',
    "GOOGLE_MAPS_API_KEY": "",
    "GOOGLE_GEOCODE_API_KEY": "",
    "STRIPE_SECRET_KEY": "sk_test_pytest_only",
    "STRIPE_PUBLISHABLE_KEY": "pk_test_pytest_only",
    "STRIPE_WEBHOOK_SECRET": "whsec_test_pytest_only",
    "STRIPE_CONNECT_WEBHOOK_SECRET": "whsec_test_pytest_connect_only",
    "RESEND_API_KEY": "",
    "CLOUDINARY_CLOUD_NAME": "",
    "CLOUDINARY_API_KEY": "",
    "CLOUDINARY_API_SECRET": "",
    "OS_PLACES_API_KEY": "",
    "OS_API_KEY": "",
    "CLOUDFLARE_ACCOUNT_ID": "",
    "CLOUDFLARE_API_TOKEN": "",
    "CLOUDFLARE_ACCOUNT_HASH": "",
    "HOSTINGER_SMTP_USER": "",
    "HOSTINGER_SMTP_PASS": "",
    "SMTP_USER": "",
    "SMTP_PASS": "",
    "CAMPAIGN_SMTP_USER": "",
    "CAMPAIGN_SMTP_PASS": "",
    "SCRAPER_API_KEY": "pytest-disabled",
    "CRON_SECRET_KEY": "pytest-disabled",
}
os.environ.update(TEST_ENVIRONMENT)

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

def assert_safe_database_configuration() -> None:
    if os.environ.get("DATABASE_URL") != TEST_DATABASE_URL:
        raise RuntimeError("Backend tests require the isolated pytest DATABASE_URL")
    if not TEST_DATABASE_PATH.is_relative_to(Path(tempfile.gettempdir()).resolve()):
        raise RuntimeError("Pytest database must remain inside the operating-system temp directory")

    config_module = sys.modules.get("app.core.config")
    if config_module and config_module.settings.DATABASE_URL != TEST_DATABASE_URL:
        raise RuntimeError("Application settings are not using the isolated pytest database")


assert_safe_database_configuration()


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@asynccontextmanager
async def blocked_application_lifespan(_app):
    raise RuntimeError(
        "Application lifespan is disabled for handler tests because it runs database "
        "initialisation and migration helpers"
    )
    yield


def block_outbound_network(*_args, **_kwargs):
    raise RuntimeError("Outbound network access is disabled during backend tests")


@pytest.fixture(autouse=True)
def isolated_test_runtime(monkeypatch):
    assert_safe_database_configuration()

    database_module = sys.modules.get("app.core.database")
    app_module = sys.modules.get("app.main")

    if database_module:
        engine = database_module.engine
        engine_database = Path(engine.url.database or "").resolve()
        if engine.url.get_backend_name() != "sqlite" or engine_database != TEST_DATABASE_PATH:
            raise RuntimeError("Application-global engine is not bound to the isolated pytest database")

    if app_module:
        monkeypatch.setattr(
            app_module.app.router,
            "lifespan_context",
            blocked_application_lifespan,
        )
    monkeypatch.setattr(socket.socket, "connect", block_outbound_network)
    monkeypatch.setattr(socket.socket, "connect_ex", block_outbound_network)
    monkeypatch.setattr(socket, "create_connection", block_outbound_network)

    yield

    assert_safe_database_configuration()


@pytest.fixture(autouse=True)
def mock_all_email_dispatches():
    email_module = sys.modules.get("app.services.email_service")
    resend_module = sys.modules.get("app.services.resend_email")
    if not email_module or not resend_module:
        yield {}
        return

    smart_email_service = email_module.smart_email_service
    resend_email_service = resend_module.resend_email_service

    with patch.object(smart_email_service, "send_smart_email", new_callable=AsyncMock) as mock_smart, \
         patch.object(smart_email_service, "_send_via_resend", new_callable=AsyncMock) as mock_resend_internal, \
         patch.object(smart_email_service, "_send_via_smtp", new_callable=AsyncMock) as mock_smtp_internal, \
         patch.object(resend_email_service, "send_ticket_order_confirmation", new_callable=AsyncMock) as mock_ticket_conf, \
         patch.object(resend_email_service, "send_event_cancellation_refund_notification", new_callable=AsyncMock) as mock_cancel, \
         patch.object(resend_email_service, "send_event_rescheduled_notification", new_callable=AsyncMock) as mock_resched, \
         patch.object(resend_email_service, "send_organizer_ticket_sale_notification", new_callable=AsyncMock) as mock_org_sale, \
         patch("resend.Emails.send") as mock_resend_sdk, \
         patch("aiosmtplib.send", new_callable=AsyncMock) as mock_smtp_sdk:
        mock_smart.return_value = True
        mock_resend_internal.return_value = True
        mock_smtp_internal.return_value = True
        mock_ticket_conf.return_value = True
        mock_cancel.return_value = True
        mock_resched.return_value = True
        mock_org_sale.return_value = True
        mock_resend_sdk.return_value = {"id": "mock_email_id"}
        mock_smtp_sdk.return_value = ("250", "OK")
        yield {
            "smart_email": mock_smart,
            "ticket_confirmation": mock_ticket_conf,
            "cancellation": mock_cancel,
            "reschedule": mock_resched,
            "organizer_sale": mock_org_sale,
            "resend_sdk": mock_resend_sdk,
            "smtp_sdk": mock_smtp_sdk,
        }


def pytest_sessionfinish(session, exitstatus):
    database_module = sys.modules.get("app.core.database")
    if database_module:
        database_module.engine.dispose()

    TEST_DATABASE_PATH.unlink(missing_ok=True)
