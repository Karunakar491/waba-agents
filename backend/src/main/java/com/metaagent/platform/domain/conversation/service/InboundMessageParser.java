package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.InboundMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Parses raw Meta webhook JSON into a structured InboundMessage.
 * Returns empty if the payload contains no customer message (e.g. status-only webhooks).
 * All message types are persisted — no silent drops.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InboundMessageParser {

    private final ObjectMapper objectMapper;

    public Optional<InboundMessage> parse(String rawPayload) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            // .at() returns MissingNode (not null) on absent path — consistent with StatusUpdateParser
            JsonNode messageNode = root.at("/entry/0/changes/0/value/messages/0");
            if (messageNode.isMissingNode()) {
                return Optional.empty();
            }

            String customerPhone = messageNode.path("from").asText();
            String metaMessageId = messageNode.path("id").asText();
            String type = messageNode.path("type").asText("unknown");

            String textBody = null;
            String contentJson = null;

            if ("text".equals(type)) {
                textBody = messageNode.path("text").path("body").asText();
            } else if ("interactive".equals(type)) {
                contentJson = messageNode.toString();
            } else {
                // image, audio, video, document, template — persist metadata, no media download
                contentJson = messageNode.toString();
            }

            return Optional.of(new InboundMessage(customerPhone, metaMessageId, textBody, type, contentJson));
        } catch (Exception e) {
            String preview = rawPayload != null && rawPayload.length() > 200
                    ? rawPayload.substring(0, 200) + "..." : rawPayload;
            log.warn("Failed to parse webhook payload ({}): payload_preview={}", e.getMessage(), preview);
            return Optional.empty();
        }
    }
}
