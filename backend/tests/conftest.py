import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return 'JSON'

from app.services.resend_email import resend_email_service
from app.services.email_service import smart_email_service

@pytest.fixture(autouse=True)
def mock_all_email_dispatches():
    with patch.object(smart_email_service, 'send_smart_email', new_callable=AsyncMock) as mock_smart, \
         patch.object(smart_email_service, '_send_via_resend', new_callable=AsyncMock) as mock_resend_internal, \
         patch.object(smart_email_service, '_send_via_smtp', new_callable=AsyncMock) as mock_smtp_internal, \
         patch.object(resend_email_service, 'send_ticket_order_confirmation', new_callable=AsyncMock) as mock_ticket_conf, \
         patch.object(resend_email_service, 'send_event_cancellation_refund_notification', new_callable=AsyncMock) as mock_cancel, \
         patch.object(resend_email_service, 'send_event_rescheduled_notification', new_callable=AsyncMock) as mock_resched, \
         patch.object(resend_email_service, 'send_organizer_ticket_sale_notification', new_callable=AsyncMock) as mock_org_sale, \
         patch('resend.Emails.send') as mock_resend_sdk, \
         patch('aiosmtplib.send', new_callable=AsyncMock) as mock_smtp_sdk:
        mock_smart.return_value = True
        mock_resend_internal.return_value = True
        mock_smtp_internal.return_value = True
        mock_ticket_conf.return_value = True
        mock_cancel.return_value = True
        mock_resched.return_value = True
        mock_org_sale.return_value = True
        mock_resend_sdk.return_value = {'id': 'mock_email_id'}
        mock_smtp_sdk.return_value = ('250', 'OK')
        yield {
            'smart_email': mock_smart,
            'ticket_confirmation': mock_ticket_conf,
            'cancellation': mock_cancel,
            'reschedule': mock_resched,
            'organizer_sale': mock_org_sale,
            'resend_sdk': mock_resend_sdk,
            'smtp_sdk': mock_smtp_sdk
        }
