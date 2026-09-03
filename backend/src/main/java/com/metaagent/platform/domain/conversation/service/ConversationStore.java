package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.domain.conversation.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Owns all reads and writes for conversations and messages.
 * Every method is a single, named operation — nothing else.
 */
@Service
@RequiredArgsConstructor
public class ConversationStore {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Transactional
    public Conversation findOrCreate(Long accountId, Long agentId, String customerPhone) {
        return conversationRepository
                .findByAgentIdAndExternalId(agentId, customerPhone)
                .orElseGet(() -> conversationRepository.save(
                        Conversation.builder()
                                .accountId(accountId)
                                .agentId(agentId)
                                .externalId(customerPhone)
                                .channel(Conversation.Channel.whatsapp)
                                .status(Conversation.Status.open)
                                .build()
                ));
    }

    @Transactional
    public Message saveInbound(Long accountId, Long conversationId, Long agentId,
                               String metaMessageId, String textBody,
                               Message.ContentType contentType, String contentJson,
                               Long webhookRawId) {
        // Update lastMessageAt in the same transaction — no separate round-trip
        conversationRepository.findById(conversationId).ifPresent(c -> {
            c.setLastMessageAt(LocalDateTime.now());
            conversationRepository.save(c);
        });
        return messageRepository.save(
                Message.builder()
                        .accountId(accountId)
                        .conversationId(conversationId)
                        .agentId(agentId)
                        .direction(Message.Direction.inbound)
                        .metaMessageId(metaMessageId)
                        .contentType(contentType)
                        .content(textBody)
                        .contentJson(contentJson)
                        .status(Message.Status.received)
                        .webhookRawId(webhookRawId)
                        .build()
        );
    }

    /**
     * @param replyText may be null when called from status webhook (sent event) —
     *                  we have no access to message text from a status-only event.
     */
    @Transactional
    public Message saveOutbound(Long accountId, Long conversationId, Long agentId,
                                String metaMessageId, String replyText, Long webhookRawId) {
        conversationRepository.findById(conversationId).ifPresent(c -> {
            c.setLastMessageAt(LocalDateTime.now());
            conversationRepository.save(c);
        });
        return messageRepository.save(
                Message.builder()
                        .accountId(accountId)
                        .conversationId(conversationId)
                        .agentId(agentId)
                        .direction(Message.Direction.outbound)
                        .metaMessageId(metaMessageId)
                        .contentType(Message.ContentType.text)
                        .content(replyText) // nullable — unknown when created from status webhook
                        .status(Message.Status.sent)
                        .sentAt(LocalDateTime.now())
                        .webhookRawId(webhookRawId)
                        .build()
        );
    }

    /**
     * The "sent" status webhook and the message_echoes webhook both describe the same
     * outbound BizAI reply but can arrive in either order. If the status webhook already
     * created the row (with null content), fill in the text now — its webhookRawId (set
     * by whichever webhook created the row first) is never touched here. If the echo
     * arrives first, create the row here instead — same as saveOutbound's "sent" path,
     * originated by this echo webhook.
     */
    @Transactional
    public Message upsertOutboundEcho(Long accountId, Long agentId, Long conversationId,
                                       String metaMessageId, String textBody, Long webhookRawId) {
        return messageRepository.findByMetaMessageId(metaMessageId)
                .map(message -> {
                    if (message.getContent() == null) {
                        message.setContent(textBody);
                        messageRepository.save(message);
                    }
                    return message;
                })
                .orElseGet(() -> saveOutbound(accountId, conversationId, agentId, metaMessageId, textBody, webhookRawId));
    }

    @Transactional
    public void updateMessageStatus(String metaMessageId, Message.Status newStatus) {
        messageRepository.findByMetaMessageId(metaMessageId).ifPresent(message -> {
            message.setStatus(newStatus);
            messageRepository.save(message);
        });
    }

    // Scaffold for standby/handoff detection — provisional, see docs/meta-api/webhook-standby-handoff.md
    @Transactional
    public void markNeedsHuman(Long conversationId) {
        conversationRepository.findById(conversationId).ifPresent(c -> {
            c.setNeedsHuman(true);
            conversationRepository.save(c);
        });
    }
}
