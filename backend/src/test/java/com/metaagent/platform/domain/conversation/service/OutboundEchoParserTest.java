package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.OutboundEcho;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Fixtures below mirror a REAL echo payload captured live 2026-08-13 from the
 * IndiaMART agent (docs/meta-api/webhook-standby-handoff.md's shape was an
 * assumption, not verified against real traffic until now). The original
 * version of this test used a flat {to, id, type, text} shape at
 * message_echoes[0] directly — that shape doesn't exist in real Meta traffic;
 * the actual content is nested one level deeper under "message". The parser
 * silently produced textBody=null against every real webhook because of this,
 * and this test never caught it since the fixture matched the (wrong)
 * implementation instead of reality. Real, live BizAI replies were sent to
 * customers but never persisted to our Message table as a result — found only
 * by comparing a real WhatsApp conversation transcript against what our own
 * database had recorded for the same conversation.
 */
class OutboundEchoParserTest {

    private OutboundEchoParser parser;

    @BeforeEach
    void setUp() {
        parser = new OutboundEchoParser(new ObjectMapper());
    }

    @Test
    void should_parse_text_echo_when_bizai_replies() {
        String payload = """
                {
                  "entry": [{
                    "changes": [{
                      "value": {
                        "standby": {
                          "message_echoes": [{
                            "id": "wamid.echo001",
                            "message": {
                              "to": "919876543210",
                              "type": "text",
                              "text": { "body": "Sure, here's your order status", "preview_url": "true" },
                              "recipient_type": "individual"
                            },
                            "timestamp": "1786647759"
                          }]
                        }
                      }
                    }]
                  }]
                }
                """;

        Optional<OutboundEcho> result = parser.parse(payload);

        assertTrue(result.isPresent());
        OutboundEcho echo = result.get();
        assertEquals("919876543210", echo.recipientPhone());
        assertEquals("wamid.echo001", echo.metaMessageId());
        assertEquals("Sure, here's your order status", echo.textBody());
    }

    @Test
    void should_return_null_text_body_when_echo_is_not_text_type() {
        String payload = """
                {
                  "entry": [{
                    "changes": [{
                      "value": {
                        "standby": {
                          "message_echoes": [{
                            "id": "wamid.echo002",
                            "message": {
                              "to": "919876543210",
                              "type": "template"
                            },
                            "timestamp": "1786647759"
                          }]
                        }
                      }
                    }]
                  }]
                }
                """;

        Optional<OutboundEcho> result = parser.parse(payload);

        assertTrue(result.isPresent());
        assertNull(result.get().textBody());
    }

    @Test
    void should_return_empty_when_no_message_echoes_present() {
        String payload = """
                {
                  "entry": [{
                    "changes": [{
                      "value": {
                        "standby": {
                          "messages": [{ "from": "919876543210", "id": "wamid.in001", "type": "text" }]
                        }
                      }
                    }]
                  }]
                }
                """;

        Optional<OutboundEcho> result = parser.parse(payload);

        assertTrue(result.isEmpty());
    }

    @Test
    void should_return_empty_when_payload_is_malformed() {
        Optional<OutboundEcho> result = parser.parse("not json");

        assertTrue(result.isEmpty());
    }

    @Test
    void should_fall_back_to_flat_shape_when_message_wrapper_is_absent() {
        // Defensive fallback (2026-08-13): the nested "message" wrapper is the
        // only shape confirmed against real traffic so far, but Meta's shapes
        // have already proven inconsistent with assumptions once. If some other
        // account/version/reply-type ever sends the flat shape this parser
        // originally (wrongly) assumed was universal, don't silently drop it.
        String payload = """
                {
                  "entry": [{
                    "changes": [{
                      "value": {
                        "standby": {
                          "message_echoes": [{
                            "id": "wamid.echo003",
                            "to": "919876543210",
                            "type": "text",
                            "text": { "body": "Flat-shape fallback reply" }
                          }]
                        }
                      }
                    }]
                  }]
                }
                """;

        Optional<OutboundEcho> result = parser.parse(payload);

        assertTrue(result.isPresent());
        OutboundEcho echo = result.get();
        assertEquals("919876543210", echo.recipientPhone());
        assertEquals("wamid.echo003", echo.metaMessageId());
        assertEquals("Flat-shape fallback reply", echo.textBody());
    }

    /**
     * A real interactive echo, copied from the stored webhook for WhatsApp
     * +91 85916 89475 on 2026-09-17
     * (docs/e2e-test-runs/2026-09-17-astrotalk-webhooks.md).
     *
     * The parser used to read `type`, see it was not "text", set textBody to
     * null, and hand back a record with nowhere to put the component.
     * ConversationService then dropped the whole echo. The customer had a list
     * of five prices on their phone and our Inbox showed nothing at all.
     */
    @Test
    void keeps_the_component_of_an_interactive_reply() {
        String payload = """
                {"entry":[{"changes":[{"field":"standby","value":{"standby":{"message_echoes":[{
                  "id":"wamid.echoList001",
                  "message":{
                    "to":"917207917796",
                    "type":"interactive",
                    "interactive":{
                      "body":{"text":"Select your session duration for Astro Sneha:"},
                      "type":"list",
                      "action":{"button":"View Options","sections":[{"rows":[
                        {"id":"biz_ai_list_duration_5","title":"5 minutes","description":"\\u20b9225"},
                        {"id":"biz_ai_list_duration_10","title":"10 minutes","description":"\\u20b9450"}
                      ]}]}
                    }
                  },
                  "timestamp":"1789616721"}]}}}]}]}
                """;

        Optional<OutboundEcho> result = parser.parse(payload);

        assertTrue(result.isPresent(), "an interactive echo must not be discarded");
        OutboundEcho echo = result.get();
        assertEquals("917207917796", echo.recipientPhone());
        assertEquals("wamid.echoList001", echo.metaMessageId());
        assertEquals("interactive", echo.type());
        assertNull(echo.textBody(), "there is no plain-text body on a list");
        assertTrue(echo.isRichContent(), "the component is what makes this worth storing");
        // The rows survive, because they are what the customer actually saw.
        assertTrue(echo.contentJson().contains("5 minutes"));
        assertTrue(echo.contentJson().contains("View Options"));
    }

    @Test
    void a_plain_text_reply_carries_no_component() {
        String payload = """
                {"entry":[{"changes":[{"field":"standby","value":{"standby":{"message_echoes":[{
                  "id":"wamid.echoText001",
                  "message":{"to":"919876543210","type":"text","text":{"body":"Namaste!"}}
                }]}}}]}]}
                """;

        OutboundEcho echo = parser.parse(payload).orElseThrow();

        assertEquals("Namaste!", echo.textBody());
        assertEquals("text", echo.type());
        assertNull(echo.contentJson(), "a text reply has no component to keep");
        assertFalse(echo.isRichContent());
    }
}
