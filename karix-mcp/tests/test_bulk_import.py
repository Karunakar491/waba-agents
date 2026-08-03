"""Tests for karix_mcp.bulk_import — row mapping, workbook parsing, and the
background job pipeline (real MySQL via Testcontainers, mocked Karix client
— the database is never mocked, only the external network boundary)."""

import io

import openpyxl
import pytest

from karix_mcp import bulk_import, db
from karix_mcp.karix_client import KarixError


def _workbook_bytes(headers: list[str], rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class TestRowToTemplateSpec:
    def test_maps_basic_fields(self):
        row = {"template_name": "order_shipped", "category": "utility", "language": "en",
               "body_text": "Your order has shipped.", "header_type": "", "header_text": "",
               "footer": "", "variable_examples": ""}
        spec = bulk_import.row_to_template_spec(row)
        assert spec["template_name"] == "order_shipped"
        assert spec["category"] == "UTILITY"
        assert spec["language"] == "en"
        body = next(c for c in spec["components"] if c["type"] == "BODY")
        assert body["text"] == "Your order has shipped."

    def test_maps_variable_examples_into_body_example(self):
        row = {"template_name": "x", "category": "utility", "language": "en",
               "body_text": "Hi {{1}}, your order {{2}} has shipped.",
               "variable_examples": "John, 12345"}
        spec = bulk_import.row_to_template_spec(row)
        body = next(c for c in spec["components"] if c["type"] == "BODY")
        assert body["example"]["body_text"] == [["John", "12345"]]

    def test_maps_text_header(self):
        row = {"template_name": "x", "category": "utility", "language": "en",
               "body_text": "Hello.", "header_type": "text", "header_text": "Order Update"}
        spec = bulk_import.row_to_template_spec(row)
        header = next(c for c in spec["components"] if c["type"] == "HEADER")
        assert header["format"] == "TEXT"
        assert header["text"] == "Order Update"

    def test_maps_footer(self):
        row = {"template_name": "x", "category": "utility", "language": "en",
               "body_text": "Hello.", "footer": "Thanks for shopping with us"}
        spec = bulk_import.row_to_template_spec(row)
        footer = next(c for c in spec["components"] if c["type"] == "FOOTER")
        assert footer["text"] == "Thanks for shopping with us"

    def test_maps_url_button(self):
        row = {"template_name": "x", "category": "utility", "language": "en",
               "body_text": "Track below.", "button_1_type": "url",
               "button_1_label": "Track Order", "button_1_value": "https://example.com/track"}
        spec = bulk_import.row_to_template_spec(row)
        buttons_comp = next(c for c in spec["components"] if c["type"] == "BUTTONS")
        assert buttons_comp["buttons"][0]["url"] == "https://example.com/track"
        assert buttons_comp["buttons"][0]["title"] == "Track Order"

    def test_maps_phone_button(self):
        row = {"template_name": "x", "category": "utility", "language": "en",
               "body_text": "Call us.", "button_1_type": "phone_number",
               "button_1_label": "Call", "button_1_value": "919152004195"}
        spec = bulk_import.row_to_template_spec(row)
        buttons_comp = next(c for c in spec["components"] if c["type"] == "BUTTONS")
        assert buttons_comp["buttons"][0]["phone_number"] == "919152004195"

    def test_no_button_columns_produces_no_buttons_component(self):
        row = {"template_name": "x", "category": "utility", "language": "en", "body_text": "Hello."}
        spec = bulk_import.row_to_template_spec(row)
        assert not any(c["type"] == "BUTTONS" for c in spec["components"])


class TestParseWorkbook:
    def test_parses_headers_and_rows(self):
        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Your order shipped."]],
        )
        rows = bulk_import.parse_workbook(data)
        assert len(rows) == 1
        assert rows[0]["template_name"] == "order_shipped"

    def test_skips_fully_blank_rows(self):
        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Shipped."], [None, None, None, None]],
        )
        rows = bulk_import.parse_workbook(data)
        assert len(rows) == 1

    def test_headers_are_lowercased(self):
        data = _workbook_bytes(["Template_Name", "Category"], [["x", "UTILITY"]])
        rows = bulk_import.parse_workbook(data)
        assert "template_name" in rows[0]


class TestJobPipeline:
    """Real MySQL (via conftest's mysql_container/mysql_env fixtures) —
    only the Karix HTTP client is mocked, matching this project's own EL
    bar: never mock the database, only the external network boundary."""

    @pytest.fixture(autouse=True)
    def no_rate_limit_pacing(self, monkeypatch):
        monkeypatch.setattr(bulk_import, "_MIN_GAP_SECONDS", 0)

    def _await_job(self, job_id, timeout=10):
        bulk_import._futures[job_id].result(timeout=timeout)

    def test_start_job_creates_job_and_rows_then_processes_in_background(self, mocker):
        client = mocker.Mock()
        client.create_template.return_value = {"id": "karix-template-1"}

        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Your order shipped."]],
        )
        result = bulk_import.start_job(client, "esme1", "waba1", "sheet.xlsx", data)

        assert result["total_rows"] == 1
        assert result["status"] == "queued"
        self._await_job(result["job_id"])

        job = db.get_job(result["job_id"], "esme1")
        assert job["status"] == "completed"
        assert job["processed_rows"] == 1

        rows = db.get_job_rows(result["job_id"])
        assert len(rows) == 1
        assert rows[0]["status"] == "submitted"
        assert rows[0]["karix_template_id"] == "karix-template-1"

    def test_invalid_row_recorded_without_calling_karix(self, mocker):
        client = mocker.Mock()

        # Missing body_text — validator will reject this row.
        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["bad_template", "UTILITY", "en", ""]],
        )
        result = bulk_import.start_job(client, "esme1", "waba1", "sheet.xlsx", data)
        self._await_job(result["job_id"])

        client.create_template.assert_not_called()
        rows = db.get_job_rows(result["job_id"])
        assert rows[0]["status"] == "invalid"

    def test_karix_error_marks_row_submit_failed(self, mocker):
        client = mocker.Mock()
        client.create_template.side_effect = KarixError("Karix rejected it")

        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Your order shipped."]],
        )
        result = bulk_import.start_job(client, "esme1", "waba1", "sheet.xlsx", data)
        self._await_job(result["job_id"])

        rows = db.get_job_rows(result["job_id"])
        assert rows[0]["status"] == "submit_failed"

    def test_no_rows_raises_value_error(self, mocker):
        client = mocker.Mock()
        data = _workbook_bytes(["template_name", "category", "language", "body_text"], [])
        with pytest.raises(ValueError):
            bulk_import.start_job(client, "esme1", "waba1", "sheet.xlsx", data)

    def test_job_scoped_to_tenant_esme_addr(self, mocker):
        client = mocker.Mock()
        client.create_template.return_value = {"id": "karix-template-2"}
        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Your order shipped."]],
        )
        result = bulk_import.start_job(client, "esme_owner", "waba1", "sheet.xlsx", data)
        self._await_job(result["job_id"])

        assert db.get_job(result["job_id"], "esme_owner") is not None
        assert db.get_job(result["job_id"], "someone_else") is None
