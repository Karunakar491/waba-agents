"""MySQL access for karix-mcp — drafts and bulk-import job tracking only.

No ORM, matching this codebase's thin-wrapper style elsewhere (karix_client.py).
One short-lived connection per call — this service's request volume doesn't
justify a pool yet; revisit if it becomes a bottleneck.
"""

import json
import os
import uuid
from contextlib import contextmanager
from datetime import datetime

import pymysql
import pymysql.cursors


def _connect():
    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        database=os.environ.get("MYSQL_DATABASE", "karix_mcp_db"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


@contextmanager
def cursor():
    conn = _connect()
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.utcnow()


# ── Template drafts ──────────────────────────────────────────────────────────

def create_draft(esme_addr: str, waba_id: str, template_name: str, payload: dict) -> str:
    draft_id = new_id()
    ts = now()
    with cursor() as cur:
        cur.execute(
            """INSERT INTO template_drafts
               (id, esme_addr, waba_id, template_name, payload_json, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, 'draft', %s, %s)""",
            (draft_id, esme_addr, waba_id, template_name, json.dumps(payload), ts, ts),
        )
    return draft_id


def get_draft(draft_id: str, esme_addr: str) -> dict | None:
    """Tenant-scoped lookup — a draft belonging to a different esme_addr never resolves."""
    with cursor() as cur:
        cur.execute(
            "SELECT * FROM template_drafts WHERE id = %s AND esme_addr = %s",
            (draft_id, esme_addr),
        )
        return cur.fetchone()


def mark_draft_submitted(draft_id: str, karix_template_id: str) -> None:
    with cursor() as cur:
        cur.execute(
            """UPDATE template_drafts
               SET status = 'submitted', karix_template_id = %s, updated_at = %s
               WHERE id = %s""",
            (karix_template_id, now(), draft_id),
        )


def mark_draft_failed(draft_id: str, error: str) -> None:
    with cursor() as cur:
        cur.execute(
            """UPDATE template_drafts
               SET status = 'submit_failed', submit_error = %s, updated_at = %s
               WHERE id = %s""",
            (error[:4000], now(), draft_id),
        )


# ── Bulk import jobs ─────────────────────────────────────────────────────────

def create_job(esme_addr: str, waba_id: str, filename: str, total_rows: int) -> str:
    job_id = new_id()
    ts = now()
    with cursor() as cur:
        cur.execute(
            """INSERT INTO bulk_import_jobs
               (id, esme_addr, waba_id, filename, status, total_rows, processed_rows, created_at, updated_at)
               VALUES (%s, %s, %s, %s, 'queued', %s, 0, %s, %s)""",
            (job_id, esme_addr, waba_id, filename, total_rows, ts, ts),
        )
    return job_id


def add_job_row(job_id: str, row_number: int, raw: dict) -> str:
    row_id = new_id()
    ts = now()
    with cursor() as cur:
        cur.execute(
            """INSERT INTO bulk_import_rows
               (id, job_id, `row_number`, raw_json, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, 'pending', %s, %s)""",
            (row_id, job_id, row_number, json.dumps(raw), ts, ts),
        )
    return row_id


def add_job_rows_batch(job_id: str, rows: list[dict]) -> list[str]:
    """One connection, one executemany — NOT one connection per row.

    EL-caught: for a multi-thousand-row sheet, inserting rows one at a time
    (each call opening its own pymysql connection) held the HTTP request
    open for the entire persistence phase before background processing ever
    started — exactly the synchronous bottleneck the async design was meant
    to avoid. Only the Karix-submission loop was backgrounded before; this
    makes the persistence phase itself fast enough to stay inline.
    """
    ts = now()
    row_ids = [new_id() for _ in rows]
    entries = [
        (row_ids[i], job_id, i + 1, json.dumps(raw), ts, ts)
        for i, raw in enumerate(rows)
    ]
    with cursor() as cur:
        cur.executemany(
            """INSERT INTO bulk_import_rows
               (id, job_id, `row_number`, raw_json, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, 'pending', %s, %s)""",
            entries,
        )
    return row_ids


def update_job_status(job_id: str, status: str, error: str = None) -> None:
    with cursor() as cur:
        cur.execute(
            "UPDATE bulk_import_jobs SET status = %s, error = %s, updated_at = %s WHERE id = %s",
            (status, error, now(), job_id),
        )


def increment_job_progress(job_id: str) -> None:
    with cursor() as cur:
        cur.execute(
            "UPDATE bulk_import_jobs SET processed_rows = processed_rows + 1, updated_at = %s WHERE id = %s",
            (now(), job_id),
        )


def update_row_result(row_id: str, status: str, errors: list = None, karix_template_id: str = None) -> None:
    with cursor() as cur:
        cur.execute(
            """UPDATE bulk_import_rows
               SET status = %s, errors_json = %s, karix_template_id = %s, updated_at = %s
               WHERE id = %s""",
            (status, json.dumps(errors) if errors else None, karix_template_id, now(), row_id),
        )


def get_job(job_id: str, esme_addr: str) -> dict | None:
    with cursor() as cur:
        cur.execute(
            "SELECT * FROM bulk_import_jobs WHERE id = %s AND esme_addr = %s",
            (job_id, esme_addr),
        )
        return cur.fetchone()


def get_job_rows(job_id: str) -> list[dict]:
    with cursor() as cur:
        cur.execute(
            "SELECT * FROM bulk_import_rows WHERE job_id = %s ORDER BY `row_number`",
            (job_id,),
        )
        return cur.fetchall()


# ── API call log ──────────────────────────────────────────────────────────

def insert_api_call_log(esme_addr: str, method: str, path: str, status_code, duration_ms: int,
                         request_body: str = None, response_body: str = None, error: str = None) -> None:
    with cursor() as cur:
        cur.execute(
            """INSERT INTO api_call_log
               (id, esme_addr, method, path, status_code, duration_ms, request_body, response_body, error, called_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (new_id(), esme_addr, method, path, status_code, duration_ms,
             request_body, response_body, error, now()),
        )


def get_api_call_logs(esme_addr: str) -> list[dict]:
    """Tenant-scoped read — used by tests today; a future ops-facing debug
    endpoint would reuse this rather than querying api_call_log directly."""
    with cursor() as cur:
        cur.execute(
            "SELECT * FROM api_call_log WHERE esme_addr = %s ORDER BY called_at",
            (esme_addr,),
        )
        return cur.fetchall()
