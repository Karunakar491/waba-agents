package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration tests for AgentDeployService.
 *
 * Real MySQL via Testcontainers (from IntegrationTestBase).
 * MetaApiClient is @MockBean — never calls real Meta APIs.
 * SecurityContext is set/cleared per test.
 */
class AgentDeployServiceTest extends IntegrationTestBase {

    @Autowired
    private AgentDeployService agentDeployService;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    // Populated in @BeforeEach — TSID-generated, so we can't hardcode it
    private Long accountId;
    private Long otherAccountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Test Company")
                .email("deploy-test-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();

        BusinessAccount other = businessAccountRepository.save(BusinessAccount.builder()
                .name("Other Company")
                .email("other-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        otherAccountId = other.getId();

        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        agentRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // deploy()
    // -------------------------------------------------------------------------

    @Test
    void should_set_agent_status_to_active_when_deploy_succeeds() {
        Agent saved = agentRepository.save(draftAgent("111111111"));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        Agent result = agentDeployService.deploy(saved.getId());

        assertThat(result.getStatus()).isEqualTo(Agent.Status.active);
        assertThat(result.getDeployedAt()).isNotNull();

        // Verify persisted state — not just in-memory
        Agent fromDb = agentRepository.findById(saved.getId()).orElseThrow();
        assertThat(fromDb.getStatus()).isEqualTo(Agent.Status.active);
        assertThat(fromDb.getDeployedAt()).isNotNull();
    }

    @Test
    void should_call_meta_settings_api_with_rollout_enabled_true_when_deploying() {
        Agent saved = agentRepository.save(draftAgent("222222222"));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        agentDeployService.deploy(saved.getId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).put(pathCaptor.capture(), payloadCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("/agent_config/settings");

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload).containsKey("rollout");
        @SuppressWarnings("unchecked")
        Map<String, Object> rollout = (Map<String, Object>) payload.get("rollout");
        assertThat(rollout.get("enabled")).isEqualTo(true);
    }

    @Test
    void should_throw_business_exception_when_agent_already_active() {
        Agent active = agentRepository.save(activeAgent("333333333"));

        assertThatThrownBy(() -> agentDeployService.deploy(active.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already active");

        verifyNoInteractions(metaApiClient);
    }

    @Test
    void should_set_agent_status_to_paused_when_pause_succeeds() {
        Agent saved = agentRepository.save(draftAgent("444444444"));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        // Deploy first so status becomes ACTIVE
        agentDeployService.deploy(saved.getId());

        // Now pause
        Agent paused = agentDeployService.pause(saved.getId());

        assertThat(paused.getStatus()).isEqualTo(Agent.Status.paused);

        Agent fromDb = agentRepository.findById(saved.getId()).orElseThrow();
        assertThat(fromDb.getStatus()).isEqualTo(Agent.Status.paused);
    }

    @Test
    void should_throw_business_exception_when_meta_api_fails_on_deploy() {
        Agent saved = agentRepository.save(draftAgent("555555555"));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenThrow(new RuntimeException("Meta API unreachable"));

        assertThatThrownBy(() -> agentDeployService.deploy(saved.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Meta settings update failed");

        // DB must NOT reflect a status change — Meta API first, DB second rule
        Agent fromDb = agentRepository.findById(saved.getId()).orElseThrow();
        assertThat(fromDb.getStatus()).isEqualTo(Agent.Status.draft);
        assertThat(fromDb.getDeployedAt()).isNull();
    }

    @Test
    void should_send_handoff_enabled_true_with_message_when_agent_has_handoff_configured() {
        Agent agent = draftAgent("777777777");
        agent.setHandoffEnabled(true);
        agent.setHandoffMessage("A human will join shortly.");
        Agent saved = agentRepository.save(agent);
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        agentDeployService.deploy(saved.getId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(anyString(), payloadCaptor.capture(), eq(Map.class));

        @SuppressWarnings("unchecked")
        Map<String, Object> handoff = (Map<String, Object>) payloadCaptor.getValue().get("handoff");
        assertThat(handoff.get("enabled")).isEqualTo(true);
        assertThat(handoff.get("message")).isEqualTo("A human will join shortly.");
    }

    @Test
    void should_send_handoff_enabled_false_by_default_when_agent_has_no_handoff_configured() {
        Agent saved = agentRepository.save(draftAgent("888888888"));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        agentDeployService.deploy(saved.getId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(anyString(), payloadCaptor.capture(), eq(Map.class));

        @SuppressWarnings("unchecked")
        Map<String, Object> handoff = (Map<String, Object>) payloadCaptor.getValue().get("handoff");
        assertThat(handoff.get("enabled")).isEqualTo(false);
        assertThat(handoff).doesNotContainKey("message");
    }

    // -------------------------------------------------------------------------
    // putSettings() full-replace safety (Wave 1a, 2026-08-03): settings PUT is
    // a documented full replace (settings.md) — followup/ai_audience are real
    // operator-configured fields we don't manage locally. Before this fix,
    // deploy/pause/bindPhone hardcoded followup off + ai_audience EVERYONE on
    // every call, silently destroying a client's real audience restriction or
    // followup config. These tests guard the read-modify-write fix.
    // -------------------------------------------------------------------------

    @Test
    void should_preserve_live_followup_and_ai_audience_when_deploying() {
        Agent saved = agentRepository.save(draftAgent("101010101"));
        Map<String, Object> liveFollowup = Map.of("enabled", true, "followup_interval_in_seconds", 900, "message", "Still there?");
        when(metaApiClient.get(contains("/agent_config/settings"), eq(List.class)))
                .thenReturn(List.of(Map.of(
                        "channel", "whatsapp",
                        "followup", liveFollowup,
                        "ai_audience", "ALLOWLISTED_ONLY")));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        agentDeployService.deploy(saved.getId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(anyString(), payloadCaptor.capture(), eq(Map.class));
        Map<String, Object> payload = payloadCaptor.getValue();

        assertThat(payload.get("followup")).isEqualTo(liveFollowup);
        assertThat(payload.get("ai_audience")).isEqualTo("ALLOWLISTED_ONLY");
    }

    @Test
    void should_only_read_whatsapp_channel_entry_ignoring_other_channels() {
        Agent saved = agentRepository.save(draftAgent("101010102"));
        // A multi-channel number — the messenger entry at index 0 must NOT be
        // read as if it were the WhatsApp channel's config.
        when(metaApiClient.get(contains("/agent_config/settings"), eq(List.class)))
                .thenReturn(List.of(
                        Map.of("channel", "messenger", "ai_audience", "EVERYONE", "followup", Map.of("enabled", false)),
                        Map.of("channel", "whatsapp", "ai_audience", "ALLOWLISTED_ONLY", "followup", Map.of("enabled", true, "message", "wa followup"))
                ));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        agentDeployService.deploy(saved.getId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(anyString(), payloadCaptor.capture(), eq(Map.class));
        Map<String, Object> payload = payloadCaptor.getValue();

        assertThat(payload.get("ai_audience")).isEqualTo("ALLOWLISTED_ONLY");
        @SuppressWarnings("unchecked")
        Map<String, Object> followup = (Map<String, Object>) payload.get("followup");
        assertThat(followup.get("message")).isEqualTo("wa followup");
    }

    @Test
    void should_fall_back_to_safe_defaults_when_live_settings_read_fails() {
        Agent saved = agentRepository.save(draftAgent("101010103"));
        when(metaApiClient.get(contains("/agent_config/settings"), eq(List.class)))
                .thenThrow(new RuntimeException("Meta unreachable"));
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        // Must not throw — a failed pre-read must never block deploy.
        agentDeployService.deploy(saved.getId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(anyString(), payloadCaptor.capture(), eq(Map.class));
        Map<String, Object> payload = payloadCaptor.getValue();

        assertThat(payload.get("ai_audience")).isEqualTo("EVERYONE");
        @SuppressWarnings("unchecked")
        Map<String, Object> followup = (Map<String, Object>) payload.get("followup");
        assertThat(followup.get("enabled")).isEqualTo(false);
    }

    // -------------------------------------------------------------------------
    // getConnectorLogs()
    // -------------------------------------------------------------------------

    @Test
    void should_include_analytics_params_in_connector_logs_query_when_provided() {
        Agent saved = agentRepository.save(draftAgent("121212121"));
        when(metaApiClient.get(anyString(), eq(Map.class))).thenReturn(Map.of("data", List.of()));

        agentDeployService.getConnectorLogs(saved.getId(), "conn-1", null, null, null, null, true, true, 5);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).get(pathCaptor.capture(), eq(Map.class));

        String path = pathCaptor.getValue();
        assertThat(path).contains("include_stats=true");
        assertThat(path).contains("summary_only=true");
        assertThat(path).contains("top_n=5");
    }

    @Test
    void should_omit_analytics_params_from_connector_logs_query_when_null() {
        Agent saved = agentRepository.save(draftAgent("131313131"));
        when(metaApiClient.get(anyString(), eq(Map.class))).thenReturn(Map.of("data", List.of()));

        agentDeployService.getConnectorLogs(saved.getId(), "conn-1", null, null, null, null, null, null, null);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).get(pathCaptor.capture(), eq(Map.class));

        String path = pathCaptor.getValue();
        assertThat(path).doesNotContain("include_stats");
        assertThat(path).doesNotContain("summary_only");
        assertThat(path).doesNotContain("top_n");
    }

    // -------------------------------------------------------------------------
    // Connector credential rotation (connectors.md upsertApiKey/Certificate/OAuth)
    // -------------------------------------------------------------------------

    @Test
    void should_post_to_upsert_api_key_path_with_payload_when_rotating_connector_api_key() {
        Agent saved = agentRepository.save(draftAgent("121212121"));
        Map<String, Object> payload = Map.of("headers", List.of(Map.of("field_name", "X-Api-Key", "value", "secret123")));
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "conn_1", "connection_status", Map.of("status", "ACTIVE")));

        Map<String, Object> result = agentDeployService.upsertConnectorApiKey(saved.getId(), "conn_1", payload);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).post(pathCaptor.capture(), payloadCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("/agent_connectors/conn_1/upsertApiKey");
        assertThat(payloadCaptor.getValue()).isEqualTo(payload);
        assertThat(result.get("id")).isEqualTo("conn_1");
    }

    @Test
    void should_post_to_upsert_certificate_path_with_payload_when_rotating_connector_certificate() {
        Agent saved = agentRepository.save(draftAgent("131313131"));
        Map<String, Object> payload = Map.of(
                "client_certificate", "-----BEGIN CERTIFICATE-----abc-----END CERTIFICATE-----",
                "client_key", "-----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----");
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "conn_2", "connection_status", Map.of("status", "ACTIVE")));

        Map<String, Object> result = agentDeployService.upsertConnectorCertificate(saved.getId(), "conn_2", payload);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).post(pathCaptor.capture(), payloadCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("/agent_connectors/conn_2/upsertCertificate");
        assertThat(payloadCaptor.getValue()).isEqualTo(payload);
        assertThat(result.get("id")).isEqualTo("conn_2");
    }

    @Test
    void should_post_to_upsert_oauth_path_with_payload_when_rotating_connector_oauth() {
        Agent saved = agentRepository.save(draftAgent("141414141"));
        Map<String, Object> payload = Map.of(
                "token_url", "https://example.com/oauth/token",
                "scopes_to_request", List.of("read", "write"),
                "client_id", "client-123",
                "client_secret", "shh");
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "conn_3", "connection_status", Map.of("status", "PENDING_OAUTH")));

        Map<String, Object> result = agentDeployService.upsertConnectorOAuth(saved.getId(), "conn_3", payload);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).post(pathCaptor.capture(), payloadCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("/agent_connectors/conn_3/upsertOAuth");
        assertThat(payloadCaptor.getValue()).isEqualTo(payload);
        assertThat(result.get("id")).isEqualTo("conn_3");
    }

    // -------------------------------------------------------------------------
    // Connector tools — getTool() / updateTool()
    // -------------------------------------------------------------------------

    @Test
    void should_get_tool_from_correct_path_when_fetching_single_tool() {
        Agent saved = agentRepository.save(draftAgent("151515151"));
        when(metaApiClient.get(anyString(), eq(Map.class)))
                .thenReturn(Map.of("name", "check_order_status"));

        Map<String, Object> result = agentDeployService.getTool(saved.getId(), "conn_4", "tool_9");

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).get(pathCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("/agent_connectors/conn_4/tools/tool_9");
        assertThat(result.get("name")).isEqualTo("check_order_status");
    }

    @Test
    void should_put_tool_definition_to_correct_path_when_updating_tool() {
        Agent saved = agentRepository.save(draftAgent("161616161"));
        Map<String, Object> payload = Map.of(
                "name", "check_order_status",
                "description", "Checks the status of an order by order id.",
                "request_definition", Map.of("method", "GET", "path", "/orders/{order_id}"),
                "user_auth_required", false);
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("name", "check_order_status", "updated", true));

        Map<String, Object> result = agentDeployService.updateTool(saved.getId(), "conn_5", "tool_10", payload);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(pathCaptor.capture(), payloadCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("/agent_connectors/conn_5/tools/tool_10");
        assertThat(payloadCaptor.getValue()).isEqualTo(payload);
        assertThat(result.get("updated")).isEqualTo(true);
    }

    // -------------------------------------------------------------------------
    // releaseThreadControl()
    // -------------------------------------------------------------------------

    @Test
    void should_call_thread_control_client_release_with_phone_number_id() {
        Agent saved = agentRepository.save(draftAgent("999999999"));

        agentDeployService.releaseThreadControl(saved.getId(), null);

        verify(threadControlClient).release("999999999", null);
    }

    // Wave 2 (2026-08-03): "to" (thread-control.md) targets a specific
    // conversation — omitting it releases the whole number instead.
    @Test
    void should_pass_customer_phone_through_to_thread_control_client() {
        Agent saved = agentRepository.save(draftAgent("999999998"));

        agentDeployService.releaseThreadControl(saved.getId(), "15550001111");

        verify(threadControlClient).release("999999998", "15550001111");
    }

    @Test
    void should_throw_business_exception_when_releasing_thread_control_without_phone_number() {
        Agent agent = Agent.builder()
                .accountId(accountId)
                .displayName("No Phone Agent")
                .enabled(false)
                .status(Agent.Status.draft)
                .build();
        Agent saved = agentRepository.save(agent);

        assertThatThrownBy(() -> agentDeployService.releaseThreadControl(saved.getId(), null))
                .isInstanceOf(BusinessException.class);

        verifyNoInteractions(threadControlClient);
    }

    /**
     * A draft has never answered a customer, so the "already stopped
     * responding" premise behind the pause requirement doesn't apply to it.
     * Missing this exemption meant deleting an abandoned draft removed our own
     * row but left its agent configuration behind on Meta: the delete returned
     * 200 with the "Agent configuration" step FAILED and the pause message
     * attached (seen in production 2026-09-03).
     */
    @Test
    void should_remove_a_draft_from_meta_without_requiring_a_pause_first() {
        Agent saved = agentRepository.save(draftAgent("909090901"));

        agentDeployService.deleteFromMeta(saved.getId());

        verify(metaApiClient).delete("/909090901/delete_agent");
    }

    @Test
    void should_still_refuse_to_remove_an_active_agent_from_meta() {
        Agent saved = agentRepository.save(activeAgent("909090902"));

        assertThatThrownBy(() -> agentDeployService.deleteFromMeta(saved.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Pause the agent");

        verifyNoInteractions(metaApiClient);
    }

    @Test
    void should_throw_not_found_when_agent_belongs_to_different_account() {
        // Agent belongs to accountId (the main test account)
        Agent saved = agentRepository.save(draftAgent("666666666"));

        // Switch security context to a different account
        authenticateAs(otherAccountId);

        assertThatThrownBy(() -> agentDeployService.deploy(saved.getId()))
                .isInstanceOf(NotFoundException.class);

        verifyNoInteractions(metaApiClient);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Agent draftAgent(String phoneNumberId) {
        return Agent.builder()
                .accountId(accountId)
                .phoneNumberId(phoneNumberId)
                .displayName("Test Agent")
                .enabled(false)
                .status(Agent.Status.draft)
                .build();
    }

    private Agent activeAgent(String phoneNumberId) {
        return Agent.builder()
                .accountId(accountId)
                .phoneNumberId(phoneNumberId)
                .displayName("Test Agent")
                .enabled(true)
                .status(Agent.Status.active)
                .build();
    }

    /**
     * Sets up a Spring Security context authenticated as the given accountId.
     * SecurityContextHelper reads from auth.getDetails() — TenantDetails must be
     * set via authentication.setDetails(), not as the principal.
     */
    private void authenticateAs(Long targetAccountId) {
        TenantDetails tenantDetails = new TenantDetails(targetAccountId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        authentication.setDetails(tenantDetails);

        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }
}
