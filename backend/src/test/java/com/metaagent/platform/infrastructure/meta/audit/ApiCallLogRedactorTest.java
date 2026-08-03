package com.metaagent.platform.infrastructure.meta.audit;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * EL-caught (2026-08-03): upsertConnectorCertificate sends an mTLS private
 * key as "client_key" (docs/meta-api/connectors.md) — matched neither
 * "secret" nor "api[_-]?key", so it was being written to api_call_log in
 * plaintext. This guards the fix.
 */
class ApiCallLogRedactorTest {

    @Test
    void should_redact_client_key() {
        String json = ApiCallLogRedactor.toRedactedJson(Map.of(
                "client_key", "-----BEGIN PRIVATE KEY-----MIIEvQ...",
                "client_certificate", "-----BEGIN CERTIFICATE-----MIID..."));

        assertThat(json).doesNotContain("BEGIN PRIVATE KEY");
        assertThat(json).contains("[REDACTED]");
        // client_certificate is public and useful for debugging — must stay visible.
        assertThat(json).contains("BEGIN CERTIFICATE");
    }

    @Test
    void should_redact_private_key_field() {
        String json = ApiCallLogRedactor.toRedactedJson(Map.of("private_key", "supersecretvalue"));

        assertThat(json).doesNotContain("supersecretvalue");
        assertThat(json).contains("[REDACTED]");
    }

    @Test
    void should_still_redact_existing_secret_shaped_fields() {
        String json = ApiCallLogRedactor.toRedactedJson(Map.of(
                "client_secret", "abc123",
                "api_key", "def456",
                "password", "ghi789"));

        assertThat(json).doesNotContain("abc123").doesNotContain("def456").doesNotContain("ghi789");
    }

    @Test
    void should_not_redact_ca_certificate_which_is_public() {
        String json = ApiCallLogRedactor.toRedactedJson(Map.of("ca_certificate", "-----BEGIN CERTIFICATE-----"));

        assertThat(json).contains("BEGIN CERTIFICATE");
    }
}
