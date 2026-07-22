package com.metaagent.platform.domain.webhook.listener;

import com.metaagent.platform.domain.conversation.service.ConversationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookListener {

    private final ConversationService conversationService;

    @RabbitListener(queues = "webhook-processing")
    public void handleWebhookEvent(Map<String, Object> event) {
        log.info("Received RabbitMQ event for webhook-processing: {}", event);
        try {
            Long webhookRawId = ((Number) event.get("webhookRawId")).longValue();
            Long accountId = ((Number) event.get("accountId")).longValue();
            
            Object agentIdObj = event.get("agentId");
            Long agentId = agentIdObj != null ? ((Number) agentIdObj).longValue() : null;

            conversationService.processWebhookEvent(webhookRawId, accountId, agentId);
        } catch (Exception e) {
            log.error("Failed to execute WebhookListener handler: {}", e.getMessage(), e);
            throw e; // Requeue message for retry / DLQ logic
        }
    }
}
