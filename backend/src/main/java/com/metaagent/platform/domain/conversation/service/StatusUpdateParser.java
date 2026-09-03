package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.StatusUpdate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Parses Meta status webhook payloads (value.statuses[0], or value.standby.statuses[0]
 * for BizAI-owned conversations — found live 2026-08-14, the standby-nested shape was
 * silently dropped entirely before this) into StatusUpdate records. Parallel to
 * InboundMessageParser — a status webhook has no messages[] array.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StatusUpdateParser {

    private final ObjectMapper objectMapper;

    public Optional<StatusUpdate> parse(String rawPayload) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            // .at() returns MissingNode (not null) on any absent path — safe for deeply nested access
            JsonNode statusNode = root.at("/entry/0/changes/0/value/statuses/0");
            if (statusNode.isMissingNode()) {
                statusNode = root.at("/entry/0/changes/0/value/standby/statuses/0");
            }
            if (statusNode.isMissingNode()) {
                return Optional.empty();
            }
            return Optional.of(new StatusUpdate(
                    statusNode.path("id").asText(),
                    statusNode.path("status").asText(),
                    statusNode.path("recipient_id").asText(null)
            ));
        } catch (Exception e) {
            log.warn("Failed to parse status update payload: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
