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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for WebhookController — signature verification and hub challenge.
 *
 * Signature scheme: X-Hub-Signature-256 = "sha256=" + hex(HMAC-SHA256(appSecret, rawBody))
 * meta.webhook.app-secret is not set in application-test.yml — we inject it here via
 * @TestPropertySource so that signature enforcement is active for every test in this class.
 *
 * RabbitTemplate is @MockBean — we don't care about publishing in these tests.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "meta.webhook.app-secret=test-app-secret"
})
class WebhookControllerSignatureTest extends IntegrationTestBase {

    private static final String APP_SECRET = "test-app-secret";
    private static final String PAYLOAD    = "{\"entry\":[]}";

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

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Webhook Test Co")
                .email("webhook-sig-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
    }

    @AfterEach
    void cleanUp() {
        webhookRawRepository.deleteAll();
        agentRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Signature verification — POST /api/v1/webhook
    // -------------------------------------------------------------------------

    @Test
    void should_return_200_when_signature_is_valid() throws Exception {
        String signature = computeSignature(APP_SECRET, PAYLOAD);

        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature)
                        .content(PAYLOAD))
                .andExpect(status().isOk());
    }

    @Test
    void should_return_403_when_signature_is_invalid() throws Exception {
        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "sha256=deadbeefdeadbeef")
                        .content(PAYLOAD))
                .andExpect(status().isForbidden());
    }

    @Test
    void should_return_403_when_signature_header_is_missing() throws Exception {
        // app-secret is configured → missing header must be rejected (null → verifySignature returns false)
        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PAYLOAD))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // Tenant resolution — account derived from payload phone_number_id
    // -------------------------------------------------------------------------

    @Test
    void should_persist_webhook_under_agents_account_when_phone_number_id_matches() throws Exception {
        Agent agent = agentRepository.save(Agent.builder()
                .accountId(accountId)
                .displayName("Webhook Agent")
                .phoneNumberId("555000111")
                .enabled(true)
                .status(Agent.Status.active)
                .build());

        String payload = "{\"entry\":[{\"changes\":[{\"value\":{\"metadata\":{\"phone_number_id\":\"555000111\"}}}]}]}";
        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", computeSignature(APP_SECRET, payload))
                        .content(payload))
                .andExpect(status().isOk());

        var saved = webhookRawRepository.findAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getAccountId()).isEqualTo(accountId);
        assertThat(saved.get(0).getAgentId()).isEqualTo(agent.getId());
    }

    @Test
    void should_drop_payload_with_200_when_phone_number_id_matches_no_agent() throws Exception {
        String payload = "{\"entry\":[{\"changes\":[{\"value\":{\"metadata\":{\"phone_number_id\":\"999999999\"}}}]}]}";
        mockMvc.perform(post("/api/v1/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", computeSignature(APP_SECRET, payload))
                        .content(payload))
                .andExpect(status().isOk());

        assertThat(webhookRawRepository.findAll()).isEmpty();
    }

    // -------------------------------------------------------------------------
    // Hub challenge verification — GET /api/v1/webhook
    // -------------------------------------------------------------------------

    @Test
    void should_return_challenge_when_hub_verification_token_matches() throws Exception {
        // meta.webhook.verify-token = "test-verify-token" (from application-test.yml)
        mockMvc.perform(get("/api/v1/webhook")
                        .param("hub.mode", "subscribe")
                        .param("hub.challenge", "abc123")
                        .param("hub.verify_token", "test-verify-token"))
                .andExpect(status().isOk())
                .andExpect(content().string("abc123"));
    }

    @Test
    void should_return_403_when_hub_verify_token_is_wrong() throws Exception {
        mockMvc.perform(get("/api/v1/webhook")
                        .param("hub.mode", "subscribe")
                        .param("hub.challenge", "abc123")
                        .param("hub.verify_token", "wrong-token"))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // Helper — compute HMAC-SHA256 in the same way the controller verifies it
    // -------------------------------------------------------------------------

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
