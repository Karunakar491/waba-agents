package com.metaagent.platform.infrastructure.meta;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The bodies below are real Meta responses captured from api_call_log on
 * 2026-09-04 while probing the Connector Tools API — not invented examples.
 * They are the exact messages that were being thrown away.
 */
class MetaApiErrorMessageTest {

    @Test
    @DisplayName("surfaces the detail that would have saved an afternoon of probing")
    void surfacesDetail() {
        String body = """
                {"title":"Invalid request_definition","detail":"request_definition.body.params.tags.items must be a JSON object string that describes a body field.","status":400,"fbtrace_id":"AY8UBIxh2qe4IXUez6_uVO9"}
                """;

        String message = MetaApiErrorMessage.describe(400, body);

        assertThat(message).contains("must be a JSON object string");
        // The title adds context the detail alone lacks, so both are kept.
        assertThat(message).startsWith("Invalid request_definition");
        // fbtrace_id is for the log and for Meta support, never for the operator.
        assertThat(message).doesNotContain("fbtrace_id");
        assertThat(message).doesNotContain("AY8UBIxh2qe4IXUez6_uVO9");
    }

    @Test
    @DisplayName("names the duplicate input rather than reporting a bare 400")
    void surfacesDuplicateInputName() {
        String body = """
                {"detail":"request_definition uses duplicate top-level input name \\"action\\" in query_parameters and body.params.","status":400}
                """;

        assertThat(MetaApiErrorMessage.describe(400, body))
                .isEqualTo("request_definition uses duplicate top-level input name \"action\" in query_parameters and body.params.");
    }

    @Test
    @DisplayName("does not repeat the title when the detail already starts with it")
    void doesNotDoubleUpTitle() {
        String body = """
                {"title":"Invalid request","detail":"Invalid request — the path must start with a slash.","status":400}
                """;

        String message = MetaApiErrorMessage.describe(400, body);

        assertThat(message).isEqualTo("Invalid request — the path must start with a slash.");
    }

    @Test
    @DisplayName("reads the Graph API error shape too")
    void readsGraphShape() {
        String body = """
                {"error":{"message":"(#100) Tried accessing nonexisting field","type":"OAuthException","code":100}}
                """;

        assertThat(MetaApiErrorMessage.describe(400, body))
                .isEqualTo("(#100) Tried accessing nonexisting field");
    }

    @Test
    @DisplayName("unwraps a body that Meta double-encoded as a JSON string")
    void unwrapsDoubleEncodedBody() {
        // api_call_log stores it this way, and MetaApiClient passes through whatever
        // it read — so the handler has to cope with a quoted JSON document.
        String body = "\"{\\\"detail\\\":\\\"Query is required\\\",\\\"status\\\":400}\"";

        assertThat(MetaApiErrorMessage.describe(400, body)).isEqualTo("Query is required");
    }

    @Test
    @DisplayName("falls back to plain words per status when Meta says nothing usable")
    void fallsBackPerStatus() {
        assertThat(MetaApiErrorMessage.describe(409, null)).contains("already exists");
        assertThat(MetaApiErrorMessage.describe(429, "")).contains("rate-limiting");
        assertThat(MetaApiErrorMessage.describe(401, "not json at all")).contains("token");
        assertThat(MetaApiErrorMessage.describe(404, "<html>oops</html>")).contains("could not find");
        assertThat(MetaApiErrorMessage.describe(503, "{}")).contains("server error");
    }

    @Test
    @DisplayName("never returns the bare status-code message the operator used to see")
    void neverReturnsBareStatusMessage() {
        for (int status : new int[] {400, 401, 403, 404, 409, 429, 500, 503, 418}) {
            String message = MetaApiErrorMessage.describe(status, null);
            assertThat(message).doesNotContain("Meta API error");
            assertThat(message.length()).isGreaterThan(20);
        }
    }

    @Test
    @DisplayName("does not blow up on hostile or empty input")
    void survivesJunk() {
        assertThat(MetaApiErrorMessage.describe(400, "[1,2,3]")).isNotBlank();
        assertThat(MetaApiErrorMessage.describe(400, "\"\"")).isNotBlank();
        assertThat(MetaApiErrorMessage.describe(400, "{\"detail\":null}")).isNotBlank();
        assertThat(MetaApiErrorMessage.describe(400, "{\"detail\":\"   \"}")).isNotBlank();
    }
}
