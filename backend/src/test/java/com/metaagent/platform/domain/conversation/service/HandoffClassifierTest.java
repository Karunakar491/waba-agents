package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.HandoffSignal;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for HandoffClassifier — no Spring context, no containers.
 *
 * Payload shapes mirror the samples in docs/meta-api/webhook-standby-handoff.md
 * (partner pilot capture, Jul 11-14 2026): standby-wrapped contacts/messages (BizAI active),
 * standby message_echoes (BizAI active), top-level contacts/messages with no standby (handoff),
 * and a plain statuses array (normal delivery receipt).
 */
class HandoffClassifierTest {

    private final HandoffClassifier classifier = new HandoffClassifier(new ObjectMapper());

    @Test
    void should_classify_standby_wrapped_contacts_and_messages_as_bizai_active() {
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"messaging_product\":\"whatsapp\","
                + "\"metadata\":{\"phone_number_id\":\"123456\"},"
                + "\"standby\":{"
                + "\"contacts\":[{\"profile\":{\"name\":\"Jane\"},\"wa_id\":\"919876543210\"}],"
                + "\"messages\":[{\"from\":\"919876543210\",\"id\":\"wamid.standby1\",\"type\":\"text\","
                + "\"text\":{\"body\":\"hi\"}}]"
                + "}}}]}]}";

        assertThat(classifier.classify(payload)).isEqualTo(HandoffSignal.BIZAI_ACTIVE);
    }

    @Test
    void should_classify_standby_message_echoes_as_bizai_active() {
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"messaging_product\":\"whatsapp\","
                + "\"metadata\":{\"phone_number_id\":\"123456\"},"
                + "\"standby\":{"
                + "\"message_echoes\":[{\"from\":\"123456\",\"id\":\"wamid.echo1\",\"type\":\"text\","
                + "\"text\":{\"body\":\"How can I help?\"},"
                + "\"biz_opaque_callback_data\":\"{\\\"originator\\\":\\\"bizai\\\",\\\"channel\\\":\\\"ent\\\"}\"}]"
                + "}}}]}]}";

        assertThat(classifier.classify(payload)).isEqualTo(HandoffSignal.BIZAI_ACTIVE);
    }

    @Test
    void should_classify_top_level_messages_with_no_standby_and_no_statuses_as_needs_human() {
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"messaging_product\":\"whatsapp\","
                + "\"metadata\":{\"phone_number_id\":\"123456\"},"
                + "\"contacts\":[{\"profile\":{\"name\":\"Jane\"},\"wa_id\":\"919876543210\"}],"
                + "\"messages\":[{\"from\":\"919876543210\",\"id\":\"wamid.handoff1\",\"type\":\"text\","
                + "\"text\":{\"body\":\"still there?\"}}]"
                + "}}]}]}";

        assertThat(classifier.classify(payload)).isEqualTo(HandoffSignal.NEEDS_HUMAN);
    }

    @Test
    void should_classify_statuses_array_as_status_update() {
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"messaging_product\":\"whatsapp\","
                + "\"metadata\":{\"phone_number_id\":\"123456\"},"
                + "\"statuses\":[{\"id\":\"wamid.abc123\",\"status\":\"delivered\",\"recipient_id\":\"919876543210\"}]"
                + "}}]}]}";

        assertThat(classifier.classify(payload)).isEqualTo(HandoffSignal.STATUS_UPDATE);
    }

    @Test
    void should_classify_empty_json_object_as_unrecognized() {
        assertThat(classifier.classify("{}")).isEqualTo(HandoffSignal.UNRECOGNIZED);
    }

    @Test
    void should_classify_malformed_json_as_unrecognized_and_not_throw() {
        assertThat(classifier.classify("not json at all")).isEqualTo(HandoffSignal.UNRECOGNIZED);
    }
}
