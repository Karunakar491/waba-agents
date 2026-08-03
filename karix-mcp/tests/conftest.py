"""Shared fixtures for Karix MCP tests."""

import os
from pathlib import Path

import pymysql
import pytest
from testcontainers.mysql import MySqlContainer


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


# ── Real MySQL (Testcontainers) — db.py must never be mocked in tests ────────
# EL rule (matches the Java platform's own bar): "Tests that mock the
# database" are not approved. One container for the whole test session
# (schema is static); tables are truncated per-test for isolation.

_SCHEMA_PATH = Path(__file__).parent.parent / "schema.sql"


@pytest.fixture(scope="session")
def mysql_container():
    with MySqlContainer("mysql:8.0", dbname="karix_mcp_db") as container:
        conn = pymysql.connect(
            host=container.get_container_host_ip(),
            port=int(container.get_exposed_port(3306)),
            user=container.username,
            password=container.password,
            database=container.dbname,
        )
        try:
            with conn.cursor() as cur:
                for statement in _SCHEMA_PATH.read_text().split(";"):
                    if statement.strip():
                        cur.execute(statement)
            conn.commit()
        finally:
            conn.close()
        yield container


@pytest.fixture(autouse=True)
def mysql_env(mysql_container, monkeypatch):
    """Points db.py at the real test container for every test, and truncates
    all tables first so each test starts from a clean, empty schema."""
    monkeypatch.setenv("MYSQL_HOST", mysql_container.get_container_host_ip())
    monkeypatch.setenv("MYSQL_PORT", str(mysql_container.get_exposed_port(3306)))
    monkeypatch.setenv("MYSQL_USER", mysql_container.username)
    monkeypatch.setenv("MYSQL_PASSWORD", mysql_container.password)
    monkeypatch.setenv("MYSQL_DATABASE", mysql_container.dbname)

    conn = pymysql.connect(
        host=mysql_container.get_container_host_ip(),
        port=int(mysql_container.get_exposed_port(3306)),
        user=mysql_container.username,
        password=mysql_container.password,
        database=mysql_container.dbname,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS=0")
            cur.execute("TRUNCATE TABLE bulk_import_rows")
            cur.execute("TRUNCATE TABLE bulk_import_jobs")
            cur.execute("TRUNCATE TABLE template_drafts")
            cur.execute("SET FOREIGN_KEY_CHECKS=1")
        conn.commit()
    finally:
        conn.close()
