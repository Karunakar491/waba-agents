package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.InboundMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class InboundMessageParserTest {

    private InboundMessageParser parser;

    @BeforeEach
    void setUp() {
        // Plain ObjectMapper — no Spring context required.
        parser = new InboundMessageParser(new ObjectMapper());
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** Builds a minimal valid Meta webhook payload for a WhatsApp text message. */
    private String validTextPayload(String from, String messageId, String body) {
        return """
                {
                  "entry": [{
                    "changes": [{
                      "value": {
                        "messages": [{
                          "from": "%s",
                          "id": "%s",
                          "type": "text",
                          "text": { "body": "%s" }
                        }]
                      }
                    }]
                  }]
                }
                """.formatted(from, messageId, body);
    }

    // ------------------------------------------------------------------
    // Tests
    // ------------------------------------------------------------------

    @Test
    void should_return_inbound_message_when_payload_is_valid_text_message() {
        String payload = validTextPayload("919876543210", "wamid.abc123", "Hello");

        Optional<InboundMessage> result = parser.parse(payload);

        assertTrue(result.isPresent(), "Expected a non-empty Optional for a valid text payload");
        InboundMessage msg = result.get();
        assertEquals("919876543210", msg.customerPhone());
        assertEquals("wamid.abc123", msg.metaMessageId());
        assertEquals("Hello", msg.textBody());
    }

    @Test
    void should_return_empty_when_payload_has_no_messages_array() {
        // 'entry' and 'changes' exist but 'value.messages' is absent.
        String payload = """
                {
                  "entry": [{
                    "changes": [{
                      "value": {}
                    }]
                  }]
                }
                """;

        Optional<InboundMessage> result = parser.parse(payload);

        assertTrue(result.isEmpty(), "Expected empty Optional when messages array is absent");
    }

    @Test
    void should_return_empty_when_payload_is_empty_json() {
        Optional<InboundMessage> result = parser.parse("{}");

        assertTrue(result.isEmpty(), "Expected empty Optional for empty JSON object");
    }

    @Test
    void should_return_empty_when_payload_is_malformed() {
        Optional<InboundMessage> result = parser.parse("not json");

        assertTrue(result.isEmpty(), "Expected empty Optional when payload is not valid JSON");
    }

    @Test
    void should_return_non_text_placeholder_when_message_type_is_image() {
        // Image messages carry no 'text' node.
        String payload = """
                {
                  "entry": [{
                    "changes": [{
                      "value": {
                        "messages": [{
                          "from": "919876543210",
                          "id": "wamid.img001",
                          "type": "image"
                        }]
                      }
                    }]
                  }]
                }
                """;

        Optional<InboundMessage> result = parser.parse(payload);

        assertTrue(result.isPresent(), "Expected a non-empty Optional even for non-text messages");
        String textBody = result.get().textBody();
        assertTrue(
                textBody.contains("image"),
                "Expected placeholder to mention the message type 'image', got: " + textBody
        );
        assertTrue(
                textBody.startsWith("[Received non-text message"),
                "Expected placeholder prefix '[Received non-text message', got: " + textBody
        );
    }
}
