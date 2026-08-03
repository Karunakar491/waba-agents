"""OAuth 2.0 Authorization Server for Karix MCP.

Supported grants:
    client_credentials    Convogent, scripts, programmatic clients.
    authorization_code    Claude Desktop (PKCE S256 required).

Token payload: {esme_addr, api_key, waba_id, iat, exp}

Sender ID is intentionally absent from the token. Agents resolve the
correct sender dynamically via get_sender_details() and choose based
on task context. This keeps credentials generic and reusable across
senders on the same account.
"""

import hashlib
import hmac
import os
import secrets
import time
from base64 import urlsafe_b64encode
from dataclasses import dataclass
from typing import Any

import jwt
import requests
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse

from karix_mcp import config

# ── Config ────────────────────────────────────────────────────────────────────

_TOKEN_TTL = 86_400   # 24 hours
_CODE_TTL  = 300      # 5 minutes — authorization codes must be short-lived


# ── Exceptions ────────────────────────────────────────────────────────────────

class AuthError(Exception):
    """Raised for any OAuth protocol error."""
    def __init__(self, error: str, description: str, status: int = 400) -> None:
        self.error = error
        self.description = description
        self.status = status
        super().__init__(description)

    def to_response(self) -> JSONResponse:
        return JSONResponse(
            {"error": self.error, "error_description": self.description},
            status_code=self.status,
        )


# ── Karix credential validation ───────────────────────────────────────────────

