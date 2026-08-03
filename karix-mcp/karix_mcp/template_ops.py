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
