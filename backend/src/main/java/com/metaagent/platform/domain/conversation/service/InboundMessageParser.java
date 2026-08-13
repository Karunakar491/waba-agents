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
                // Founder-reported gap (2026-08-13): when BizAI (Meta's own AI) is
                // actively handling the conversation, the customer's real message
                // is NOT under value.messages at all — Meta nests it one level
                // deeper, under value.standby.messages (docs/meta-api/webhook-
                // standby-handoff.md, row 2: "consumer message arrives while BizAI
                // is responding"). This is the normal case for every live deployed
                // agent, not an edge case — missing it meant the Conversations tab
                // never showed a single message for any agent Meta's AI was
                // actually answering. HandoffClassifier already reads this same
                // path to detect BIZAI_ACTIVE; this just also extracts the message
                // itself instead of only using standby's presence as a signal.
                messageNode = root.at("/entry/0/changes/0/value/standby/messages/0");
            }
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
