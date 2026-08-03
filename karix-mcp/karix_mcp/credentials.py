"""Credential resolution for Karix MCP.

Priority (highest to lowest):
    1. Request context — JWT claims injected by AuthMiddleware per request.
    2. Environment variables — .env / systemd EnvironmentFile (single-tenant).

JWT tokens carry only {esme_addr, api_key, waba_id}. Sender ID is
intentionally excluded: agents select the appropriate sender at tool-call
time by calling get_sender_details() and using what they find. This lets
a single token serve an account with multiple WhatsApp numbers.
"""

import os
from contextvars import ContextVar

# Populated by AuthMiddleware on each authenticated request.
_ctx_api_key:  ContextVar[str] = ContextVar("api_key",  default="")
_ctx_waba_id:  ContextVar[str] = ContextVar("waba_id",  default="")
_ctx_esme_addr: ContextVar[str] = ContextVar("esme_addr", default="")


def set_request_credentials(api_key: str, waba_id: str, esme_addr: str) -> None:
    """Called by AuthMiddleware after JWT decode. Scoped to the current request."""
    _ctx_api_key.set(api_key)
    _ctx_waba_id.set(waba_id)
    _ctx_esme_addr.set(esme_addr)


def resolve_api_key() -> str:
    return _ctx_api_key.get() or _require_env("KARIX_API_KEY")


def resolve_waba_id() -> str:
    return _ctx_waba_id.get() or _require_env("KARIX_WABA_ID")


def resolve_sender_id() -> str:
    # Sender ID is never in the JWT. Falls back to env for single-tenant dev setups.
    return _require_env("KARIX_SENDER_ID")


def resolve_esme_addr() -> str:
    return _ctx_esme_addr.get() or os.environ.get("KARIX_ESME_ADDR", "")


def _require_env(name: str) -> str:
    val = os.environ.get(name, "")
    if not val:
        raise RuntimeError(
            f"{name} is not set. Authenticate via POST /oauth/token "
            f"or set {name} in the environment."
        )
    return val
