"""REST API for Template Studio (the new UI) — calls the SAME functions as
the MCP tools in server.py, via template_ops.py and bulk_import.py. This is
what keeps UI and MCP behavior from drifting apart.

Auth: gated by AuthMiddleware in app.py exactly like /sse and /mcp — same
Bearer JWT, same credential resolution. Not exposed to the browser directly
in production (the platform's Java backend proxies these per the EM
condition) but usable standalone for local/dev testing.
"""

import json
from datetime import datetime

from starlette.requests import Request
from starlette.responses import JSONResponse

from karix_mcp import config, db, template_ops, bulk_import
from karix_mcp.credentials import resolve_api_key, resolve_waba_id, resolve_esme_addr
from karix_mcp.karix_client import KarixClient

# JSON columns come back from pymysql as text; datetime columns as
# datetime objects — neither is directly JSON-serializable via JSONResponse.
_JSON_FIELDS = {"payload_json", "errors_json", "raw_json"}


def _serialize_row(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif k in _JSON_FIELDS and isinstance(v, str):
            try:
                out[k] = json.loads(v)
            except ValueError:
                out[k] = v
        else:
            out[k] = v
    return out


def _client() -> KarixClient:
    return KarixClient(
        send_base=config.SEND_BASE_URL,
        template_base=config.TEMPLATE_BASE_URL,
        api_key=resolve_api_key(),
        waba_id=resolve_waba_id(),
    )


def _credential_error_response(exc: RuntimeError) -> JSONResponse:
    """resolve_api_key()/resolve_waba_id()/resolve_esme_addr() raise plain
    RuntimeError (credentials.py's _require_env) when no JWT credential is
    in context and no env fallback is configured — that's a client auth
    problem, not a server crash. Matches auth.AuthError.to_response()'s shape
    so callers get one consistent error format from this service."""
    return JSONResponse({"error": "unauthorized", "error_description": str(exc)}, status_code=401)


async def create_template_endpoint(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_request", "error_description": "Expected JSON body"}, status_code=400)

    if not isinstance(body, dict):
        return JSONResponse({"error": "invalid_request", "error_description": "Body must be a JSON object"}, status_code=400)

    required = ["template_name", "language", "category", "components"]
    missing = [f for f in required if not body.get(f)]
    if missing:
        return JSONResponse(
            {"error": "invalid_request", "error_description": f"Missing: {missing}"}, status_code=400,
        )

    try:
        client = _client()
        esme_addr = resolve_esme_addr()
        waba_id = resolve_waba_id()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    result = template_ops.create_template(client, esme_addr, waba_id, body)
    status = 200 if result["ok"] else 422
    return JSONResponse(result, status_code=status)


async def delete_template_endpoint(request: Request) -> JSONResponse:
    template_id = request.path_params["template_id"]
    try:
        client = _client()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    result = template_ops.delete_template(client, template_id)
    return JSONResponse(result, status_code=200 if result["ok"] else 502)


async def list_templates_endpoint(request: Request) -> JSONResponse:
    try:
        client = _client()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    result = template_ops.list_templates(
        client,
        status=request.query_params.get("status"),
        date_from=request.query_params.get("from"),
        date_to=request.query_params.get("to"),
    )
    return JSONResponse(result, status_code=200 if result["ok"] else 502)


async def get_template_endpoint(request: Request) -> JSONResponse:
    template_id = request.path_params["template_id"]
    try:
        client = _client()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    result = template_ops.get_template(client, template_id)
    return JSONResponse(result, status_code=200 if result["ok"] else 502)


async def edit_template_endpoint(request: Request) -> JSONResponse:
    template_id = request.path_params["template_id"]
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_request", "error_description": "Expected JSON body"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "invalid_request", "error_description": "Body must be a JSON object"}, status_code=400)

    try:
        client = _client()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    result = template_ops.edit_template(client, template_id, body)
    status = 200 if result["ok"] else 422
    return JSONResponse(result, status_code=status)


async def upload_media_endpoint(request: Request) -> JSONResponse:
    form = await request.form()
    upload = form.get("file")
    category = form.get("category")
    if upload is None or not category:
        return JSONResponse(
            {"error": "invalid_request", "error_description": "file and category are required"}, status_code=400,
        )

    file_bytes = await upload.read()
    try:
        client = _client()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    result = template_ops.upload_media(
        client, file_bytes, upload.filename, upload.content_type or "application/octet-stream", category,
    )
    return JSONResponse(result, status_code=200 if result["ok"] else 422)


async def bulk_import_endpoint(request: Request) -> JSONResponse:
    form = await request.form()
    upload = form.get("file")
    if upload is None:
        return JSONResponse({"error": "invalid_request", "error_description": "file is required"}, status_code=400)

    file_bytes = await upload.read()
    try:
        client = _client()
        esme_addr = resolve_esme_addr()
        waba_id = resolve_waba_id()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    try:
        result = bulk_import.start_job(client, esme_addr, waba_id, upload.filename, file_bytes)
    except ValueError as exc:
        return JSONResponse({"error": "invalid_request", "error_description": str(exc)}, status_code=400)
    except Exception as exc:  # noqa: BLE001 — malformed workbook, unexpected format, etc.
        return JSONResponse({"error": "invalid_request", "error_description": f"Could not read file: {exc}"}, status_code=400)

    return JSONResponse(result, status_code=202)


async def bulk_import_status_endpoint(request: Request) -> JSONResponse:
    job_id = request.path_params["job_id"]
    try:
        esme_addr = resolve_esme_addr()
    except RuntimeError as exc:
        return _credential_error_response(exc)

    job = db.get_job(job_id, esme_addr)
    if job is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    rows = db.get_job_rows(job_id)
    job_out = _serialize_row(job)
    job_out.pop("esme_addr", None)
    rows_out = []
    for r in rows:
        r_out = _serialize_row(r)
        r_out.pop("job_id", None)
        rows_out.append(r_out)
    return JSONResponse({"job": job_out, "rows": rows_out})
