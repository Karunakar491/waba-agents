package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.model.InboundMessage;
import com.metaagent.platform.domain.conversation.model.StatusUpdate;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.domain.conversation.repository.MessageRepository;
import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Handles inbound webhook events from Meta.
 *
 * Meta's AI generates all customer replies — we do NOT proxy through Claude.
 * Our job: persist the conversation record, publish analytics. That's it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

    private final WebhookRawRepository webhookRawRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final InboundMessageParser parser;
    private final StatusUpdateParser statusUpdateParser;
    private final ConversationStore conversationStore;
    private final RabbitTemplate rabbitTemplate;

    @Value("${meta.webhook.exchange:platform.events}")
    private String exchange;

    @Value("${meta.webhook.analytics-routing-key:message.sent}")
    private String analyticsRoutingKey;

    // -------------------------------------------------------------------------
    // Inbound pipeline — called from RabbitMQ listener (no Security context)
    // -------------------------------------------------------------------------

    @Transactional
    public void processWebhookEvent(Long webhookRawId, Long accountId, Long agentId) {
        log.info("Processing webhook: id={} accountId={} agentId={}", webhookRawId, accountId, agentId);

        WebhookRaw raw = markProcessing(webhookRawId);
        if (raw == null) {
            return; // idempotency — already claimed by another consumer
        }

        try {
            Optional<InboundMessage> parsed = parser.parse(raw.getPayload());
            if (parsed.isEmpty()) {
                // Not an inbound message — check if it's a status update
                Optional<StatusUpdate> statusUpdate = statusUpdateParser.parse(raw.getPayload());
                if (statusUpdate.isPresent()) {
                    processStatusUpdate(statusUpdate.get(), accountId, agentId);
                }
                markProcessed(raw);
                return;
            }

            InboundMessage inbound = parsed.get();

            Conversation conversation = conversationStore.findOrCreate(accountId, agentId, inbound.customerPhone());
            Message.ContentType contentType = resolveContentType(inbound.messageType());
            conversationStore.saveInbound(accountId, conversation.getId(), agentId,
                    inbound.metaMessageId(), inbound.textBody(), contentType, inbound.contentJson());

            publishAnalyticsEvent(accountId, agentId, conversation.getId());

            markProcessed(raw);

        } catch (Exception e) {
            log.error("Webhook processing failed: id={} error={}", webhookRawId, e.getMessage(), e);
            markFailed(raw, e.getMessage());
            throw new RuntimeException(e); // triggers RabbitMQ retry → DLQ after 3 attempts
        }
    }

    // -------------------------------------------------------------------------
    // Read APIs — HTTP-bound, Security context is present
    // -------------------------------------------------------------------------

    public List<Conversation> getConversations(Long agentId, int page, int size) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        var pageable = PageRequest.of(page, size, Sort.by("lastMessageAt").descending());
        return conversationRepository.findAllByAgentIdAndAccountId(agentId, accountId, pageable);
    }

    public List<Message> getConversationMessages(Long conversationId, int page, int size) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        conversationRepository.findByIdAndAccountId(conversationId, accountId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        var pageable = PageRequest.of(page, size, Sort.by("receivedAt").descending());
        List<Message> messages = messageRepository
                .findAllByConversationIdAndAccountId(conversationId, accountId, pageable);
        Collections.reverse(messages); // chronological order for chat rendering
        return messages;
    }

    // -------------------------------------------------------------------------
    // Private — webhook lifecycle
    // -------------------------------------------------------------------------

    @Transactional
    WebhookRaw markProcessing(Long webhookRawId) {
        int claimed = webhookRawRepository.claimForProcessing(webhookRawId);
        if (claimed == 0) {
            log.debug("Duplicate webhook delivery skipped: id={}", webhookRawId);
            return null; // already PROCESSING or PROCESSED — caller checks for null
        }
        return webhookRawRepository.findById(webhookRawId)
                .orElseThrow(() -> new NotFoundException("WebhookRaw not found: " + webhookRawId));
    }

    @Transactional
    void markProcessed(WebhookRaw raw) {
        raw.setStatus(WebhookRaw.Status.PROCESSED);
        raw.setProcessedAt(LocalDateTime.now());
        webhookRawRepository.save(raw);
    }

    @Transactional
    void markFailed(WebhookRaw raw, String errorMessage) {
        raw.setStatus(WebhookRaw.Status.FAILED);
        raw.setErrorMessage(errorMessage);
        webhookRawRepository.save(raw);
    }

    private Message.ContentType resolveContentType(String metaType) {
        return switch (metaType) {
            case "image"       -> Message.ContentType.image;
            case "audio"       -> Message.ContentType.audio;
            case "video"       -> Message.ContentType.video;
            case "document"    -> Message.ContentType.document;
            case "template"    -> Message.ContentType.template;
            case "interactive" -> Message.ContentType.interactive;
            default            -> Message.ContentType.text;
        };
    }

    private void processStatusUpdate(StatusUpdate su, Long accountId, Long agentId) {
        Message.Status newStatus = resolveMessageStatus(su.status());
        if (newStatus == null) {
            return; // unknown status from Meta — logged inside resolveMessageStatus
        }
        if (newStatus == Message.Status.sent) {
            // Decision D1: create outbound record on first 'sent' status receipt.
            // Meta sends the AI reply directly — we learn about it only via this status webhook.
            // recipientPhone is the customer — findOrCreate gets or creates the conversation.
            // Content is null: we have no access to the message text from a status event.
            Conversation conversation = conversationStore.findOrCreate(accountId, agentId, su.recipientPhone());
            conversationStore.saveOutbound(accountId, conversation.getId(), agentId,
                    su.metaMessageId(), null);
            log.info("Outbound record created: metaMessageId={} conversationId={}",
                    su.metaMessageId(), conversation.getId());
        } else {
            conversationStore.updateMessageStatus(su.metaMessageId(), newStatus);
            log.info("Message status updated: metaMessageId={} status={}", su.metaMessageId(), newStatus);
        }
    }

    private Message.Status resolveMessageStatus(String metaStatus) {
        return switch (metaStatus) {
            case "sent"      -> Message.Status.sent;
            case "delivered" -> Message.Status.delivered;
            case "read"      -> Message.Status.read;
            case "failed"    -> Message.Status.failed;
            default -> {
                log.warn("Unknown Meta message status: {}", metaStatus);
                yield null;
            }
        };
    }

    private void publishAnalyticsEvent(Long accountId, Long agentId, Long conversationId) {
        try {
            rabbitTemplate.convertAndSend(exchange, analyticsRoutingKey, Map.of(
                    "accountId", accountId,
                    "agentId", agentId,
                    "conversationId", conversationId,
                    "eventType", "message",
                    "channel", "whatsapp",
                    "receivedAt", System.currentTimeMillis(),
                    "status", "received"
            ));
        } catch (Exception e) {
            // Analytics failure must never kill the message pipeline
            log.warn("Failed to publish analytics event: accountId={} agentId={} error={}",
                    accountId, agentId, e.getMessage());
        }
    }
}