def validate_karix(esme_addr: str, api_key: str) -> None:
    """Verify ESME address and API key are valid against Karix.

    WABA ID is not validated here — Karix returns internal numeric IDs
    that don't match the real Meta WABA ID. We accept it from the user as-is.
    """
    base = config.TEMPLATE_BASE_URL
    try:
        resp = requests.get(
            f"{base}/api/v1.0/profile/getEsmeSenderMappingDetails",
            headers={"Authentication": f"Bearer {api_key}", "Accept": "application/json"},
            params={"esmeaddr": esme_addr, "channelId": "WABA"},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise AuthError("server_error", f"Karix unreachable: {exc}", status=502) from exc

    if resp.status_code == 401:
        raise AuthError("invalid_client", "Invalid ESME address or API key", status=401)
    if resp.status_code >= 400:
        raise AuthError("server_error", f"Karix returned {resp.status_code}", status=502)

    data = resp.json()
    if not isinstance(data, list) or not data:
        raise AuthError("invalid_client", "No sender mappings found for this account", status=401)


# ── JWT ───────────────────────────────────────────────────────────────────────

def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        raise AuthError("server_error", "JWT_SECRET is not configured", status=500)
    return secret


def issue_token(esme_addr: str, api_key: str, waba_id: str) -> dict[str, Any]:
    """Validate credentials with Karix and return a signed JWT."""
    validate_karix(esme_addr, api_key)

    now = int(time.time())
    payload = {
        "esme_addr": esme_addr,
        "api_key":   api_key,
        "waba_id":   waba_id,
        "iat": now,
        "exp": now + _TOKEN_TTL,
    }
    token = jwt.encode(payload, _jwt_secret(), algorithm="HS256")
    return {
        "access_token": token,
        "token_type":   "bearer",
        "expires_in":   _TOKEN_TTL,
    }


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises jwt.InvalidTokenError on any failure."""
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])


# ── PKCE ──────────────────────────────────────────────────────────────────────

def verify_pkce(code_verifier: str, code_challenge: str) -> bool:
    """Verify a PKCE S256 code_verifier against a stored code_challenge."""
    digest = hashlib.sha256(code_verifier.encode()).digest()
    computed = urlsafe_b64encode(digest).rstrip(b"=").decode()
    return hmac.compare_digest(computed, code_challenge)


# ── Authorization code store (in-memory, single-process) ─────────────────────

@dataclass
class _AuthCode:
    esme_addr:      str
    api_key:        str
    waba_id:        str
    code_challenge: str
    redirect_uri:   str
    expires_at:     float

# Single-process in-memory store is appropriate here: codes are short-lived
# (5 min), single-use, and losing them on restart is acceptable (user retries).
_codes: dict[str, _AuthCode] = {}


def _issue_code(esme_addr: str, api_key: str, waba_id: str,
                code_challenge: str, redirect_uri: str) -> str:
    _purge_expired_codes()
    code = secrets.token_urlsafe(32)
    _codes[code] = _AuthCode(
        esme_addr=esme_addr,
        api_key=api_key,
        waba_id=waba_id,
        code_challenge=code_challenge,
        redirect_uri=redirect_uri,
        expires_at=time.time() + _CODE_TTL,
    )
    return code


def _consume_code(code: str) -> _AuthCode:
    """Retrieve and delete a code. Raises AuthError if missing or expired."""
    entry = _codes.pop(code, None)
    if entry is None:
        raise AuthError("invalid_grant", "Authorization code not found or already used")
    if time.time() > entry.expires_at:
        raise AuthError("invalid_grant", "Authorization code has expired")
    return entry


def _purge_expired_codes() -> None:
    now = time.time()
    expired = [k for k, v in _codes.items() if now > v.expires_at]
    for k in expired:
        del _codes[k]


# ── Route handlers ────────────────────────────────────────────────────────────

async def connect_validate(request: Request) -> JSONResponse:
    """POST /connect/validate — called by the connect page JavaScript.

    Validates credentials with Karix. If OAuth params are present (Claude
    Desktop flow), issues an authorization code and returns a redirect URL.
    Otherwise issues a JWT directly for copy-paste into Convogent.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_request", "error_description": "Expected JSON body"}, status_code=400)

    esme_addr = (body.get("esme_addr") or "").strip()
    api_key   = (body.get("api_key")   or "").strip()
    waba_id   = (body.get("waba_id")   or "").strip()

    if not all([esme_addr, api_key, waba_id]):
        return JSONResponse(
            {"error": "invalid_request", "error_description": "esme_addr, api_key, and waba_id are required"},
            status_code=400,
        )

    # OAuth params — present when Claude Desktop initiated the flow.
    code_challenge = (body.get("code_challenge") or "").strip()
    redirect_uri   = (body.get("redirect_uri")   or "").strip()
    state          = (body.get("state")           or "").strip()

    try:
        if code_challenge and redirect_uri:
            validate_karix(esme_addr, api_key)
            code = _issue_code(esme_addr, api_key, waba_id, code_challenge, redirect_uri)
            sep = "&" if "?" in redirect_uri else "?"
            redirect_url = f"{redirect_uri}{sep}code={code}&state={state}"
            return JSONResponse({"redirect_url": redirect_url})
        else:
            result = issue_token(esme_addr, api_key, waba_id)
            return JSONResponse(result)

    except AuthError as exc:
        return exc.to_response()


async def token_endpoint(request: Request) -> JSONResponse:
    """POST /oauth/token — Client Credentials and Authorization Code grants."""
    form = await request.form()
    grant_type = (form.get("grant_type") or "").strip()

    try:
        if grant_type == "client_credentials":
            esme_addr = (form.get("client_id")     or "").strip()
            api_key   = (form.get("client_secret") or "").strip()
            waba_id   = (form.get("waba_id")       or "").strip()
            if not all([esme_addr, api_key, waba_id]):
                raise AuthError("invalid_request", "client_id, client_secret, and waba_id are required")
            return JSONResponse(issue_token(esme_addr, api_key, waba_id))

        elif grant_type == "authorization_code":
            code          = (form.get("code")          or "").strip()
            code_verifier = (form.get("code_verifier") or "").strip()
            if not code or not code_verifier:
                raise AuthError("invalid_request", "code and code_verifier are required")

            entry = _consume_code(code)
            if not verify_pkce(code_verifier, entry.code_challenge):
                raise AuthError("invalid_grant", "PKCE verification failed", status=401)

            return JSONResponse(issue_token(entry.esme_addr, entry.api_key, entry.waba_id))

        else:
            raise AuthError(
                "unsupported_grant_type",
                "Supported grant types: client_credentials, authorization_code",
            )

    except AuthError as exc:
        return exc.to_response()


async def authorize_endpoint(request: Request) -> RedirectResponse:
    """GET /oauth/authorize — entry point for Claude Desktop OAuth flow.

    Validates required PKCE params, then serves the connect page with
    OAuth params embedded so the form can complete the flow on submit.
    """
    params = request.query_params
    required = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "response_type"]
    missing = [p for p in required if not params.get(p)]
    if missing:
        return JSONResponse(
            {"error": "invalid_request", "error_description": f"Missing: {missing}"},
            status_code=400,
        )
    if params.get("code_challenge_method") != "S256":
        return JSONResponse(
            {"error": "invalid_request", "error_description": "Only code_challenge_method=S256 is supported"},
            status_code=400,
        )
    # Redirect to connect page with OAuth context embedded in query string.
    qs = request.url.query
    return RedirectResponse(f"/connect?{qs}", status_code=302)


async def oauth_metadata(request: Request) -> JSONResponse:
    """GET /.well-known/oauth-authorization-server — RFC 8414 metadata.

    Claude Desktop reads this to discover the authorization and token endpoints.
    """
    base = str(request.base_url).rstrip("/")
    return JSONResponse({
        "issuer":                                base,
        "authorization_endpoint":                f"{base}/oauth/authorize",
        "token_endpoint":                        f"{base}/oauth/token",
        "response_types_supported":              ["code"],
        "grant_types_supported":                 ["authorization_code", "client_credentials"],
        "code_challenge_methods_supported":      ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
    })
