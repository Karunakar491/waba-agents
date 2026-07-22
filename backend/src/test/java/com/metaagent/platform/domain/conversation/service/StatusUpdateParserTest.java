package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.StatusUpdate;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for StatusUpdateParser — no Spring context, no containers.
 *
 * StatusUpdateParser reads value.statuses[0] from a Meta webhook payload.
 * All tests construct a real ObjectMapper directly.
 */
class StatusUpdateParserTest {

    // ObjectMapper is stateless after construction — safe to share across tests
    private final StatusUpdateParser parser = new StatusUpdateParser(new ObjectMapper());

    // -------------------------------------------------------------------------
    // Helpers — build minimal status-update payloads
    // -------------------------------------------------------------------------

    private String statusPayload(String status) {
        return "{\"entry\":[{\"changes\":[{\"value\":{\"statuses\":[{"
                + "\"id\":\"wamid.abc123\","
                + "\"status\":\"" + status + "\","
                + "\"recipient_id\":\"919876543210\""
                + "}]}}]}]}";
    }

    // -------------------------------------------------------------------------
    // Valid status values
    // -------------------------------------------------------------------------

    @Test
    void should_parse_sent_status() {
        Optional<StatusUpdate> result = parser.parse(statusPayload("sent"));

        assertThat(result).isPresent();
        StatusUpdate update = result.get();
        assertThat(update.metaMessageId()).isEqualTo("wamid.abc123");
        assertThat(update.status()).isEqualTo("sent");
        assertThat(update.recipientPhone()).isEqualTo("919876543210");
    }

    @Test
    void should_parse_delivered_status() {
        Optional<StatusUpdate> result = parser.parse(statusPayload("delivered"));

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo("delivered");
    }

    @Test
    void should_parse_read_status() {
        Optional<StatusUpdate> result = parser.parse(statusPayload("read"));

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo("read");
    }

    @Test
    void should_parse_failed_status() {
        Optional<StatusUpdate> result = parser.parse(statusPayload("failed"));

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo("failed");
    }

    // -------------------------------------------------------------------------
    // Missing or wrong structure
    // -------------------------------------------------------------------------

    @Test
    void should_return_empty_when_payload_has_no_statuses_array() {
        String noStatuses = "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"id\":\"wamid.x\"}]}}]}]}";

        Optional<StatusUpdate> result = parser.parse(noStatuses);

        assertThat(result).isEmpty();
    }

    @Test
    void should_return_empty_when_payload_is_empty_json_object() {
        Optional<StatusUpdate> result = parser.parse("{}");

        assertThat(result).isEmpty();
    }

    @Test
    void should_return_empty_and_not_throw_when_payload_is_malformed_json() {
        Optional<StatusUpdate> result = parser.parse("not json at all");

        assertThat(result).isEmpty();
    }

    @Test
    void should_return_empty_and_not_throw_when_payload_is_empty_string() {
        Optional<StatusUpdate> result = parser.parse("");

        assertThat(result).isEmpty();
    }
}
