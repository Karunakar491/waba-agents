"""Message body builders for the Karix RCM sendMessage API."""


def _base(to: str, sender: str, content: dict) -> dict:
    return {
        "message": {
            "channel": "WABA",
            "content": content,
            "recipient": {"to": to, "recipient_type": "individual"},
            "sender": {"from": sender},
        },
        "metaData": {"version": "v1.0.9"},
    }


def build_text(to: str, text: str, sender: str) -> dict:
    return _base(to, sender, {"type": "TEXT", "text": text})


def build_template(to: str, template_id: str, param_values: list, sender: str) -> dict:
    pv = {str(i): v for i, v in enumerate(param_values)}
    return _base(to, sender, {
        "type": "TEMPLATE",
        "template": {"templateId": template_id, "parameterValues": pv},
    })


def build_media(to: str, kind: str, url: str, sender: str,
                caption: str = None, file_name: str = None) -> dict:
    att = {"type": kind.upper(), "url": url}
    if caption:
        att["caption"] = caption
    if file_name:
        att["fileName"] = file_name
    return _base(to, sender, {"type": "ATTACHMENT", "attachment": att})


def build_buttons(to: str, sender: str, body_text: str, buttons: list,
                  header_text: str = None, footer_text: str = None) -> dict:
    """Interactive reply-buttons message (max 3 buttons).
    buttons = [{"id": "1", "title": "Yes"}, ...]
    """
    interactive = {
        "type": "button",
        "body": {"text": body_text},
        "action": {
            "buttons": [
                {"type": "reply", "reply": {"id": b["id"], "title": b["title"]}}
                for b in buttons[:3]
            ]
        },
    }
    if header_text:
        interactive["header"] = {"type": "text", "text": header_text}
    if footer_text:
        interactive["footer"] = {"text": footer_text}
    return _base(to, sender, {"type": "INTERACTIVE", "interactive": interactive})


def build_list(to: str, sender: str, body_text: str, sections: list,
               button_label: str = "Options",
               header_text: str = None, footer_text: str = None) -> dict:
    """Interactive list-menu message.
    sections = [{"title": "Plans", "rows": [{"id": "1", "title": "Optima Secure", "description": "..."}]}]
    """
    interactive = {
        "type": "list",
        "body": {"text": body_text},
        "action": {"button": button_label, "sections": sections},
    }
    if header_text:
        interactive["header"] = {"type": "text", "text": header_text}
    if footer_text:
        interactive["footer"] = {"text": footer_text}
    return _base(to, sender, {"type": "INTERACTIVE", "interactive": interactive})


def build_cta(to: str, sender: str, body_text: str, display_text: str, url: str,
              header_text: str = None, footer_text: str = None) -> dict:
    """Interactive CTA URL button message."""
    interactive = {
        "type": "cta_url",
        "body": {"text": body_text},
        "action": {
            "name": "cta_url",
            "parameters": {"display_text": display_text, "url": url},
        },
    }
    if header_text:
        interactive["header"] = {"type": "text", "text": header_text}
    if footer_text:
        interactive["footer"] = {"text": footer_text}
    return _base(to, sender, {"type": "INTERACTIVE", "interactive": interactive})
