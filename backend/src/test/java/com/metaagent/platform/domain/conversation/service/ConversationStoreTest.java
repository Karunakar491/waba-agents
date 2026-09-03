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

    /**
     * Seeded too, for the same reason as the agent: `agent.account_id` has its own
     * FK to `business_account` (fk_agent_account), so a hardcoded 1001L only
     * resolved while another class had left a matching row in the reused container.
     */
    private Long accountId;

    /**
     * Seeded per test rather than hardcoded. `conversations.agent_id` has a real
     * FK to `agent` (fk_conv_agent, since V2), so a fixed literal only worked
     * while some other test class happened to run first and leave a matching row
     * behind in the reused Testcontainers MySQL — order-dependent, and it fails
     * the moment this class runs alone.
     */
    private Long agentId;

    @Autowired
    private ConversationStore conversationStore;

    @Autowired
    private com.metaagent.platform.domain.agent.repository.AgentRepository agentRepository;

    @Autowired
    private com.metaagent.platform.domain.user.repository.BusinessAccountRepository businessAccountRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    // -------------------------------------------------------------------------
    // DB cleanup — FK child → parent
    // -------------------------------------------------------------------------

    @org.junit.jupiter.api.BeforeEach
    void seedAgent() {
        accountId = businessAccountRepository.save(
                com.metaagent.platform.domain.user.entity.BusinessAccount.builder()
                        .name("Conversation Store Test Co")
                        .email("conv-store-" + java.util.UUID.randomUUID() + "@example.com")
                        .passwordHash("hashed")
                        .build()).getId();

        agentId = agentRepository.save(com.metaagent.platform.domain.agent.entity.Agent.builder()
                .accountId(accountId)
                .phoneNumberId("conv-store-test")
                .displayName("Conversation Store Test Agent")
                .enabled(false)
                .status(com.metaagent.platform.domain.agent.entity.Agent.Status.draft)
                .build()).getId();
    }

    @AfterEach
    void cleanUp() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        // Only the agent this class seeded. A blanket deleteAll() here would strip
        // rows other test classes currently depend on finding in the reused
        // container — the same order-coupling this fix exists to stop relying on.
        if (agentId != null) {
            agentRepository.deleteById(agentId);
        }
        if (accountId != null) {
            businessAccountRepository.deleteById(accountId);
        }
    }

    // -------------------------------------------------------------------------
    // findOrCreate
    // -------------------------------------------------------------------------

    @Test
    void should_create_conversation_when_none_exists() {
        String customerPhone = "919876543210";

        Conversation result = conversationStore.findOrCreate(accountId, agentId, customerPhone);

        assertThat(result.getId()).isNotNull();
        assertThat(result.getExternalId()).isEqualTo(customerPhone);
        assertThat(result.getAgentId()).isEqualTo(agentId);
        assertThat(result.getAccountId()).isEqualTo(accountId);
        assertThat(result.getChannel()).isEqualTo(Conversation.Channel.whatsapp);
        assertThat(result.getStatus()).isEqualTo(Conversation.Status.open);
        assertThat(conversationRepository.findAll()).hasSize(1);
    }

    @Test
    void should_return_existing_conversation_when_already_exists() {
        String customerPhone = "919876543210";

        Conversation first  = conversationStore.findOrCreate(accountId, agentId, customerPhone);
        Conversation second = conversationStore.findOrCreate(accountId, agentId, customerPhone);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(conversationRepository.findAll()).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // saveInbound
    // -------------------------------------------------------------------------

    @Test
    void should_save_inbound_message_with_correct_fields() {
        Conversation conversation = conversationStore.findOrCreate(accountId, agentId, "919876543210");

        Message saved = conversationStore.saveInbound(
                accountId,
                conversation.getId(),
                agentId,
                "wamid.inbound001",
                "Hello from customer",
                Message.ContentType.text,
                null,
                42L
        );

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getDirection()).isEqualTo(Message.Direction.inbound);
        assertThat(saved.getContent()).isEqualTo("Hello from customer");
        assertThat(saved.getMetaMessageId()).isEqualTo("wamid.inbound001");
        assertThat(saved.getStatus()).isEqualTo(Message.Status.received);
        assertThat(saved.getContentType()).isEqualTo(Message.ContentType.text);
        assertThat(saved.getAccountId()).isEqualTo(accountId);
        assertThat(saved.getAgentId()).isEqualTo(agentId);
        assertThat(saved.getConversationId()).isEqualTo(conversation.getId());
        assertThat(saved.getReceivedAt()).isNotNull();
        assertThat(saved.getSentAt()).isNull();
        assertThat(saved.getWebhookRawId()).isEqualTo(42L);

        List<Message> all = messageRepository.findAllByConversationId(conversation.getId());
        assertThat(all).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // saveOutbound
    // -------------------------------------------------------------------------

    @Test
    void should_save_outbound_message_with_sent_status_and_sentAt() {
        Conversation conversation = conversationStore.findOrCreate(accountId, agentId, "919876543210");

        Message saved = conversationStore.saveOutbound(
                accountId,
                conversation.getId(),
                agentId,
                "wamid.outbound001",
                "Hello from agent",
                99L
        );

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getDirection()).isEqualTo(Message.Direction.outbound);
        assertThat(saved.getContent()).isEqualTo("Hello from agent");
        assertThat(saved.getMetaMessageId()).isEqualTo("wamid.outbound001");
        assertThat(saved.getStatus()).isEqualTo(Message.Status.sent);
        assertThat(saved.getContentType()).isEqualTo(Message.ContentType.text);
        assertThat(saved.getSentAt()).isNotNull();
        assertThat(saved.getAccountId()).isEqualTo(accountId);
        assertThat(saved.getAgentId()).isEqualTo(agentId);
        assertThat(saved.getConversationId()).isEqualTo(conversation.getId());
        assertThat(saved.getWebhookRawId()).isEqualTo(99L);

        List<Message> all = messageRepository.findAllByConversationId(conversation.getId());
        assertThat(all).hasSize(1);
        assertThat(all.get(0).getDirection()).isEqualTo(Message.Direction.outbound);
    }
}
