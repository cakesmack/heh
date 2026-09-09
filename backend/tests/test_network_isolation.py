from types import SimpleNamespace
from unittest.mock import Mock

import pytest

import conftest as isolation


def test_network_guard_classifies_only_numeric_loopback():
    for address in [
        ("127.0.0.1", 1),
        ("127.23.45.67", 65535),
        ("::1", 1, 0, 0),
    ]:
        assert isolation.is_numeric_loopback_destination(address)

    for address in [
        ("localhost", 80),
        ("api.stripe.com", 443),
        ("192.0.2.1", 443),
        ("2001:db8::1", 443, 0, 0),
        "local-socket-path",
    ]:
        assert not isolation.is_numeric_loopback_destination(address)


def test_network_guards_delegate_loopback_without_live_connections(monkeypatch):
    connect = Mock(return_value=None)
    connect_ex = Mock(return_value=0)
    create_connection = Mock(return_value="local-connection")
    monkeypatch.setattr(isolation, "_ORIGINAL_SOCKET_CONNECT", connect)
    monkeypatch.setattr(isolation, "_ORIGINAL_SOCKET_CONNECT_EX", connect_ex)
    monkeypatch.setattr(isolation, "_ORIGINAL_CREATE_CONNECTION", create_connection)

    fake_socket = SimpleNamespace(family=isolation.socket.AF_INET)
    assert isolation.guarded_socket_connect(fake_socket, ("127.0.0.1", 1234)) is None
    assert isolation.guarded_socket_connect_ex(fake_socket, ("::1", 1234, 0, 0)) == 0
    assert isolation.guarded_create_connection(("127.0.0.2", 1234)) == "local-connection"

    connect.assert_called_once_with(fake_socket, ("127.0.0.1", 1234))
    connect_ex.assert_called_once_with(fake_socket, ("::1", 1234, 0, 0))
    create_connection.assert_called_once_with(("127.0.0.2", 1234))


def test_network_guards_reject_external_destinations_without_resolution(monkeypatch):
    connect = Mock()
    connect_ex = Mock()
    create_connection = Mock()
    monkeypatch.setattr(isolation, "_ORIGINAL_SOCKET_CONNECT", connect)
    monkeypatch.setattr(isolation, "_ORIGINAL_SOCKET_CONNECT_EX", connect_ex)
    monkeypatch.setattr(isolation, "_ORIGINAL_CREATE_CONNECTION", create_connection)

    fake_socket = SimpleNamespace(family=isolation.socket.AF_INET)
    with pytest.raises(RuntimeError, match="Outbound network access is disabled"):
        isolation.guarded_socket_connect(fake_socket, ("192.0.2.1", 443))
    with pytest.raises(RuntimeError, match="Outbound network access is disabled"):
        isolation.guarded_socket_connect_ex(fake_socket, ("2001:db8::1", 443, 0, 0))
    with pytest.raises(RuntimeError, match="Outbound network access is disabled"):
        isolation.guarded_create_connection(("localhost", 80))

    connect.assert_not_called()
    connect_ex.assert_not_called()
    create_connection.assert_not_called()
