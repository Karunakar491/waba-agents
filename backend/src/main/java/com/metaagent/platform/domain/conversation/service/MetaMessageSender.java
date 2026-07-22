package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Sends a text message to a customer via the Meta Cloud API.
 * Returns the Meta-confirmed message ID. Never returns null — throws on failure.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetaMessageSender {

    private final MetaApiClient metaApiClient;

    public String send(String phoneNumberId, String recipientPhone, String text) {
        String path = "/" + phoneNumberId + "/messages";

        Map<String, Object> payload = Map.of(
                "messaging_product", "whatsapp",
                "recipient_type", "individual",
                "to", recipientPhone,
                "type", "text",
                "text", Map.of("preview_url", false, "body", text)
        );

        try {
            Map<?, ?> response = metaApiClient.post(path, payload, Map.class);
            return extractMessageId(response);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to send WhatsApp message to {}: {}", recipientPhone, e.getMessage());
            throw new BusinessException("Failed to send WhatsApp message: " + e.getMessage());
        }
    }

    private String extractMessageId(Map<?, ?> response) {
        if (response != null
                && response.get("messages") instanceof List<?> list
                && !list.isEmpty()
                && list.get(0) instanceof Map<?, ?> first
                && first.get("id") instanceof String id) {
            return id;
        }
        throw new BusinessException("Meta API returned a response with no message ID");
    }
}
