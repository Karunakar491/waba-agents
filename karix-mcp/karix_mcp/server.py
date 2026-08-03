"""FastMCP server exposing Karix WhatsApp messaging as curated tools."""
import os

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

from karix_mcp.credentials import resolve_api_key, resolve_waba_id, resolve_sender_id, resolve_esme_addr
from karix_mcp.karix_client import KarixClient
from karix_mcp import builders, templates, template_ops, config

load_dotenv()

mcp = FastMCP("karix-messaging", host="0.0.0.0", port=config.MCP_PORT)


def _client() -> KarixClient:
    return KarixClient(
        send_base=config.SEND_BASE_URL,
        template_base=config.TEMPLATE_BASE_URL,
        api_key=resolve_api_key(),
        waba_id=resolve_waba_id(),
    )


def _sender() -> str:
    return resolve_sender_id()


# ── Account ──────────────────────────────────────────────────────────────────

@mcp.tool()
def get_sender_details() -> list:
    """List all WhatsApp sender IDs and WABA IDs on this account.

Call this before any send tool if you don't already know the sender_id.
Returns: [{"sender_id": "919...", "waba_id": "494..."}]
Pick the sender_id that matches the campaign context (e.g. the number
the customer recognises). Pass it implicitly — all send tools resolve
the sender automatically from the JWT credential."""
    import requests
    esme_addr = resolve_esme_addr()
    api_key = resolve_api_key()
    if not esme_addr:
        raise RuntimeError("ESME address not available — authenticate via /oauth/token")
    url = f"{config.TEMPLATE_BASE_URL}/api/v1.0/profile/getEsmeSenderMappingDetails"
    resp = requests.get(url,
                        headers={"Authentication": f"Bearer {api_key}", "Accept": "application/json"},
                        params={"esmeaddr": esme_addr, "channelId": "WABA"},
                        timeout=15)
    if resp.status_code >= 400:
        raise RuntimeError(f"Karix error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected response: {str(data)[:200]}")
    return [{"sender_id": str(r["sender_id"]), "waba_id": str(r["waba_id"])} for r in data]


# ── Templates ─────────────────────────────────────────────────────────────────

@mcp.tool()
def list_templates(status: str = "approved", search: str = "", language: str = "",
                   limit: int = 20) -> list:
    """List WhatsApp templates on this account.

status: 'approved' (default) | 'pending' | 'rejected'
search: filter by template name substring (optional)
language: filter by language code e.g. 'en' (optional)
limit: max results to return (default 20)

If more templates exist than the limit, the last item in the returned
list will be {"_note": "Results truncated..."} — increase limit or
add a search/status filter to narrow results.

Always call describe_template() before send_template_message() to get
the exact parameter count and sample values."""
    result = templates.list_templates(_client(), status=status or "approved",
                                      search=search or None, language=language or None,
                                      limit=limit)
    items = result["items"]
    if result["truncated"]:
        return items + [{"_note": f"Results truncated. Showing {result['total_fetched']} of more available. Use a smaller limit or filter by status."}]
    return items


@mcp.tool()
def describe_template(template_id: str) -> dict:
    """Get full details for one template including its parameter schema.

Returns the template's name, language, status, parameter count, and
example parameter values. Always call this before send_template_message
to know how many positional param_values to pass and what format they
expect (e.g. a name, a date, a currency amount)."""
    return templates.describe_template(_client(), template_id)


@mcp.tool()
def create_template(template_name: str, language: str, category: str, components: list) -> dict:
    """Submit a new WhatsApp template for Meta approval.

template_name: lowercase letters, numbers, underscores only (e.g. 'order_confirmation')
language: e.g. 'en', 'en_US'
category: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING'
components: list of component dicts, e.g.
  [{"type": "BODY", "text": "Hi {{1}}, your order shipped.",
    "example": {"body_text": [["John"]]}}]
  - Exactly one BODY component is required.
  - A variable ({{1}}) cannot be the first or last thing in BODY text —
    Meta rejects this (must have real text on both sides).
  - Any component with a variable needs an "example" with a resolved sample value.
  - AUTHENTICATION templates cannot have an IMAGE/VIDEO/DOCUMENT header.
  - IMAGE/VIDEO/DOCUMENT headers need example.header_handle — call the media
    upload flow first (not yet exposed as a tool; ask if you need this).

Validates locally before calling Karix — a validation failure returns
{"ok": False, "error": "...", "warnings": [...]} without ever hitting the
API, so it never burns your daily template-creation quota on a preventable
rejection.

Returns {"ok": True, "draft_id": ..., "karix_template_id": ..., "result": {...}}
on success, or {"ok": False, "draft_id": ..., "error": "..."} on failure —
draft_id lets you retry submission without re-entering the template."""
    payload = {
        "template_name": template_name,
        "language": language,
        "category": category,
        "components": components,
    }
    return template_ops.create_template(_client(), resolve_esme_addr(), resolve_waba_id(), payload)


@mcp.tool()
def delete_template(template_id: str) -> dict:
    """Delete a WhatsApp template by ID.

template_id: the templateId/sno from list_templates / describe_template.
This is irreversible — Karix does not support undeleting a template.

Returns {"ok": True, "result": {...}} on success or {"ok": False, "error": "..."}."""
    return template_ops.delete_template(_client(), template_id)


# ── Sending ───────────────────────────────────────────────────────────────────

