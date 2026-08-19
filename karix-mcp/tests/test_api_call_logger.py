"""Tests for karix_mcp.api_call_logger — redaction, the never-raises
guarantee, and real end-to-end logging via KarixClient (real MySQL via
Testcontainers, mocked Karix HTTP only — see conftest.py)."""

import requests

from karix_mcp import api_call_logger, db
from karix_mcp.karix_client import KarixClient, KarixError


class TestRedaction:
    def test_redacts_api_key_field(self):
        redacted = api_call_logger._redact({"api_key": "shh", "waba_id": "123"})
        assert redacted["api_key"] == "[REDACTED]"
        assert redacted["waba_id"] == "123"

    def test_redacts_authentication_field(self):
        # Karix's non-standard header name — must match explicitly, a bare
        # "authorization" pattern alone would miss this.
        redacted = api_call_logger._redact({"authentication": "Bearer xyz"})
        assert redacted["authentication"] == "[REDACTED]"

    def test_redacts_nested_secret_fields(self):
        redacted = api_call_logger._redact({
            "components": [{"type": "BUTTONS", "buttons": [{"client_secret": "shh", "title": "x"}]}],
        })
        assert redacted["components"][0]["buttons"][0]["client_secret"] == "[REDACTED]"
        assert redacted["components"][0]["buttons"][0]["title"] == "x"

    def test_does_not_redact_unrelated_fields(self):
        redacted = api_call_logger._redact({"template_name": "order_shipped", "language": "en"})
        assert redacted == {"template_name": "order_shipped", "language": "en"}

    def test_to_logged_string_truncates_long_bodies(self):
        text = api_call_logger._to_logged_string({"body": "x" * 5000})
        assert len(text) <= api_call_logger._MAX_BODY_LENGTH

    def test_to_logged_string_handles_none(self):
        assert api_call_logger._to_logged_string(None) is None


class TestLogCallNeverRaises:
    def test_swallows_db_write_failure(self, mocker):
        mocker.patch("karix_mcp.db.insert_api_call_log", side_effect=RuntimeError("MySQL is down"))
        # Must not raise — a failed audit write can never break the real call.
        api_call_logger.log_call("POST", "/x", 200, 10, request_body={"a": 1})

    def test_swallows_credential_resolution_failure(self, mocker):
        mocker.patch("karix_mcp.api_call_logger.resolve_esme_addr", side_effect=RuntimeError("no context"))
        api_call_logger.log_call("POST", "/x", 200, 10)


class TestErrorFieldPreservation:
    """2026-08-19 fix: `if error` treated an empty-string error the same as
    no error at all, silently storing NULL instead of the empty string."""

    def test_empty_string_error_is_preserved_not_masked_as_none(self, mocker):
        insert = mocker.patch("karix_mcp.db.insert_api_call_log")

        api_call_logger.log_call("POST", "/x", 500, 10, error="")

        assert insert.call_args.kwargs["error"] == ""

    def test_none_error_is_still_stored_as_none(self, mocker):
        insert = mocker.patch("karix_mcp.db.insert_api_call_log")

        api_call_logger.log_call("POST", "/x", 200, 10)

        assert insert.call_args.kwargs["error"] is None

    def test_real_error_message_is_preserved(self, mocker):
        insert = mocker.patch("karix_mcp.db.insert_api_call_log")

        api_call_logger.log_call("POST", "/x", None, 10, error="Connection refused")

        assert insert.call_args.kwargs["error"] == "Connection refused"


class TestEndToEndLogging:
    """Exercises the real path: KarixClient -> _retry -> api_call_logger.log_call
    -> db.insert_api_call_log -> real MySQL."""

    def _client(self):
        return KarixClient(send_base="https://send.example.com",
                            template_base="https://template.example.com",
                            api_key="secret-key-abc", waba_id="waba1")

    def test_successful_call_is_logged_with_redacted_body(self, mocker):
        from karix_mcp import credentials
        credentials.set_request_credentials(api_key="secret-key-abc", waba_id="waba1", esme_addr="esme_logtest")

        mocker.patch("requests.post", return_value=mocker.Mock(status_code=200, json=lambda: {"id": "karix-1"}))
        self._client().create_template({"template_name": "x", "language": "en",
                                         "category": "UTILITY", "components": []})

        logs = db.get_api_call_logs("esme_logtest")
        assert len(logs) == 1
        assert logs[0]["method"] == "POST"
        assert logs[0]["status_code"] == 200
        assert "waba1" in logs[0]["path"]
        assert "secret-key-abc" not in (logs[0]["request_body"] or "")

    def test_karix_error_is_still_logged(self, mocker):
        from karix_mcp import credentials
        credentials.set_request_credentials(api_key="k", waba_id="waba1", esme_addr="esme_errtest")

        mocker.patch("requests.delete", return_value=mocker.Mock(status_code=404, text="not found"))
        client = self._client()
        try:
            client.delete_template("template-1")
        except KarixError:
            pass

        logs = db.get_api_call_logs("esme_errtest")
        assert len(logs) == 1
        assert logs[0]["status_code"] == 404

    def test_network_exception_is_still_logged(self, mocker):
        from karix_mcp import credentials
        credentials.set_request_credentials(api_key="k", waba_id="waba1", esme_addr="esme_networktest")

        mocker.patch("requests.get", side_effect=requests.ConnectionError("timeout"))
        client = self._client()
        try:
            client.get_template("template-1")
        except requests.ConnectionError:
            pass

        logs = db.get_api_call_logs("esme_networktest")
        assert len(logs) == 1
        assert logs[0]["status_code"] is None
        assert "timeout" in logs[0]["error"]

    def test_upload_media_never_logs_raw_file_bytes(self, mocker):
        from karix_mcp import credentials
        credentials.set_request_credentials(api_key="k", waba_id="waba1", esme_addr="esme_mediatest")

        mocker.patch("requests.post", return_value=mocker.Mock(status_code=200, json=lambda: {"fileHandle": "abc"}))
        secret_bytes = b"\x89PNG\r\n\x1a\nnot-really-a-png-but-binary-content"
        self._client().upload_media(secret_bytes, "logo.png", "image/png", "image")

        logs = db.get_api_call_logs("esme_mediatest")
        assert len(logs) == 1
        assert logs[0]["request_body"] is not None
        assert "logo.png" in logs[0]["request_body"]
        assert secret_bytes.decode("latin1") not in logs[0]["request_body"]
