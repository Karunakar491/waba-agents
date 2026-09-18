package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.OutboundEcho;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Parses value.standby.message_echoes[0] — BizAI's own outbound reply, echoed
 * back to us (docs/meta-api/webhook-standby-handoff.md). Without this, an
 * outbound Message row exists (created from the "sent" status webhook) but
 * with no text, since a status event carries no message body.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboundEchoParser {

    private final ObjectMapper objectMapper;

    public Optional<OutboundEcho> parse(String rawPayload) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            JsonNode echoNode = root.at("/entry/0/changes/0/value/standby/message_echoes/0");
            if (echoNode.isMissingNode()) {
                return Optional.empty();
            }

            // "id" is on the echo entry itself. The actual message content was
            // found live (2026-08-13) nested one level deeper under "message" —
            // real BizAI replies were sent to real customers but never persisted
            // because this parser originally read to/type/text.body from the
            // wrong level (a guess, never verified against real traffic). Meta's
            // webhook shapes have already proven inconsistent with our
            // assumptions once; there is no guarantee "message"-wrapped is the
            // ONLY shape Meta ever sends (e.g. a differently-versioned account, a
            // non-text reply type, or human-handoff's own webhook may nest
            // differently again — genuinely unverified). So: try the nested
            // "message" shape first (real, confirmed shape); if that yields
            // nothing, fall back to reading straight off the echo node (the
            // original flat assumption) rather than silently giving up — better
            // to persist something from an unrecognized shape than to drop a
            // real reply a second time in a way that looks identical to this bug.
            String metaMessageId = echoNode.path("id").asText();
            JsonNode messageNode = echoNode.path("message");
            JsonNode contentNode = messageNode.isMissingNode() ? echoNode : messageNode;
            // Echo is outbound — "to" is the customer, mirroring "from" on an inbound message.
            String recipientPhone = contentNode.path("to").asText(null);
            String type = contentNode.path("type").asText("unknown");
            String textBody = "text".equals(type) ? contentNode.path("text").path("body").asText(null) : null;

            /*
             * Anything that is not plain text keeps its payload.
             *
             * This used to read `type` and throw it away, so a reply that was a
             * five-row list or a carousel became textBody=null and was dropped
             * entirely a few lines downstream. The customer saw a list of
             * options; our own Inbox showed nothing at all, and the only way to
             * find out what they had been shown was to read raw webhook JSON by
             * hand.
             *
             * Stored raw, exactly as the inbound path already does
             * (InboundMessageParser sets contentJson for interactive messages),
             * and summarised for humans at render time — not here. Baking a
             * summary into the row would freeze today's reading of Meta's shapes
             * into every historical message.
             */
            String contentJson = "text".equals(type) ? null : contentNode.toString();

            return Optional.of(new OutboundEcho(metaMessageId, recipientPhone, textBody, type, contentJson));
        } catch (Exception e) {
            String preview = rawPayload != null && rawPayload.length() > 200
                    ? rawPayload.substring(0, 200) + "..." : rawPayload;
            log.warn("Failed to parse outbound echo payload ({}): payload_preview={}", e.getMessage(), preview);
            return Optional.empty();
        }
    }
}
