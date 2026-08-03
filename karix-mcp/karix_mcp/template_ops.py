"""Shared template-creation/deletion logic — called by BOTH the MCP tools
(server.py) and the REST layer (rest.py). One implementation, two doors in,
so a UI built on the REST API and an agent calling the MCP tool can never
observe different behavior for the same operation.
"""

from karix_mcp import db, validator
from karix_mcp.karix_client import KarixClient, KarixError


def create_template(client: KarixClient, esme_addr: str, waba_id: str, payload: dict) -> dict:
    """Validate, persist as a draft, submit to Karix, record the outcome.

    Returns {"ok": True, "draft_id": ..., "karix_template_id": ..., "result": {...}}
    or {"ok": False, "draft_id": ..., "error": "..."} — draft_id is always
    present once validation passes, so a failed submission can be retried
    without re-entering the whole template.
    """
    check = validator.validate_template(payload)
    if not check["valid"]:
        return {"ok": False, "draft_id": None, "error": "; ".join(check["errors"]), "warnings": check["warnings"]}

    name = payload.get("template_name") or payload.get("name") or ""
    draft_id = db.create_draft(esme_addr, waba_id, name, payload)

    try:
        result = client.create_template(payload)
    except KarixError as exc:
        db.mark_draft_failed(draft_id, str(exc))
        return {"ok": False, "draft_id": draft_id, "error": str(exc), "warnings": check["warnings"]}

    karix_template_id = str(result.get("id") or result.get("template_id") or result.get("sno") or "")
    db.mark_draft_submitted(draft_id, karix_template_id)
    return {"ok": True, "draft_id": draft_id, "karix_template_id": karix_template_id,
            "result": result, "warnings": check["warnings"]}


def delete_template(client: KarixClient, template_id: str) -> dict:
    """Delete a template by ID. Templates are live-sourced from Karix — there's
    no local row to clean up here, only the remote call."""
    try:
        result = client.delete_template(template_id)
    except KarixError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "result": result}


def list_templates(client: KarixClient, status: str = None, date_from: str = None, date_to: str = None) -> dict:
    """List templates live from Karix — no local cache, so status/rejection
    reason is always current, never stale relative to what Meta actually
    decided."""
    try:
        result = client.list_templates(status=status, date_from=date_from, date_to=date_to)
    except KarixError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "result": result}


def get_template(client: KarixClient, template_id: str) -> dict:
    try:
        result = client.get_template(template_id)
    except KarixError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "result": result}


def edit_template(client: KarixClient, template_id: str, payload: dict) -> dict:
    """Edit replaces components entirely. Not pre-validated with
    validator.validate_template() — that validator requires template_name/
    language/category, which an edit payload doesn't carry (Karix's edit
    endpoint only takes components). Karix's own API enforces component
    rules on edit and returns a real error we surface as-is — no local
    duplicate of those rules for a payload shape validate_template wasn't
    built for."""
    components = payload.get("components")
    if not isinstance(components, list) or not components:
        return {"ok": False, "error": "components array is required and must not be empty."}

    try:
        result = client.edit_template(
            template_id,
            components,
            alt_temp_body=payload.get("alt_temp_body"),
            edit_alt_body=payload.get("edit_alt_body"),
            allow_category_change=payload.get("allow_category_change", True),
        )
    except KarixError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "result": result}


def upload_media(client: KarixClient, file_bytes: bytes, filename: str, mime_type: str, category: str) -> dict:
    try:
        result = client.upload_media(file_bytes, filename, mime_type, category)
    except (KarixError, ValueError) as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "result": result}
