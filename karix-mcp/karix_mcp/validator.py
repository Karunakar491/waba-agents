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
                # AUTHENTICATION's BODY is just the Meta-generated code slot
                # ("{{1}}", no surrounding copy allowed — enforced below in
                # the AUTHENTICATION block) so the "real text before/after
                # the variable" rule below is a MARKETING/UTILITY-only rule.
                if placeholders and category != "AUTHENTICATION":
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
        # Real Meta structural rules for AUTHENTICATION (roadmap item 26,
        # MVP = OTP_COPY_CODE button variant only — ONE_TAP/ZERO_TAP deferred,
        # they need the client's Android package name + signing hash, which
        # this team can't test without a live Meta Business Account).
        #
        # Meta auto-generates the AUTHENTICATION body text/footer itself —
        # a caller can only supply the code placeholder, never freeform copy.
        if any(c.get("type") == "HEADER" for c in components):
            errors.append("AUTHENTICATION templates cannot have a HEADER component at all — Meta auto-generates the OTP body/footer text.")

        if any(c.get("type") == "FOOTER" for c in components):
            errors.append("AUTHENTICATION templates cannot have a FOOTER component — Meta appends its own expiry footer automatically.")

        for c in components:
            if c.get("type") == "BODY":
                body_text = (c.get("text") or "").strip()
                if body_text and body_text != "{{1}}":
                    errors.append(
                        "AUTHENTICATION BODY text is Meta-generated and cannot contain freeform copy — "
                        "it must be exactly the code placeholder \"{{1}}\" (or omitted entirely)."
                    )

        expiration = spec.get("code_expiration_minutes")
        if expiration is None:
            errors.append("AUTHENTICATION templates require a top-level code_expiration_minutes field (Meta default is 10).")
        elif not isinstance(expiration, int) or isinstance(expiration, bool) or not (1 <= expiration <= 90):
            errors.append("code_expiration_minutes must be an integer between 1 and 90.")

        buttons_components = [c for c in components if c.get("type") == "BUTTONS"]
        if len(buttons_components) != 1:
            errors.append("AUTHENTICATION templates require exactly one BUTTONS component.")
        else:
            otp_buttons = (buttons_components[0].get("buttons") or [])
            if len(otp_buttons) != 1:
                errors.append("AUTHENTICATION templates require exactly one button.")
            else:
                otp_button = otp_buttons[0]
                if otp_button.get("type") != "OTP":
                    errors.append("AUTHENTICATION templates require the button type to be \"OTP\" (got \"%s\")." % otp_button.get("type"))
                otp_type = otp_button.get("otp_type")
                if otp_type != "COPY_CODE":
                    if otp_type in ("ONE_TAP", "ZERO_TAP"):
                        errors.append(
                            "otp_type \"%s\" is not supported yet — only COPY_CODE has shipped (ONE_TAP/ZERO_TAP need the "
                            "client's Android package name + signing hash and are deferred, see roadmap item 26)." % otp_type
                        )
                    else:
                        errors.append("AUTHENTICATION OTP button requires otp_type \"COPY_CODE\" (got \"%s\")." % otp_type)

    for c in components:
        if c.get("type") == "BUTTONS" and isinstance(c.get("buttons"), list):
            for b in c["buttons"]:
                autofill = b.get("autofill_text")
                if autofill and len(autofill) > AUTOFILL_TEXT_MAX:
                    errors.append(f"Autofill button text exceeds {AUTOFILL_TEXT_MAX} characters.")

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
