package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.domain.conversation.repository.MessageRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for ConversationStore.
 *
 * Real MySQL via Testcontainers — no DB mocks.
 * RabbitTemplate is @MockBean (inherited from IntegrationTestBase via ConversationService wiring).
 */
class ConversationStoreTest extends IntegrationTestBase {

    private static final Long ACCOUNT_ID = 1001L;
    private static final Long AGENT_ID   = 2001L;

    @Autowired
    private ConversationStore conversationStore;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    // -------------------------------------------------------------------------
    // DB cleanup — FK child → parent
    // -------------------------------------------------------------------------

    @AfterEach
    void cleanUp() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // findOrCreate
    // -------------------------------------------------------------------------

    @Test
    void should_create_conversation_when_none_exists() {
        String customerPhone = "919876543210";

        Conversation result = conversationStore.findOrCreate(ACCOUNT_ID, AGENT_ID, customerPhone);

        assertThat(result.getId()).isNotNull();
        assertThat(result.getExternalId()).isEqualTo(customerPhone);
        assertThat(result.getAgentId()).isEqualTo(AGENT_ID);
        assertThat(result.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(result.getChannel()).isEqualTo(Conversation.Channel.whatsapp);
        assertThat(result.getStatus()).isEqualTo(Conversation.Status.open);
        assertThat(conversationRepository.findAll()).hasSize(1);
    }

    @Test
    void should_return_existing_conversation_when_already_exists() {
        String customerPhone = "919876543210";

        Conversation first  = conversationStore.findOrCreate(ACCOUNT_ID, AGENT_ID, customerPhone);
        Conversation second = conversationStore.findOrCreate(ACCOUNT_ID, AGENT_ID, customerPhone);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(conversationRepository.findAll()).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // saveInbound
    // -------------------------------------------------------------------------

    @Test
    void should_save_inbound_message_with_correct_fields() {
        Conversation conversation = conversationStore.findOrCreate(ACCOUNT_ID, AGENT_ID, "919876543210");

        Message saved = conversationStore.saveInbound(
                ACCOUNT_ID,
                conversation.getId(),
                AGENT_ID,
                "wamid.inbound001",
                "Hello from customer",
                Message.ContentType.text,
                null
        );

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getDirection()).isEqualTo(Message.Direction.inbound);
        assertThat(saved.getContent()).isEqualTo("Hello from customer");
        assertThat(saved.getMetaMessageId()).isEqualTo("wamid.inbound001");
        assertThat(saved.getStatus()).isEqualTo(Message.Status.received);
        assertThat(saved.getContentType()).isEqualTo(Message.ContentType.text);
        assertThat(saved.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(saved.getAgentId()).isEqualTo(AGENT_ID);
        assertThat(saved.getConversationId()).isEqualTo(conversation.getId());
        assertThat(saved.getReceivedAt()).isNotNull();
        assertThat(saved.getSentAt()).isNull();

        List<Message> all = messageRepository.findAllByConversationId(conversation.getId());
        assertThat(all).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // saveOutbound
    // -------------------------------------------------------------------------

    @Test
    void should_save_outbound_message_with_sent_status_and_sentAt() {
        Conversation conversation = conversationStore.findOrCreate(ACCOUNT_ID, AGENT_ID, "919876543210");

        Message saved = conversationStore.saveOutbound(
                ACCOUNT_ID,
                conversation.getId(),
                AGENT_ID,
                "wamid.outbound001",
                "Hello from agent"
        );

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getDirection()).isEqualTo(Message.Direction.outbound);
        assertThat(saved.getContent()).isEqualTo("Hello from agent");
        assertThat(saved.getMetaMessageId()).isEqualTo("wamid.outbound001");
        assertThat(saved.getStatus()).isEqualTo(Message.Status.sent);
        assertThat(saved.getContentType()).isEqualTo(Message.ContentType.text);
        assertThat(saved.getSentAt()).isNotNull();
        assertThat(saved.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(saved.getAgentId()).isEqualTo(AGENT_ID);
        assertThat(saved.getConversationId()).isEqualTo(conversation.getId());

        List<Message> all = messageRepository.findAllByConversationId(conversation.getId());
        assertThat(all).hasSize(1);
        assertThat(all.get(0).getDirection()).isEqualTo(Message.Direction.outbound);
    }
}
