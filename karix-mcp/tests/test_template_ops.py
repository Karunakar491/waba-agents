"""Tests for karix_mcp.template_ops — the shared logic both the MCP tools
and the REST endpoints call. Real MySQL via Testcontainers (see conftest.py)
— only the Karix HTTP client is mocked. Covers the paths EL flagged as easy
to get wrong: validation-failure-before-any-remote-call, and a draft
surviving a Karix-side failure so it can be retried."""

from karix_mcp import db, template_ops
from karix_mcp.karix_client import KarixError

VALID_PAYLOAD = {
    "template_name": "order_shipped",
    "language": "en",
    "category": "UTILITY",
    "components": [{"type": "BODY", "text": "Your order has shipped."}],
}


class TestCreateTemplate:
    def test_validation_failure_never_calls_karix_or_persists_draft(self, mocker):
        client = mocker.Mock()
        invalid_payload = {**VALID_PAYLOAD, "components": []}

        result = template_ops.create_template(client, "esme1", "waba1", invalid_payload)

        assert result["ok"] is False
        assert result["draft_id"] is None
        client.create_template.assert_not_called()

    def test_success_persists_draft_then_marks_submitted(self, mocker):
        client = mocker.Mock()
        client.create_template.return_value = {"id": "karix-123"}

        result = template_ops.create_template(client, "esme1", "waba1", VALID_PAYLOAD)

        assert result["ok"] is True
        assert result["karix_template_id"] == "karix-123"

        draft = db.get_draft(result["draft_id"], "esme1")
        assert draft is not None
        assert draft["status"] == "submitted"
        assert draft["karix_template_id"] == "karix-123"

    def test_karix_failure_keeps_draft_marked_failed_not_lost(self, mocker):
        client = mocker.Mock()
        client.create_template.side_effect = KarixError("Karix 400: bad category")

        result = template_ops.create_template(client, "esme1", "waba1", VALID_PAYLOAD)

        assert result["ok"] is False
        assert "bad category" in result["error"]

        draft = db.get_draft(result["draft_id"], "esme1")
        assert draft is not None
        assert draft["status"] == "submit_failed"
        assert "bad category" in draft["submit_error"]

    def test_draft_scoped_to_tenant_esme_addr(self, mocker):
        client = mocker.Mock()
        client.create_template.return_value = {"id": "karix-456"}

        result = template_ops.create_template(client, "esme_owner", "waba1", VALID_PAYLOAD)

        assert db.get_draft(result["draft_id"], "esme_owner") is not None
        assert db.get_draft(result["draft_id"], "someone_else") is None


class TestDeleteTemplate:
    def test_success(self, mocker):
        client = mocker.Mock()
        client.delete_template.return_value = {"status": "deleted"}
        result = template_ops.delete_template(client, "template-1")
        assert result == {"ok": True, "result": {"status": "deleted"}}

    def test_karix_error_returned_as_not_ok(self, mocker):
        client = mocker.Mock()
        client.delete_template.side_effect = KarixError("Karix 404: not found")
        result = template_ops.delete_template(client, "template-1")
        assert result["ok"] is False
        assert "not found" in result["error"]
