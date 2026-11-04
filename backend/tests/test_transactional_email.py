from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from aiosmtplib.errors import SMTPAuthenticationError
from fastapi import Request

from app.api.auth import ForgotPasswordRequest, forgot_password
from app.core.config import settings
from app.services import resend_email
from app.services.campaign_service import send_single_campaign_email
from app.services.email_service import EmailType, SmartEmailService


RECIPIENT = "user@example.com"


def run_mocked(coroutine):
    # These unit tests stub every I/O boundary, so the coroutine completes immediately.
    with pytest.raises(StopIteration) as completed:
        coroutine.send(None)
    return completed.value.value


@pytest.fixture
def transactional_service(monkeypatch, mock_all_email_dispatches):
    values = {
        "TRANSACTIONAL_SMTP_HOST": "email-smtp.eu-north-1.amazonaws.com",
        "TRANSACTIONAL_SMTP_PORT": 587,
        "TRANSACTIONAL_SMTP_USER": "transactional-test-user",
        "TRANSACTIONAL_SMTP_PASS": "transactional-test-password",
        "TRANSACTIONAL_SMTP_STARTTLS": True,
        "TRANSACTIONAL_FROM_ADDRESS": "transactional@example.com",
        "TRANSACTIONAL_SES_CONFIGURATION_SET": "test-transactional",
        "HOSTINGER_SMTP_USER": "hostinger-test-user",
        "HOSTINGER_SMTP_PASS": "hostinger-test-password",
        "CAMPAIGN_SMTP_HOST": "campaign.example.com",
        "CAMPAIGN_SMTP_USER": "campaign-test-user",
        "CAMPAIGN_SMTP_PASS": "campaign-test-password",
        "CAMPAIGN_FROM_ADDRESS": "campaign@example.com",
        "FRONTEND_URL": "https://highlandeventshub.co.uk/",
    }
    for name, value in values.items():
        monkeypatch.setattr(settings, name, value)
    service = SmartEmailService()
    monkeypatch.setattr(resend_email, "smart_email_service", service)
    return service, mock_all_email_dispatches["smtp_sdk"]


def test_password_reset_uses_dedicated_ses_settings(transactional_service, caplog):
    _, smtp_send = transactional_service
    caplog.set_level("INFO", logger="app.services.email_service")
    assert run_mocked(resend_email.resend_email_service.send_password_reset(
        RECIPIENT, "test-token"
    )) is True

    smtp_send.assert_awaited_once()
    message, = smtp_send.call_args.args
    assert smtp_send.call_args.kwargs == {
        "hostname": "email-smtp.eu-north-1.amazonaws.com",
        "port": 587,
        "username": "transactional-test-user",
        "password": "transactional-test-password",
        "start_tls": True,
        "use_tls": False,
    }
    assert message["From"] == "transactional@example.com"
    assert message["To"] == RECIPIENT
    assert message["X-SES-CONFIGURATION-SET"] == "test-transactional"
    assert "https://www.highlandeventshub.co.uk/reset-password?token=test-token" in message.get_content()
    assert "mock-message-id" in caplog.text


def test_missing_ses_settings_fail_for_password_reset(transactional_service, monkeypatch, caplog):
    _, smtp_send = transactional_service
    monkeypatch.setattr(settings, "TRANSACTIONAL_SMTP_PASS", None)
    assert run_mocked(resend_email.resend_email_service.send_password_reset(
        RECIPIENT, "test-token"
    )) is False
    smtp_send.assert_not_awaited()
    assert "missing transactional SES settings (TRANSACTIONAL_SMTP_PASS)" in caplog.text


def test_failed_delivery_preserves_generic_reset_response(transactional_service, caplog):
    _, smtp_send = transactional_service
    smtp_send.side_effect = SMTPAuthenticationError(535, "sensitive server response")
    known_session = Mock()
    known_session.exec.return_value.first.return_value = SimpleNamespace(email=RECIPIENT)
    known_session.exec.return_value.all.return_value = []
    unknown_session = Mock()
    unknown_session.exec.return_value.first.return_value = None
    request = Request({"type": "http", "method": "POST", "path": "/api/auth/forgot-password"})
    payload = ForgotPasswordRequest(email=RECIPIENT)

    # Exercise the handler directly with a fake database and real email routing.
    handler = forgot_password.__wrapped__
    known_response = run_mocked(handler(request, payload, known_session))
    unknown_response = run_mocked(handler(request, payload, unknown_session))

    assert known_response.message == unknown_response.message
    assert known_response.message == "If an account with that email exists, we've sent a password reset link."
    known_session.commit.assert_called_once()
    unknown_session.commit.assert_not_called()
    smtp_send.assert_awaited_once()
    assert "SMTPAuthenticationError, SMTP code 535" in caplog.text
    assert "sensitive server response" not in caplog.text
    assert "email delivery failed" in caplog.text


@pytest.mark.parametrize("email_type", [EmailType.WELCOME, EmailType.MODERATION, EmailType.INVITE, EmailType.TICKETING])
def test_non_security_email_prefers_ses(transactional_service, monkeypatch, email_type):
    service, smtp_send = transactional_service
    monkeypatch.setattr(settings, "TRANSACTIONAL_SES_CONFIGURATION_SET", None)
    assert run_mocked(service.send_smart_email(email_type, RECIPIENT, "Test", "<p>Test</p>"))
    assert smtp_send.call_args.kwargs["username"] == "transactional-test-user"
    assert "X-SES-CONFIGURATION-SET" not in smtp_send.call_args.args[0]


def test_non_security_falls_back_to_hostinger_if_ses_unconfigured(transactional_service, monkeypatch):
    service, smtp_send = transactional_service
    monkeypatch.setattr(settings, "TRANSACTIONAL_SMTP_USER", "")
    assert run_mocked(service.send_smart_email(EmailType.WELCOME, RECIPIENT, "Test", "<p>Test</p>"))
    assert smtp_send.call_args.kwargs["username"] == "hostinger-test-user"
    assert smtp_send.call_args.kwargs["use_tls"] is True
    assert "X-SES-CONFIGURATION-SET" not in smtp_send.call_args.args[0]


def test_configured_ses_failure_does_not_retry_via_hostinger(transactional_service):
    service, smtp_send = transactional_service
    smtp_send.side_effect = TimeoutError()
    assert run_mocked(service.send_smart_email(EmailType.WELCOME, RECIPIENT, "Test", "<p>Test</p>")) is False
    smtp_send.assert_awaited_once()


def test_campaign_email_retains_its_separate_smtp_settings(transactional_service):
    _, smtp_send = transactional_service
    assert run_mocked(send_single_campaign_email(RECIPIENT, "Campaign", "<p>Test</p>"))
    message, = smtp_send.call_args.args
    assert message["From"] == "campaign@example.com"
    assert "X-SES-CONFIGURATION-SET" not in message
    assert smtp_send.call_args.kwargs == {
        "hostname": "campaign.example.com",
        "port": settings.CAMPAIGN_SMTP_PORT,
        "username": "campaign-test-user",
        "password": "campaign-test-password",
        "start_tls": True,
    }
