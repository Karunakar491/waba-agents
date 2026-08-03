"""Validates a Karix-shaped template payload BEFORE it's sent to the API.

Ported from karix-superagent's templateValidator.js — those rules were
learned from real Meta rejections (exact error_subcodes noted below), not
guessed from docs. Keep this in sync if Karix/Meta's rules change; don't
silently drop a rule because it looks redundant.

Returns {"valid": bool, "errors": [...], "warnings": [...]}.
"""

import re

VALID_CATEGORIES = ["AUTHENTICATION", "UTILITY", "MARKETING"]
VALID_HEADER_FORMATS = ["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]
VALID_BUTTON_TYPES = [
    "QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE", "OTP", "ORDER_DETAILS",
]
NAME_MAX = 512
BODY_MAX = 1024
AUTOFILL_TEXT_MAX = 25

_PLACEHOLDER_RE = re.compile(r"{{\s*(\w+)\s*}}")
_STARTS_WITH_VAR_RE = re.compile(r"^{{\s*\w+\s*}}")
_ENDS_WITH_VAR_RE = re.compile(r"{{\s*\w+\s*}}$")


def validate_template(spec: dict) -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    name = spec.get("template_name") or spec.get("name") or ""
    if not name:
        errors.append("template_name (or name) is required.")
    if len(name) > NAME_MAX:
        errors.append(f"template_name exceeds {NAME_MAX} characters (got {len(name)}).")
    if name and not re.fullmatch(r"[a-z0-9_]+", name):
        warnings.append("template_name should typically be lowercase letters, numbers, and underscores only.")

    if not spec.get("language"):
        errors.append("language is required (e.g. en, en_US, en_GB).")

    category = spec.get("category")
    if not category:
        errors.append("category is required.")
    elif category not in VALID_CATEGORIES:
        errors.append(
            f"category must be one of {', '.join(VALID_CATEGORIES)} (got \"{category}\"). "
            "Legacy values TRANSACTIONAL/OTP/MARKETING are auto-mapped by Karix, but prefer the new enum."
        )

    components = spec.get("components")
    if not isinstance(components, list) or not components:
        errors.append("components array is required and must not be empty.")
        return {"valid": False, "errors": errors, "warnings": warnings}

    body_count = 0

    for c in components:
        ctype = c.get("type")
        if ctype == "HEADER":
            fmt = c.get("format")
            if fmt and fmt not in VALID_HEADER_FORMATS:
                errors.append(f"HEADER format \"{fmt}\" is invalid. Must be one of {', '.join(VALID_HEADER_FORMATS)}.")
            if fmt == "TEXT" and not c.get("text"):
                errors.append("HEADER with format TEXT must include text.")
            if fmt in ("IMAGE", "VIDEO", "DOCUMENT"):
                handle = (c.get("example") or {}).get("header_handle")
                if not handle:
                    errors.append(
                        f"HEADER format {fmt} requires example.header_handle — "
                        "call upload_media() first and pass the returned handle here."
                    )

        elif ctype == "BODY":
            body_count += 1
            text = c.get("text")
            if not text:
                errors.append("BODY component must include text.")
            else:
                if len(text) > BODY_MAX:
                    errors.append(f"BODY text exceeds {BODY_MAX} characters (got {len(text)}).")
                placeholders = _PLACEHOLDER_RE.findall(text)
                if placeholders:
                    example = c.get("example") or {}
                    if not example.get("body_text") and not example.get("body_text_named_params"):
                        errors.append(
                            f"BODY text has placeholders ({', '.join(placeholders)}) but no \"example\" block. "
                            "Meta requires example values for every variable or the template will be rejected."
                        )
                    trimmed = text.strip()
                    # Confirmed by a real Meta rejection (error_subcode 2388299,
                    # "Variables can't be at the start or end of the template").
                    if _STARTS_WITH_VAR_RE.match(trimmed):
                        errors.append("BODY text cannot start with a variable placeholder — Meta requires real text before the first {{variable}}.")
                    if _ENDS_WITH_VAR_RE.search(trimmed):
                        errors.append("BODY text cannot end with a variable placeholder — Meta requires real text after the last {{variable}}.")

        elif ctype == "FOOTER":
            if not c.get("text"):
                errors.append("FOOTER component must include text.")

        elif ctype == "BUTTONS":
            buttons = c.get("buttons")
            if not isinstance(buttons, list) or not buttons:
                errors.append("BUTTONS component must include a non-empty buttons array.")
            else:
                for b in buttons:
                    btype = b.get("type")
                    if btype not in VALID_BUTTON_TYPES:
                        errors.append(f"Button type \"{btype}\" is invalid. Must be one of {', '.join(VALID_BUTTON_TYPES)}.")
                    if btype == "URL" and not b.get("url"):
                        errors.append("URL button must include a url.")
                    if btype == "URL" and b.get("url") and _PLACEHOLDER_RE.search(b["url"]) and not b.get("example"):
                        # Confirmed by a real Meta rejection (error_subcode 2388043,
                        # "component of type BUTTONS is missing expected field(s) (example)") —
                        # not documented in Karix's own docs at all.
                        errors.append(
                            f"URL button's url contains a variable but has no \"example\" array — add "
                            f"example: [\"<resolved sample URL>\"] (e.g. if url is "
                            f"\"https://example.com/track/{{{{1}}}}\", example could be "
                            f"[\"https://example.com/track/12345\"])."
                        )
                    if btype == "PHONE_NUMBER" and not b.get("phone_number"):
                        errors.append("PHONE_NUMBER button must include phone_number.")
                    if btype == "COPY_CODE" and not b.get("example"):
                        errors.append("COPY_CODE button must include an example code value.")
                if len(buttons) > 10:
                    warnings.append("More than 10 buttons is unusual — double check WhatsApp limits for this button mix.")

        elif ctype == "CAROUSEL":
            if not isinstance(c.get("cards"), list) or not c.get("cards"):
                errors.append("CAROUSEL component must include a non-empty cards array.")

        elif ctype in ("LIMITED_TIME_OFFER", "Limited_time_offer"):
            if not c.get("limited_time_offer") and not c.get("Limited_time_offer"):
                errors.append("LIMITED_TIME_OFFER component must include limited_time_offer.text.")

        else:
            warnings.append(f"Component type \"{ctype}\" is not one of the documented types — passing through as-is.")

    if body_count == 0:
        errors.append("At least one BODY component is required.")
    if body_count > 1:
        errors.append("Only one BODY component is allowed.")

    if category == "AUTHENTICATION":
        has_media = any(
            c.get("type") == "HEADER" and c.get("format") in ("IMAGE", "VIDEO", "DOCUMENT")
            for c in components
        )
        if has_media:
            errors.append("AUTHENTICATION templates cannot use a media header (Image/Video/Document).")

    for c in components:
        if c.get("type") == "BUTTONS" and isinstance(c.get("buttons"), list):
            for b in c["buttons"]:
                autofill = b.get("autofill_text")
                if autofill and len(autofill) > AUTOFILL_TEXT_MAX:
                    errors.append(f"Autofill button text exceeds {AUTOFILL_TEXT_MAX} characters.")

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
