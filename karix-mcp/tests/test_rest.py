"""HTTP-level tests for the Template Studio REST API (rest.py). Real MySQL
via Testcontainers, mocked Karix HTTP calls only — same pattern as
test_auth.py and test_bulk_import.py/test_template_ops.py."""

import io

import openpyxl
import pytest
from starlette.testclient import TestClient

from karix_mcp import auth, bulk_import
from karix_mcp.app import app


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def bearer_token(mock_karix_ok, valid_credentials):
    result = auth.issue_token(**valid_credentials)
    return result["access_token"]


@pytest.fixture
def auth_headers(bearer_token):
    return {"Authorization": f"Bearer {bearer_token}"}


def _workbook_bytes(headers, rows):
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


VALID_BODY = {
    "template_name": "order_shipped",
    "language": "en",
    "category": "UTILITY",
    "components": [{"type": "BODY", "text": "Your order has shipped."}],
}


class TestCreateTemplateEndpoint:
    def test_success(self, client, auth_headers, mocker):
        mocker.patch("requests.post", return_value=mocker.Mock(status_code=200, json=lambda: {"id": "karix-1"}))

        resp = client.post("/api/templates", json=VALID_BODY, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["karix_template_id"] == "karix-1"

    def test_missing_required_field_returns_400(self, client, auth_headers):
        body = {**VALID_BODY}
        del body["language"]
        resp = client.post("/api/templates", json=body, headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_request"

    def test_non_dict_body_returns_400_not_500(self, client, auth_headers):
        resp = client.post("/api/templates", content=b"[1,2,3]",
                            headers={**auth_headers, "Content-Type": "application/json"})
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_request"

    def test_validator_rejection_returns_422(self, client, auth_headers):
        # Variable at start of BODY text — real Meta rejection rule, not a
        # missing-field problem, so this must reach the validator (422),
        # not the earlier 400 missing-fields check.
        body = {**VALID_BODY, "components": [
            {"type": "BODY", "text": "{{1}}, your order shipped.", "example": {"body_text": [["x"]]}},
        ]}
        resp = client.post("/api/templates", json=body, headers=auth_headers)
        assert resp.status_code == 422
        assert resp.json()["ok"] is False

    def test_missing_auth_returns_401(self, client):
        resp = client.post("/api/templates", json=VALID_BODY)
        assert resp.status_code == 401

    def test_credential_resolution_failure_returns_401_not_500(self, client, auth_headers, mocker):
        mocker.patch("karix_mcp.rest.resolve_esme_addr", side_effect=RuntimeError("KARIX_ESME_ADDR is not set."))
        resp = client.post("/api/templates", json=VALID_BODY, headers=auth_headers)
        assert resp.status_code == 401
        assert resp.json()["error"] == "unauthorized"


class TestDeleteTemplateEndpoint:
    def test_success(self, client, auth_headers, mocker):
        mocker.patch("requests.delete", return_value=mocker.Mock(status_code=200, text="{}", json=lambda: {}))
        resp = client.delete("/api/templates/template-1", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_karix_failure_returns_502_not_500(self, client, auth_headers, mocker):
        mocker.patch("requests.delete", return_value=mocker.Mock(status_code=404, text="not found"))
        resp = client.delete("/api/templates/template-1", headers=auth_headers)
        assert resp.status_code == 502
        assert resp.json()["ok"] is False


class TestBulkImportEndpoints:
    @pytest.fixture(autouse=True)
    def no_rate_limit_pacing(self, monkeypatch):
        monkeypatch.setattr(bulk_import, "_MIN_GAP_SECONDS", 0)

    def test_upload_returns_202_then_status_reflects_completion(self, client, auth_headers, mocker):
        mocker.patch("requests.post", return_value=mocker.Mock(status_code=200, json=lambda: {"id": "karix-9"}))
        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Your order shipped."]],
        )
        resp = client.post("/api/bulk-import", headers=auth_headers,
                            files={"file": ("sheet.xlsx", data,
                                             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        bulk_import._futures[job_id].result(timeout=10)

        status_resp = client.get(f"/api/bulk-import/{job_id}", headers=auth_headers)
        assert status_resp.status_code == 200
        body = status_resp.json()
        assert body["job"]["status"] == "completed"
        assert body["rows"][0]["status"] == "submitted"

    def test_missing_file_returns_400(self, client, auth_headers):
        resp = client.post("/api/bulk-import", headers=auth_headers, files={})
        assert resp.status_code == 400

    def test_status_for_unknown_job_returns_404(self, client, auth_headers):
        resp = client.get("/api/bulk-import/does-not-exist", headers=auth_headers)
        assert resp.status_code == 404

    def test_status_scoped_to_tenant_returns_404_for_other_esme_addr(self, client, auth_headers, mocker, mock_karix_ok):
        mocker.patch("requests.post", return_value=mocker.Mock(status_code=200, json=lambda: {"id": "karix-x"}))
        data = _workbook_bytes(
            ["template_name", "category", "language", "body_text"],
            [["order_shipped", "UTILITY", "en", "Your order shipped."]],
        )
        resp = client.post("/api/bulk-import", headers=auth_headers,
                            files={"file": ("sheet.xlsx", data,
                                             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        job_id = resp.json()["job_id"]
        bulk_import._futures[job_id].result(timeout=10)

        # A different tenant's token (different esme_addr) must not see this job.
        other_token = auth.issue_token(esme_addr="someone_else", api_key="key", waba_id="waba2")["access_token"]
        other_resp = client.get(f"/api/bulk-import/{job_id}",
                                 headers={"Authorization": f"Bearer {other_token}"})
        assert other_resp.status_code == 404
