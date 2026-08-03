"""Tests for karix_mcp.validator — ported from karix-superagent's
templateValidator.js. These rules were learned from real Meta rejections
(exact error_subcodes noted in validator.py); regressions here mean a
template silently burns the creation quota on a preventable rejection."""

from karix_mcp import validator


def _spec(**overrides):
    base = {
        "template_name": "order_update",
        "language": "en",
        "category": "UTILITY",
        "components": [{"type": "BODY", "text": "Hi there, your order has shipped."}],
    }
    base.update(overrides)
    return base


class TestBasics:
    def test_valid_minimal_template_passes(self):
        result = validator.validate_template(_spec())
        assert result["valid"] is True
        assert result["errors"] == []

    def test_missing_template_name_rejected(self):
        spec = _spec()
        del spec["template_name"]
        result = validator.validate_template(spec)
        assert result["valid"] is False
        assert any("template_name" in e for e in result["errors"])

    def test_invalid_category_rejected(self):
        result = validator.validate_template(_spec(category="PROMOTIONAL"))
        assert result["valid"] is False

    def test_empty_components_rejected(self):
        result = validator.validate_template(_spec(components=[]))
        assert result["valid"] is False

    def test_missing_body_rejected(self):
        result = validator.validate_template(_spec(components=[{"type": "FOOTER", "text": "x"}]))
        assert result["valid"] is False
        assert any("BODY" in e for e in result["errors"])

    def test_two_bodies_rejected(self):
        components = [
            {"type": "BODY", "text": "First body."},
            {"type": "BODY", "text": "Second body."},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False
        assert any("Only one BODY" in e for e in result["errors"])


class TestBodyVariables:
    def test_variable_at_start_rejected(self):
        # Confirmed by a real Meta rejection: error_subcode 2388299.
        components = [{"type": "BODY", "text": "{{1}}, your order shipped.",
                       "example": {"body_text": [["John"]]}}]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False
        assert any("start" in e for e in result["errors"])

    def test_variable_at_end_rejected(self):
        components = [{"type": "BODY", "text": "Your order shipped, {{1}}",
                       "example": {"body_text": [["John"]]}}]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False
        assert any("end" in e for e in result["errors"])

    def test_variable_in_middle_with_example_passes(self):
        components = [{"type": "BODY", "text": "Hi {{1}}, your order shipped.",
                       "example": {"body_text": [["John"]]}}]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is True

    def test_variable_without_example_rejected(self):
        components = [{"type": "BODY", "text": "Hi {{1}}, your order shipped."}]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False
        assert any("example" in e for e in result["errors"])

    def test_body_over_max_length_rejected(self):
        components = [{"type": "BODY", "text": "x" * 1025}]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False


class TestButtons:
    def test_url_button_with_variable_and_no_example_rejected(self):
        # Confirmed by a real Meta rejection: error_subcode 2388043 — not
        # documented in Karix's own docs at all.
        components = [
            {"type": "BODY", "text": "Track your order below."},
            {"type": "BUTTONS", "buttons": [
                {"type": "URL", "title": "Track", "url": "https://x.com/track/{{1}}"},
            ]},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False
        assert any("example" in e for e in result["errors"])

    def test_url_button_with_variable_and_example_passes(self):
        components = [
            {"type": "BODY", "text": "Track your order below."},
            {"type": "BUTTONS", "buttons": [
                {"type": "URL", "title": "Track", "url": "https://x.com/track/{{1}}",
                 "example": ["https://x.com/track/12345"]},
            ]},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is True

    def test_url_button_missing_url_rejected(self):
        components = [
            {"type": "BODY", "text": "Track your order below."},
            {"type": "BUTTONS", "buttons": [{"type": "URL", "title": "Track"}]},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False

    def test_phone_button_missing_number_rejected(self):
        components = [
            {"type": "BODY", "text": "Call us anytime."},
            {"type": "BUTTONS", "buttons": [{"type": "PHONE_NUMBER", "title": "Call"}]},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False

    def test_invalid_button_type_rejected(self):
        components = [
            {"type": "BODY", "text": "Hello there."},
            {"type": "BUTTONS", "buttons": [{"type": "SUBSCRIBE", "title": "Join"}]},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False


class TestHeader:
    def test_media_header_requires_handle(self):
        components = [
            {"type": "HEADER", "format": "IMAGE"},
            {"type": "BODY", "text": "Here's your receipt."},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is False
        assert any("header_handle" in e for e in result["errors"])

    def test_media_header_with_handle_passes(self):
        components = [
            {"type": "HEADER", "format": "IMAGE", "example": {"header_handle": ["abc123"]}},
            {"type": "BODY", "text": "Here's your receipt."},
        ]
        result = validator.validate_template(_spec(components=components))
        assert result["valid"] is True

    def test_authentication_category_rejects_media_header(self):
        components = [
            {"type": "HEADER", "format": "IMAGE", "example": {"header_handle": ["abc123"]}},
            {"type": "BODY", "text": "Your code is {{1}}", "example": {"body_text": [["123456"]]}},
        ]
        # Note: {{1}} at the end would also fail — use a template with real
        # trailing text to isolate the AUTHENTICATION+media rule being tested.
        components[1]["text"] = "Your one-time code is {{1}}, use it soon."
        result = validator.validate_template(_spec(category="AUTHENTICATION", components=components))
        assert result["valid"] is False
        assert any("AUTHENTICATION" in e for e in result["errors"])
