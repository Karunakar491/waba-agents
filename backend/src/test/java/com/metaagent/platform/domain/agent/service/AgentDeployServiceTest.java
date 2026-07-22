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
