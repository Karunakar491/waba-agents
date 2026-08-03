"""Bulk template import from an Excel sheet.

v1 SCOPE LIMITATION (deliberate, not silently dropped): karix-superagent's
bulk import uses an LLM to normalize arbitrary free-text columns into a
Karix template spec. This version uses a FIXED column format instead —
no AI dependency added to a service that doesn't have one today. If free-
text/arbitrary-column tolerance is needed later, add an AI normalization
step in front of row_to_template_spec() without changing anything downstream.

Expected columns (header row required, case-insensitive):
    template_name | category | language | header_type | header_text |
    body_text | variable_examples | footer |
    button_1_type | button_1_label | button_1_value |
    button_2_type | button_2_label | button_2_value

body_text may contain {{1}}, {{2}}... placeholders directly — the sheet
author writes them the same way they'd appear in the final template.
variable_examples is a comma-separated list of example values, in order,
matching the placeholders (e.g. "John,12345" for {{1}},{{2}}).
"""

import os
import time
from concurrent.futures import Future, ThreadPoolExecutor

import openpyxl

from karix_mcp import db, validator
from karix_mcp.karix_client import KarixClient, KarixError

# Karix caps template creation at 100/hour per WABA. Stay under it with
# margin the same way karix-superagent does, so a large sheet from one
# client can't starve every other submission on the same WABA that hour.
_MIN_GAP_SECONDS = 3600 / 90

# EL-caught: an unbounded thread-per-job with db.py opening a fresh
# connection per statement cannot ship on a shared production service
# (Convogent/Claude Desktop already depend on this process) — 50 concurrent
# uploads is a realistic load, not hypothetical, and would churn far more
# simultaneous MySQL connections than max_connections typically allows,
# with no queueing or backpressure. A bounded pool means the 6th+
# concurrent job queues instead of piling on more connections.
_executor = ThreadPoolExecutor(
    max_workers=int(os.environ.get("BULK_IMPORT_MAX_CONCURRENT_JOBS", "5")),
    thread_name_prefix="bulk-import",
)

# job_id -> Future, so tests (and any future cancel/status-check code) can
# observe completion without reaching into ThreadPoolExecutor internals.
_futures: dict[str, Future] = {}


def parse_workbook(file_bytes: bytes) -> list[dict]:
    """Reads the first sheet's rows into a list of {header: value} dicts.
    Only .xlsx is supported (openpyxl) — not legacy .xls."""
    from io import BytesIO
    wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    sheet = wb.worksheets[0]
    rows_iter = sheet.iter_rows(values_only=True)
    headers = [str(h).strip().lower() if h else "" for h in next(rows_iter)]
    rows = []
    for raw_row in rows_iter:
        if all(cell is None for cell in raw_row):
            continue
        rows.append({headers[i]: raw_row[i] for i in range(len(headers)) if i < len(raw_row)})
    return rows


def row_to_template_spec(row: dict) -> dict:
    """Deterministically map one spreadsheet row to a Karix template payload."""
    components = []

    header_type = (row.get("header_type") or "").strip().upper()
    header_text = row.get("header_text")
    if header_type == "TEXT" and header_text:
        components.append({"type": "HEADER", "format": "TEXT", "text": str(header_text)})
    elif header_type in ("IMAGE", "VIDEO", "DOCUMENT"):
        # Media headers need example.header_handle from a prior media upload —
        # bulk sheets can't provide that inline; flag rather than guess.
        components.append({"type": "HEADER", "format": header_type})

    body_text = str(row.get("body_text") or "")
    body_component = {"type": "BODY", "text": body_text}
    examples_raw = row.get("variable_examples")
    if examples_raw:
        values = [v.strip() for v in str(examples_raw).split(",") if v.strip()]
        if values:
            body_component["example"] = {"body_text": [values]}
    components.append(body_component)

    footer = row.get("footer")
    if footer:
        components.append({"type": "FOOTER", "text": str(footer)})

    buttons = []
    for i in (1, 2):
        btype = (row.get(f"button_{i}_type") or "").strip().upper()
        label = row.get(f"button_{i}_label")
        value = row.get(f"button_{i}_value")
        if not btype:
            continue
        button = {"type": btype, "title": str(label) if label else ""}
        if btype == "URL":
            button["url"] = str(value) if value else ""
        elif btype == "PHONE_NUMBER":
            button["phone_number"] = str(value) if value else ""
        elif btype == "QUICK_REPLY":
            button["id"] = str(value or label or i)
        buttons.append(button)
    if buttons:
        components.append({"type": "BUTTONS", "buttons": buttons})

    return {
        "template_name": str(row.get("template_name") or "").strip(),
        "language": str(row.get("language") or "").strip(),
        "category": str(row.get("category") or "").strip().upper(),
        "components": components,
    }


def start_job(client: KarixClient, esme_addr: str, waba_id: str, filename: str, file_bytes: bytes) -> dict:
    """Parses the sheet, persists the job + rows, and kicks off background
    processing. Returns immediately — per EM's condition, bulk import must
    never hold a synchronous HTTP connection for the full run."""
    rows = parse_workbook(file_bytes)
    if not rows:
        raise ValueError("no_rows_found")

    job_id = db.create_job(esme_addr, waba_id, filename, len(rows))
    row_ids = db.add_job_rows_batch(job_id, rows)

    # Job status is durably read from MySQL (db.get_job), not from _futures —
    # the Future only exists so tests (and any future cancel/observe code)
    # can await completion without polling. Purge entries finished by a
    # PRIOR call before adding this one, so this dict doesn't grow forever
    # on a long-running shared service. Deliberately NOT an immediate
    # done-callback: that would race a fast job's own completion against a
    # caller that hasn't looked it up in _futures yet.
    for jid in [j for j, f in _futures.items() if f.done()]:
        _futures.pop(jid, None)

    future = _executor.submit(_process_job, job_id, client, list(zip(row_ids, rows)))
    _futures[job_id] = future
    return {"job_id": job_id, "total_rows": len(rows), "status": "queued"}


def _process_job(job_id: str, client: KarixClient, rows: list[tuple[str, dict]]) -> None:
    db.update_job_status(job_id, "processing")
    try:
        for row_id, raw_row in rows:
            started = time.monotonic()
            spec = row_to_template_spec(raw_row)
            check = validator.validate_template(spec)
            if not check["valid"]:
                db.update_row_result(row_id, "invalid", errors=check["errors"])
            else:
                try:
                    result = client.create_template(spec)
                    karix_id = str(result.get("id") or result.get("template_id") or result.get("sno") or "")
                    db.update_row_result(row_id, "submitted", karix_template_id=karix_id)
                except KarixError as exc:
                    db.update_row_result(row_id, "submit_failed", errors=[str(exc)])
            db.increment_job_progress(job_id)

            elapsed = time.monotonic() - started
            if elapsed < _MIN_GAP_SECONDS:
                time.sleep(_MIN_GAP_SECONDS - elapsed)
        db.update_job_status(job_id, "completed")
    except Exception as exc:  # noqa: BLE001 — a background thread has no caller to propagate to
        db.update_job_status(job_id, "failed", error=str(exc)[:4000])
