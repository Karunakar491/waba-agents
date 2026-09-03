package com.metaagent.platform.domain.webhook.controller;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Same WABA/phone number is shared with Karix's separate marketing-campaign product
 * (one webhook callback URL per Meta app). WebhookController must drop status-only
 * webhooks tagged with biz_opaque_callback_data (never set by anything this platform
 * sends) before persistence, while still keeping every real customer message and every
 * genuine AI-agent status event — see plan "idempotent-baking-bentley".
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "meta.webhook.app-secret=test-app-secret"
})
class WebhookControllerCampaignFilterTest extends IntegrationTestBase {

    private static final String APP_SECRET = "test-app-secret";
    private static final String PHONE_NUMBER_ID = "555000222";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WebhookRawRepository webhookRawRepository;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    @MockBean
    private RabbitTemplate rabbitTemplate;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Campaign Filter Test Co")
                .email("webhook-campaign-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        agentRepository.save(Agent.builder()
                .accountId(account.getId())
                .displayName("Campaign Filter Agent")
                .phoneNumberId(PHONE_NUMBER_ID)
                .enabled(true)
                .status(Agent.Status.active)
                .build());
    }

    @AfterEach
    void cleanUp() {
        webhookRawRepository.deleteAll();
        agentRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void should_drop_status_only_payload_with_biz_opaque_callback_data() throws Exception {
        // Real captured shape from Karix's campaign product on the same WABA.
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"metadata\":{\"phone_number_id\":\"" + PHONE_NUMBER_ID + "\"},"
                + "\"statuses\":[{\"id\":\"wamid.CAMPAIGN\",\"status\":\"delivered\","
                + "\"pricing\":{\"category\":\"utility\"},"
                + "\"biz_opaque_callback_data\":\"2026-08-20_campaign-batch-42\"}]"
                + "}}]}]}";

        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", computeSignature(APP_SECRET, payload))
                        .content(payload))
                .andExpect(status().isOk());

        assertThat(webhookRawRepository.findAll()).isEmpty();
        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void should_keep_status_only_payload_without_biz_opaque_callback_data() throws Exception {
        // Genuine AI-agent delivery status — same "utility" category, no campaign tag.
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"metadata\":{\"phone_number_id\":\"" + PHONE_NUMBER_ID + "\"},"
                + "\"statuses\":[{\"id\":\"wamid.AGENT\",\"status\":\"delivered\","
                + "\"pricing\":{\"category\":\"utility\"}}]"
                + "}}]}]}";

        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", computeSignature(APP_SECRET, payload))
                        .content(payload))
                .andExpect(status().isOk());

        assertThat(webhookRawRepository.findAll()).hasSize(1);
    }

    @Test
    void should_keep_payload_with_real_message_even_if_biz_opaque_callback_data_present() throws Exception {
        // messages must never be dropped, regardless of any other field present.
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{"
                + "\"metadata\":{\"phone_number_id\":\"" + PHONE_NUMBER_ID + "\"},"
                + "\"messages\":[{\"id\":\"wamid.INBOUND\",\"from\":\"91891927xxxx\",\"type\":\"text\"}],"
                + "\"statuses\":[{\"id\":\"wamid.OTHER\",\"status\":\"delivered\","
                + "\"biz_opaque_callback_data\":\"2026-08-20_campaign-batch-42\"}]"
                + "}}]}]}";

        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", computeSignature(APP_SECRET, payload))
                        .content(payload))
                .andExpect(status().isOk());

        assertThat(webhookRawRepository.findAll()).hasSize(1);
    }

    private String computeSignature(String secret, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] raw = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(raw.length * 2);
        for (byte b : raw) {
            hex.append(String.format("%02x", b));
        }
        return "sha256=" + hex;
    }
}
