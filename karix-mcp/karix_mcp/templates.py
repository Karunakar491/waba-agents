"""Template discovery + validation on top of the Karix client.

list_templates / describe_template return clean, token-efficient dicts.
validate_param_values checks the caller supplied the right number of values
before a send (positional parameterValues)."""


def normalize_template(raw: dict) -> dict:
    return {
        "name": raw.get("template_name"),
        "language": raw.get("language"),
        "category": raw.get("category"),
        "type": raw.get("template_type"),
        "placeholder_count": raw.get("template_place_holder_count", 0),
        "status": raw.get("template_create_status"),
    }


def list_templates(client, status: str = "approved", search: str = None,
                   language: str = None, limit: int = 20) -> dict:
    """Return templates with truncation metadata.

    Returns:
        {"items": [...], "truncated": bool, "total_fetched": int}
    """
    data = client.list_templates(status=status)
    items = (data.get("response") or {}).get("templates", []) or []
    out = []
    for raw in items:
        t = normalize_template(raw)
        if search and search.lower() not in (t["name"] or "").lower():
            continue
        if language and t["language"] != language:
            continue
        out.append(t)
        if len(out) >= limit + 1:
            break
    truncated = len(out) > limit
    if truncated:
        out = out[:limit]
    return {"items": out, "truncated": truncated, "total_fetched": len(out)}


def describe_template(client, name_or_id) -> dict:
    """Resolve a template by name (or sno/fb id) from the list endpoint.

    The single get-by-id route returns errorCode 1012 ("Template Not Found")
    for names, so we match within the full list, which already carries every
    field we need (placeholder count, components, status)."""
    data = client.list_templates()
    items = (data.get("response") or {}).get("templates", []) or []
    key = str(name_or_id)
    for raw in items:
        if key in (str(raw.get("template_name")), str(raw.get("sno")),
                   str(raw.get("fb_template_id"))):
            t = normalize_template(raw)
            t["components"] = raw.get("components", [])
            t["found"] = True
            return t
    return {"name": None, "language": None, "category": None, "type": None,
            "placeholder_count": 0, "status": None, "components": [], "found": False}


def validate_param_values(template_desc: dict, param_values: list) -> list:
    expected = template_desc.get("placeholder_count", 0) or 0
    got = len(param_values)
    if got != expected:
        return [f"template '{template_desc.get('name')}' expects {expected} "
                f"parameter value(s), got {got}"]
    return []
