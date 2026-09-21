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
        return saveOutbound(accountId, conversationId, agentId, metaMessageId, replyText,
                Message.ContentType.text, null, webhookRawId);
    }

    /**
     * Same, for a reply that was not plain text — a list, a carousel, a button.
     *
     * The three-argument content shape exists because this method used to
     * hardcode ContentType.text and never set contentJson, so an interactive
     * reply was stored as an empty text message: the customer saw five options
     * and the Inbox showed a blank bubble. The inbound path has stored
     * contentJson for interactive messages all along; this is outbound catching
     * up.
     */
    @Transactional
    public Message saveOutbound(Long accountId, Long conversationId, Long agentId,
                                String metaMessageId, String replyText,
                                Message.ContentType contentType, String contentJson, Long webhookRawId) {
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
                        .contentType(contentType == null ? Message.ContentType.text : contentType)
                        .content(replyText) // nullable — unknown when created from status webhook
                        .contentJson(contentJson)
                        .status(Message.Status.sent)
                        .sentAt(LocalDateTime.now())
                        .webhookRawId(webhookRawId)
                        .build()
        );
    }

    /**
     * One outbound reply, however many webhooks describe it.
     *
     * The "sent" status webhook and the message_echoes webhook both describe the
     * SAME reply and arrive in either order, so BOTH call this — whichever gets
     * here first creates the row and the other fills in what it knows. It was
     * named upsertOutboundEcho while the status path called saveOutbound
     * directly and inserted a second row for the same metaMessageId; nothing
     * constrains that column, so the reply appeared twice in the thread.
     *
     * webhookRawId belongs to whichever webhook created the row and is never
     * touched again here.
     */
    @Transactional
    public Message upsertOutbound(Long accountId, Long agentId, Long conversationId,
                                       String metaMessageId, String textBody, Long webhookRawId) {
        return upsertOutbound(accountId, agentId, conversationId, metaMessageId, textBody,
                Message.ContentType.text, null, webhookRawId);
    }

    /**
     * Same, carrying the component a rich reply was made of.
     *
     * A row created first by the "sent" status webhook has no content AND no
     * contentJson, so both are filled in when the echo arrives — otherwise which
     * webhook happened to win the race would decide whether the Inbox can show
     * what the customer saw.
     */
    @Transactional
    public Message upsertOutbound(Long accountId, Long agentId, Long conversationId,
                                       String metaMessageId, String textBody,
                                       Message.ContentType contentType, String contentJson,
                                       Long webhookRawId) {
        return messageRepository.findByMetaMessageId(metaMessageId)
                .map(message -> {
                    boolean changed = false;
                    if (message.getContent() == null && textBody != null) {
                        message.setContent(textBody);
                        changed = true;
                    }
                    if (message.getContentJson() == null && contentJson != null) {
                        message.setContentJson(contentJson);
                        message.setContentType(contentType);
                        changed = true;
                    }
                    if (changed) messageRepository.save(message);
                    return message;
                })
                .orElseGet(() -> saveOutbound(accountId, conversationId, agentId, metaMessageId, textBody,
                        contentType, contentJson, webhookRawId));
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
