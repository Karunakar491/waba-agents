"""Karix MCP Server — entry point.

Serves two MCP transports from a single process:
    /sse   — SSE transport (used by Convogent and SSE-based clients)
    /mcp   — Streamable-HTTP transport (used by Claude Desktop, MCP Inspector)

Auth (optional):
    If JWT_SECRET is set, all /sse and /mcp requests must carry a valid
    Bearer token obtained from POST /oauth/token or the /connect UI.

    If JWT_SECRET is not set, the server runs unauthenticated — intended for
    local development or trusted private networks only.
"""

import contextlib
import os
from pathlib import Path

import jwt
import uvicorn
from dotenv import load_dotenv
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route

load_dotenv()

from karix_mcp import auth, rest
from karix_mcp.credentials import set_request_credentials
from karix_mcp.server import mcp

sse_app  = mcp.sse_app()
http_app = mcp.streamable_http_app()

_MCP_PATHS   = {"/sse", "/mcp"}
_API_PREFIX  = "/api/"  # Template Studio REST — same auth as MCP paths


def _auth_enabled() -> bool:
    """Read live, not cached at import — matches auth.py's _jwt_secret()
    pattern. EL-caught (round 2): a module-level `bool(os.environ.get(...))`
    binds once at import time, before test fixtures (or a real .env load
    order) can set JWT_SECRET, silently disabling auth enforcement for
    anything gated by it — a real bug, not just theoretical fragility."""
    return bool(os.environ.get("JWT_SECRET"))

_CONNECT_HTML = Path(__file__).parent / "connect.html"


class AuthMiddleware(BaseHTTPMiddleware):
    """Validates Bearer JWT on MCP endpoints when JWT_SECRET is configured."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if _auth_enabled() and (path in _MCP_PATHS or path.startswith(_API_PREFIX)):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return JSONResponse(
                    {"error": "unauthorized", "error_description": "Bearer token required"},
                    status_code=401,
                )
            token = header[7:]
            try:
                claims = auth.decode_token(token)
            except jwt.ExpiredSignatureError:
                return JSONResponse(
                    {"error": "token_expired", "error_description": "Token has expired — re-authenticate"},
                    status_code=401,
                )
            except jwt.InvalidTokenError:
                return JSONResponse(
                    {"error": "invalid_token", "error_description": "Token is invalid"},
                    status_code=401,
                )
            set_request_credentials(
                api_key=claims["api_key"],
                waba_id=claims["waba_id"],
                esme_addr=claims["esme_addr"],
            )
        return await call_next(request)


@contextlib.asynccontextmanager
async def lifespan(app):
    async with http_app.router.lifespan_context(app):
        yield


async def health(request: Request) -> JSONResponse:
    return JSONResponse({
        "status": "ok",
        "auth": "enabled" if _auth_enabled() else "disabled",
    })


async def connect_page(request: Request) -> FileResponse:
    """GET /connect — serve the credential exchange UI."""
    return FileResponse(_CONNECT_HTML, media_type="text/html")


routes = [
    Route("/health",                              health,                   methods=["GET"]),
    Route("/connect",                             connect_page,             methods=["GET"]),
    Route("/connect/validate",                    auth.connect_validate,    methods=["POST"]),
    Route("/oauth/authorize",                     auth.authorize_endpoint,  methods=["GET"]),
    Route("/oauth/token",                         auth.token_endpoint,      methods=["POST"]),
    Route("/.well-known/oauth-authorization-server", auth.oauth_metadata,  methods=["GET"]),
    Route("/api/templates",                       rest.create_template_endpoint,      methods=["POST"]),
    Route("/api/templates/{template_id}",         rest.delete_template_endpoint,      methods=["DELETE"]),
    Route("/api/bulk-import",                     rest.bulk_import_endpoint,          methods=["POST"]),
    Route("/api/bulk-import/{job_id}",             rest.bulk_import_status_endpoint,   methods=["GET"]),
    *sse_app.routes,
    *http_app.routes,
]

app = Starlette(routes=routes, lifespan=lifespan)
app.add_middleware(AuthMiddleware)


def main():
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("MCP_PORT", "8001")))


if __name__ == "__main__":
    main()
