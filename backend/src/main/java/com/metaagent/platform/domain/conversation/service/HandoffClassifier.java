package com.metaagent.platform.domain.conversation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.conversation.model.HandoffSignal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Classifies a raw webhook payload into a HandoffSignal, per the structural rule in
 * docs/meta-api/webhook-standby-handoff.md — standby-wrapper presence/absence, not a field name.
 * Pure function of the payload string — no side effects, no persistence.
 *
 * Provisional: rule is based on ONE sample payload capture, not yet verified against production
 * traffic — see docs/meta-api/webhook-standby-handoff.md.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HandoffClassifier {

    private final ObjectMapper objectMapper;

    public HandoffSignal classify(String rawPayload) {
        try {
            JsonNode value = objectMapper.readTree(rawPayload).at("/entry/0/changes/0/value");
            if (value.isMissingNode()) {
                return HandoffSignal.UNRECOGNIZED;
            }
            if (value.has("standby")) {
                return HandoffSignal.BIZAI_ACTIVE;
            }
            if (value.has("messages") && !value.has("statuses")) {
                log.info("Handoff signal detected (NEEDS_HUMAN) — provisional rule, confirm against production traffic");
                return HandoffSignal.NEEDS_HUMAN;
            }
            if (value.has("statuses")) {
                return HandoffSignal.STATUS_UPDATE;
            }
            return HandoffSignal.UNRECOGNIZED;
        } catch (Exception e) {
            log.warn("Failed to classify webhook payload for handoff signal: {}", e.getMessage());
            return HandoffSignal.UNRECOGNIZED;
        }
    }
}
