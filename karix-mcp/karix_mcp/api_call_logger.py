"""Logs every outbound Karix API call to api_call_log (MySQL) — same job as
the Java platform's ApiCallLog/ApiCallLogRedactor/ApiCallLogWriter, for a
shared production dependency (Convogent/Claude Desktop call this service's
tools today).

Redaction is allowlist-style (key-name regex), matching ApiCallLogRedactor's
approach — never blanket-hide bodies, only obviously-secret fields.

Headers are NEVER logged, redacted or not — only method/path/status/
duration/body are ever passed to log_call(). Karix's Authentication header
carries the raw API key; the safest rule is that it's simply never part of
what gets logged, not "redacted from headers we do log."

log_call() must NEVER raise or block the real Karix call — this is
enforced HERE, once, so every call site (karix_client.py's _retry) gets it
for free rather than needing its own try/except.
"""

import json
import logging
import re

from karix_mcp import db
from karix_mcp.credentials import resolve_esme_addr

log = logging.getLogger(__name__)

# Mirrors ApiCallLogRedactor.java's regex, plus "authentication" explicitly —
# Karix's non-standard header name wouldn't match a generic "authorization"
# pattern, and a future payload field literally named "authentication"
# should redact the same way "authorization" would.
_SECRET_KEY_RE = re.compile(
    r"(?i)secret|token|password|authorization|authentication|api[_-]?key|"
    r"client[_-]?secret|client[_-]?key|private[_-]?key"
)
_MAX_BODY_LENGTH = 4000


def _redact(value):
    if isinstance(value, dict):
        return {
            k: ("[REDACTED]" if _SECRET_KEY_RE.search(str(k)) else _redact(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


def _to_logged_string(body) -> str | None:
    if body is None:
        return None
    try:
        redacted = _redact(body) if isinstance(body, (dict, list)) else body
        text = json.dumps(redacted) if isinstance(redacted, (dict, list)) else str(redacted)
    except Exception:
        text = "<unserializable>"
    return text[:_MAX_BODY_LENGTH]


def log_call(method: str, path: str, status_code: int | None, duration_ms: int,
             request_body=None, response_body=None, error: str = None) -> None:
    """Never raises — a failed audit write must not break the real Karix call."""
    try:
        esme_addr = resolve_esme_addr() or ""
        db.insert_api_call_log(
            esme_addr=esme_addr,
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            request_body=_to_logged_string(request_body),
            response_body=_to_logged_string(response_body),
            error=error[:2000] if error else None,
        )
    except Exception as exc:  # noqa: BLE001 — audit logging must never break the real call
        log.warning("api_call_log write failed (Karix call itself was unaffected): %s", exc)