@mcp.tool()
def send_template_message(to: str, template_id: str, param_values: list = None) -> dict:
    """Send an approved WhatsApp template message to a single recipient.

Works for cold outbound — does NOT require a 24-hour session window.
This is the only send tool that works outside an active customer session.

template_id: the templateId from list_templates / describe_template
param_values: positional list matching the template's parameter order.
  - Call describe_template() first to get the count and expected format.
  - Wrong param count returns {"ok": False, "error": "..."} — no message sent.

Returns {"ok": True, "result": {...}} on success or {"ok": False, "error": "..."} on failure."""
    client = _client()
    param_values = param_values or []
    desc = templates.describe_template(client, template_id)
    errors = templates.validate_param_values(desc, param_values)
    if errors:
        return {"ok": False, "error": errors[0]}
    body = builders.build_template(to=to, template_id=template_id,
                                   param_values=param_values, sender=_sender())
    return {"ok": True, "result": client.send_message(body)}


@mcp.tool()
def send_text_message(to: str, text: str) -> dict:
    """Send a free-form text message.

IMPORTANT: Only works inside the 24-hour customer session window
(i.e. the customer messaged you in the last 24 hours). Sending outside
this window will be rejected by WhatsApp. Use send_template_message
for cold outbound instead.

Returns {"ok": True, "result": {...}} on success."""
    body = builders.build_text(to=to, text=text, sender=_sender())
    return {"ok": True, "result": _client().send_message(body)}


@mcp.tool()
def send_media_message(to: str, kind: str, url: str, caption: str = "",
                       file_name: str = "") -> dict:
    """Send a media message (image, video, document, or audio).

IMPORTANT: Only works inside the 24-hour customer session window.

kind: 'image' | 'video' | 'document' | 'audio'
url: publicly accessible URL to the media file
caption: optional text shown below image/video (not supported for audio)
file_name: optional display filename shown for documents

Returns {"ok": True, "result": {...}} on success."""
    body = builders.build_media(to=to, kind=kind, url=url, sender=_sender(),
                                caption=caption or None, file_name=file_name or None)
    return {"ok": True, "result": _client().send_message(body)}


@mcp.tool()
def send_buttons_message(to: str, body_text: str, buttons: list,
                         header_text: str = "", footer_text: str = "") -> dict:
    """Send an interactive reply-buttons message (1–3 buttons).

IMPORTANT: Only works inside the 24-hour customer session window.

buttons: list of {"id": str, "title": str}
  - Maximum 3 buttons. More than 3 returns {"ok": False, "error": ...}.
  - Each title must be ≤20 characters. Longer titles return an error.
  - Each button must have both 'id' and 'title' keys.
header_text: optional bold header line above the body
footer_text: optional grey footer line below the buttons

Returns {"ok": True, "result": {...}} on success or {"ok": False, "error": "..."} on validation failure."""
    if not buttons or len(buttons) > 3:
        return {"ok": False, "error": "Provide 1–3 buttons"}
    for b in buttons:
        if not b.get("id") or not b.get("title"):
            return {"ok": False, "error": "Each button needs id and title"}
        if len(b["title"]) > 20:
            return {"ok": False, "error": f"Button title '{b['title']}' exceeds 20 chars"}
    body = builders.build_buttons(to=to, sender=_sender(), body_text=body_text,
                                  buttons=buttons,
                                  header_text=header_text or None,
                                  footer_text=footer_text or None)
    return {"ok": True, "result": _client().send_message(body)}


@mcp.tool()
def send_list_message(to: str, body_text: str, sections: list,
                      button_label: str = "Options",
                      header_text: str = "", footer_text: str = "") -> dict:
    """Send an interactive list-menu message (scrollable list of options).

IMPORTANT: Only works inside the 24-hour customer session window.

sections: list of section objects, each with a title and rows:
  [{"title": "Insurance Plans", "rows": [
      {"id": "1", "title": "Optima Secure", "description": "Best for families"},
      {"id": "2", "title": "Health Suraksha"}
  ]}]
  - Up to 10 sections, 10 rows each.
  - At least one section with rows is required.
button_label: text on the button that opens the list (default 'Options', max 20 chars)
header_text: optional bold header line
footer_text: optional grey footer line

Returns {"ok": True, "result": {...}} on success or {"ok": False, "error": "..."} on validation failure."""
    if not sections:
        return {"ok": False, "error": "Provide at least one section with rows"}
    body = builders.build_list(to=to, sender=_sender(), body_text=body_text,
                               sections=sections, button_label=button_label,
                               header_text=header_text or None,
                               footer_text=footer_text or None)
    return {"ok": True, "result": _client().send_message(body)}


@mcp.tool()
def send_cta_message(to: str, body_text: str, display_text: str, url: str,
                     header_text: str = "", footer_text: str = "") -> dict:
    """Send an interactive CTA (call-to-action) message with a clickable URL button.

IMPORTANT: Only works inside the 24-hour customer session window.

display_text: label shown on the button (e.g. 'Pay Now', 'View Policy')
url: destination URL — must start with http:// or https://
header_text: optional bold header line
footer_text: optional grey footer line

Returns {"ok": True, "result": {...}} on success or {"ok": False, "error": "..."} on validation failure."""
    if not url.startswith("http"):
        return {"ok": False, "error": "url must start with http/https"}
    body = builders.build_cta(to=to, sender=_sender(), body_text=body_text,
                              display_text=display_text, url=url,
                              header_text=header_text or None,
                              footer_text=footer_text or None)
    return {"ok": True, "result": _client().send_message(body)}


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
