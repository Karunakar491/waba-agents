"""Shared fixtures for Karix MCP tests."""

import os

import pytest


@pytest.fixture(autouse=True)
def set_jwt_secret(monkeypatch):
    """Every test gets a stable JWT_SECRET so auth.py doesn't error."""
    monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-production-32ch")


@pytest.fixture
def valid_credentials():
    return {
        "esme_addr": "test_esme",
        "api_key":   "test_api_key_abc123",
        "waba_id":   "494227720434920",
    }


@pytest.fixture
def mock_karix_ok(mocker, valid_credentials):
    """Stub validate_karix to succeed and return a single sender mapping."""
    return mocker.patch(
        "karix_mcp.auth.validate_karix",
        return_value=[{"waba_id": valid_credentials["waba_id"], "sender_id": "919152004195"}],
    )
