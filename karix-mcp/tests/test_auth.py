"""Tests for karix_mcp.auth.

Covers:
    - JWT issue and decode round-trip
    - Token expiry
    - PKCE S256 verification (valid, tampered, wrong method)
    - Authorization code store: issue, consume, single-use, expiry
    - Karix credential validation (real HTTP calls mocked)
    - /connect/validate endpoint (direct token + OAuth redirect flows)
    - /oauth/token endpoint (client_credentials + authorization_code grants)
    - /oauth/authorize endpoint (PKCE validation + redirect)
    - /.well-known/oauth-authorization-server metadata
"""

import hashlib
import time
from base64 import urlsafe_b64encode
from unittest.mock import patch

import jwt
import pytest
from starlette.testclient import TestClient

from karix_mcp import auth
from karix_mcp.app import app


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return urlsafe_b64encode(digest).rstrip(b"=").decode()


# ── JWT ───────────────────────────────────────────────────────────────────────

class TestJWT:
    def test_round_trip(self, mock_karix_ok, valid_credentials):
        result = auth.issue_token(**valid_credentials)
        assert result["token_type"] == "bearer"
        assert result["expires_in"] == auth._TOKEN_TTL

        claims = auth.decode_token(result["access_token"])
        assert claims["esme_addr"] == valid_credentials["esme_addr"]
        assert claims["api_key"]   == valid_credentials["api_key"]
        assert claims["waba_id"]   == valid_credentials["waba_id"]
        assert "sender_id" not in claims  # must be absent from token

    def test_expired_token_raises(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-production-32ch")
        # Forge an already-expired token.
        past = int(time.time()) - 10
        payload = {"esme_addr": "x", "api_key": "y", "waba_id": "z", "iat": past, "exp": past}
        token = jwt.encode(payload, "test-secret-do-not-use-in-production-32ch", algorithm="HS256")
        with pytest.raises(jwt.ExpiredSignatureError):
            auth.decode_token(token)

    def test_wrong_secret_raises(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-production-32ch")
        token = jwt.encode({"exp": int(time.time()) + 3600}, "other-secret", algorithm="HS256")
        with pytest.raises(jwt.InvalidSignatureError):
            auth.decode_token(token)

    def test_missing_secret_raises(self, monkeypatch):
        monkeypatch.delenv("JWT_SECRET", raising=False)
        with pytest.raises(auth.AuthError) as exc:
            auth._jwt_secret()
        assert exc.value.status == 500


# ── PKCE ──────────────────────────────────────────────────────────────────────

class TestPKCE:
    def test_valid_s256(self):
        verifier   = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        challenge  = _make_challenge(verifier)
        assert auth.verify_pkce(verifier, challenge) is True

    def test_tampered_verifier(self):
        verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        challenge = _make_challenge(verifier)
        assert auth.verify_pkce(verifier + "X", challenge) is False

    def test_tampered_challenge(self):
        verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        challenge = _make_challenge(verifier)
        assert auth.verify_pkce(verifier, challenge[:-1] + "X") is False


# ── Authorization code store ──────────────────────────────────────────────────

class TestCodeStore:
    def setup_method(self):
        # Clear any codes left from other tests.
        auth._codes.clear()

    def test_issue_and_consume(self, valid_credentials):
        verifier  = "verifier_abc123"
        challenge = _make_challenge(verifier)
        code = auth._issue_code(
            esme_addr=valid_credentials["esme_addr"],
            api_key=valid_credentials["api_key"],
            waba_id=valid_credentials["waba_id"],
            code_challenge=challenge,
            redirect_uri="http://localhost:3000/callback",
        )
        assert code in auth._codes

        entry = auth._consume_code(code)
        assert entry.esme_addr == valid_credentials["esme_addr"]
        assert code not in auth._codes  # single-use: consumed

    def test_single_use_replay_rejected(self, valid_credentials):
        code = auth._issue_code(
            **valid_credentials,
            code_challenge=_make_challenge("v"),
            redirect_uri="http://localhost/cb",
        )
        auth._consume_code(code)
        with pytest.raises(auth.AuthError) as exc:
            auth._consume_code(code)
        assert exc.value.error == "invalid_grant"

    def test_expired_code_rejected(self, valid_credentials, monkeypatch):
        code = auth._issue_code(
            **valid_credentials,
            code_challenge=_make_challenge("v"),
            redirect_uri="http://localhost/cb",
        )
        # Capture expiry before patching time, then patch.
        expires_at = auth._codes[code].expires_at
        monkeypatch.setattr(time, "time", lambda: expires_at + 1)
        with pytest.raises(auth.AuthError) as exc:
            auth._consume_code(code)
        assert exc.value.error == "invalid_grant"

    def test_purge_removes_expired(self, valid_credentials, monkeypatch):
        code = auth._issue_code(
            **valid_credentials,
            code_challenge=_make_challenge("v"),
            redirect_uri="http://localhost/cb",
        )
        expires_at = auth._codes[code].expires_at
        monkeypatch.setattr(time, "time", lambda: expires_at + 1)
        auth._purge_expired_codes()
        assert code not in auth._codes


# ── Karix validation ──────────────────────────────────────────────────────────

class TestValidateKarix:
    def test_success(self, mocker, valid_credentials):
        mock = mocker.patch("requests.get")
        mock.return_value.status_code = 200
        mock.return_value.json.return_value = [
            {"waba_id": "494227720434920", "sender_id": "919152004195"}
        ]
        result = auth.validate_karix(**valid_credentials)
        assert len(result) == 1

    def test_wrong_api_key(self, mocker, valid_credentials):
        mock = mocker.patch("requests.get")
        mock.return_value.status_code = 401
        with pytest.raises(auth.AuthError) as exc:
            auth.validate_karix(**valid_credentials)
        assert exc.value.status == 401

    def test_wrong_waba_id(self, mocker, valid_credentials):
        mock = mocker.patch("requests.get")
        mock.return_value.status_code = 200
        mock.return_value.json.return_value = [{"waba_id": "999000000000001"}]
        with pytest.raises(auth.AuthError) as exc:
            auth.validate_karix(**valid_credentials)
        assert exc.value.error == "invalid_client"

    def test_network_error(self, mocker, valid_credentials):
        import requests as req_lib
        mocker.patch("requests.get", side_effect=req_lib.ConnectionError("timeout"))
        with pytest.raises(auth.AuthError) as exc:
            auth.validate_karix(**valid_credentials)
        assert exc.value.status == 502


# ── HTTP endpoints ─────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


class TestConnectValidate:
    def test_direct_token_flow(self, client, mock_karix_ok, valid_credentials):
        resp = client.post("/connect/validate", json=valid_credentials)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_oauth_redirect_flow(self, client, mock_karix_ok, valid_credentials):
        verifier  = "secure_verifier_xyz789"
        challenge = _make_challenge(verifier)
        body = {
            **valid_credentials,
            "code_challenge": challenge,
            "redirect_uri":   "http://localhost:3000/callback",
            "state":          "random_state",
        }
        resp = client.post("/connect/validate", json=body)
        assert resp.status_code == 200
        data = resp.json()
        assert "redirect_url" in data
        assert "code=" in data["redirect_url"]
        assert "state=random_state" in data["redirect_url"]

    def test_missing_fields_rejected(self, client):
        resp = client.post("/connect/validate", json={"esme_addr": "x"})
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_request"

    def test_invalid_credentials_rejected(self, client, mocker, valid_credentials):
        mocker.patch("karix_mcp.auth.validate_karix",
                     side_effect=auth.AuthError("invalid_client", "Bad key", 401))
        resp = client.post("/connect/validate", json=valid_credentials)
        assert resp.status_code == 401


class TestTokenEndpoint:
    def test_client_credentials(self, client, mock_karix_ok, valid_credentials):
        resp = client.post("/oauth/token", data={
            "grant_type":    "client_credentials",
            "client_id":     valid_credentials["esme_addr"],
            "client_secret": valid_credentials["api_key"],
            "waba_id":       valid_credentials["waba_id"],
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_authorization_code(self, client, mock_karix_ok, valid_credentials):
        auth._codes.clear()
        verifier  = "auth_code_test_verifier_secure_string"
        challenge = _make_challenge(verifier)
        code = auth._issue_code(
            **valid_credentials,
            code_challenge=challenge,
            redirect_uri="http://localhost/cb",
        )
        resp = client.post("/oauth/token", data={
            "grant_type":    "authorization_code",
            "code":          code,
            "code_verifier": verifier,
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_authorization_code_wrong_verifier(self, client, valid_credentials):
        auth._codes.clear()
        code = auth._issue_code(
            **valid_credentials,
            code_challenge=_make_challenge("correct_verifier"),
            redirect_uri="http://localhost/cb",
        )
        resp = client.post("/oauth/token", data={
            "grant_type":    "authorization_code",
            "code":          code,
            "code_verifier": "wrong_verifier",
        })
        assert resp.status_code == 401

    def test_unsupported_grant(self, client):
        resp = client.post("/oauth/token", data={"grant_type": "password"})
        assert resp.status_code == 400
        assert resp.json()["error"] == "unsupported_grant_type"


class TestAuthorizeEndpoint:
    def test_missing_params_rejected(self, client):
        resp = client.get("/oauth/authorize", follow_redirects=False)
        assert resp.status_code == 400

    def test_plain_challenge_method_rejected(self, client):
        resp = client.get("/oauth/authorize", params={
            "client_id":             "x",
            "redirect_uri":          "http://localhost/cb",
            "code_challenge":        "abc",
            "code_challenge_method": "plain",
            "response_type":         "code",
        }, follow_redirects=False)
        assert resp.status_code == 400

    def test_valid_redirects_to_connect(self, client):
        resp = client.get("/oauth/authorize", params={
            "client_id":             "x",
            "redirect_uri":          "http://localhost/cb",
            "code_challenge":        _make_challenge("v"),
            "code_challenge_method": "S256",
            "response_type":         "code",
        }, follow_redirects=False)
        assert resp.status_code == 302
        assert "/connect?" in resp.headers["location"]


class TestOAuthMetadata:
    def test_required_fields(self, client):
        resp = client.get("/.well-known/oauth-authorization-server")
        assert resp.status_code == 200
        data = resp.json()
        assert "authorization_endpoint" in data
        assert "token_endpoint" in data
        assert "S256" in data["code_challenge_methods_supported"]
        assert "authorization_code" in data["grant_types_supported"]
        assert "client_credentials" in data["grant_types_supported"]
