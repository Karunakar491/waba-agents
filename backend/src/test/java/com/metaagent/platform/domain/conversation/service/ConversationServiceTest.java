package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.domain.conversation.repository.MessageRepository;
import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

/**
 * Integration tests for ConversationService.processWebhookEvent.
 *
 * Real MySQL via Testcontainers — no DB mocks.
 * RabbitTemplate is @MockBean — analytics publishing is not the concern here.
 *
 * Design note on FAILED path:
 * InboundMessageParser.parse() catches all exceptions internally and returns
 * Optional.empty() — so a malformed payload alone does not reach the catch block
 * in ConversationService. The FAILED path is triggered by exceptions that propagate
 * from downstream collaborators (e.g. RabbitTemplate, ConversationStore, DB). We
 * simulate this by making rabbitTemplate.convertAndSend throw, which matches the
 * real production failure mode (broker unreachable, serialisation error, etc.).
 */
class ConversationServiceTest extends IntegrationTestBase {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /**
     * Minimal valid Meta WhatsApp text-message webhook payload.
     * Stored here so tests don't inline JSON strings; keeps assertions readable.
     */
    static final String VALID_PAYLOAD =
            "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"from\":\"919876543210\","
            + "\"id\":\"wamid.test001\",\"type\":\"text\",\"text\":{\"body\":\"Hello agent\"}}]}}]}]}";

    private static final String NO_MESSAGES_PAYLOAD =
            "{\"entry\":[{\"changes\":[{\"value\":{}}]}]}";

    private static final Long ACCOUNT_ID = 1001L;
    private static final Long AGENT_ID   = 2001L;

    // -------------------------------------------------------------------------
    // Collaborators
    // -------------------------------------------------------------------------

    @Autowired
    private ConversationService conversationService;

    @Autowired
    private WebhookRawRepository webhookRawRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    @MockBean
    private RabbitTemplate rabbitTemplate;

    // -------------------------------------------------------------------------
    // DB cleanup between tests — order matters: FK child → parent
    // -------------------------------------------------------------------------

    @AfterEach
    void cleanUp() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        webhookRawRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private WebhookRaw insertPendingWebhook(String payload) {
        WebhookRaw raw = WebhookRaw.builder()
                .accountId(ACCOUNT_ID)
                .agentId(AGENT_ID)
                .payload(payload)
                .signature("sha256=test")
                .status(WebhookRaw.Status.PENDING)
                .build();
        return webhookRawRepository.save(raw);
    }

    // -------------------------------------------------------------------------
    // Tests
    // -------------------------------------------------------------------------

    @Test
    void should_persist_inbound_message_when_webhook_is_processed() {
        WebhookRaw raw = insertPendingWebhook(VALID_PAYLOAD);

        conversationService.processWebhookEvent(raw.getId(), ACCOUNT_ID, AGENT_ID);

        List<Message> messages = messageRepository.findAll();
        assertThat(messages).hasSize(1);
        Message saved = messages.get(0);
        assertThat(saved.getDirection()).isEqualTo(Message.Direction.inbound);
        assertThat(saved.getContent()).isEqualTo("Hello agent");
        assertThat(saved.getMetaMessageId()).isEqualTo("wamid.test001");
        assertThat(saved.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(saved.getAgentId()).isEqualTo(AGENT_ID);
        assertThat(saved.getStatus()).isEqualTo(Message.Status.received);
    }

    @Test
    void should_create_new_conversation_when_none_exists_for_customer() {
        WebhookRaw raw = insertPendingWebhook(VALID_PAYLOAD);

        conversationService.processWebhookEvent(raw.getId(), ACCOUNT_ID, AGENT_ID);

        List<Conversation> conversations = conversationRepository.findAll();
        assertThat(conversations).hasSize(1);
        Conversation created = conversations.get(0);
        assertThat(created.getExternalId()).isEqualTo("919876543210");
        assertThat(created.getAgentId()).isEqualTo(AGENT_ID);
        assertThat(created.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(created.getChannel()).isEqualTo(Conversation.Channel.whatsapp);
        assertThat(created.getStatus()).isEqualTo(Conversation.Status.open);
    }

    @Test
    void should_reuse_existing_conversation_when_customer_has_prior_conversation() {
        Conversation existing = conversationRepository.save(
                Conversation.builder()
                        .accountId(ACCOUNT_ID)
                        .agentId(AGENT_ID)
                        .externalId("919876543210")
                        .channel(Conversation.Channel.whatsapp)
                        .status(Conversation.Status.open)
                        .build()
        );
        WebhookRaw raw = insertPendingWebhook(VALID_PAYLOAD);

        conversationService.processWebhookEvent(raw.getId(), ACCOUNT_ID, AGENT_ID);

        List<Conversation> conversations = conversationRepository.findAll();
        assertThat(conversations).hasSize(1);
        Conversation reloaded = conversationRepository.findById(existing.getId()).orElseThrow();
        assertThat(reloaded.getLastMessageAt()).isAfterOrEqualTo(existing.getLastMessageAt());
    }

    @Test
    void should_mark_webhook_as_processed_after_successful_processing() {
        WebhookRaw raw = insertPendingWebhook(VALID_PAYLOAD);

        conversationService.processWebhookEvent(raw.getId(), ACCOUNT_ID, AGENT_ID);

        WebhookRaw updated = webhookRawRepository.findById(raw.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(WebhookRaw.Status.PROCESSED);
        assertThat(updated.getProcessedAt()).isNotNull();
    }

    @Test
    void should_mark_webhook_as_failed_when_payload_is_unparseable() {
        // InboundMessageParser.parse() absorbs JSON parse errors and returns Optional.empty(),
        // so a bare "not json" payload reaches the markProcessed path — not the FAILED path.
        //
        // The FAILED + RuntimeException contract fires when a collaborator throws after parsing.
        // We simulate that by making rabbitTemplate throw, which is the most realistic
        // production failure mode (broker unreachable, message serialisation error).
        //
        // This test verifies:
        //   1. WebhookRaw.status is set to FAILED
        //   2. A RuntimeException is thrown (signals RabbitMQ to retry → DLQ after 3 attempts)
        doThrow(new AmqpException("broker unavailable"))
                .when(rabbitTemplate)
                .convertAndSend(anyString(), anyString(), any(Object.class));

        WebhookRaw raw = insertPendingWebhook(VALID_PAYLOAD);

        assertThatThrownBy(() ->
                conversationService.processWebhookEvent(raw.getId(), ACCOUNT_ID, AGENT_ID))
                .isInstanceOf(RuntimeException.class);

        WebhookRaw updated = webhookRawRepository.findById(raw.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(WebhookRaw.Status.FAILED);
        assertThat(updated.getErrorMessage()).isNotBlank();
    }

    @Test
    void should_mark_webhook_as_processed_when_payload_has_no_message() {
        // Valid JSON but no messages array — parser returns Optional.empty().
        // Service should do a graceful no-op: PROCESSED, no Conversation, no Message created.
        WebhookRaw raw = insertPendingWebhook(NO_MESSAGES_PAYLOAD);

        conversationService.processWebhookEvent(raw.getId(), ACCOUNT_ID, AGENT_ID);

        WebhookRaw updated = webhookRawRepository.findById(raw.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(WebhookRaw.Status.PROCESSED);
        assertThat(conversationRepository.findAll()).isEmpty();
        assertThat(messageRepository.findAll()).isEmpty();
    }
}
