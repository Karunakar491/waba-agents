package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.*;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Plain Mockito unit test for AgentService.bindPhone()'s new agent_onboarding
 * step — deliberately NOT extending IntegrationTestBase (no Spring context,
 * no Testcontainers/Docker/MySQL), same reasoning as
 * WabaServiceValidateStatusTest: this environment has no Docker, and this
 * fix's correctness needed coverage that could actually be executed here.
 *
 * Root cause of the 2026-08-25..09-01 "can't create an agent" incident:
 * agent_config/settings' documented create-or-fetch behavior no longer
 * reliably creates the BizAI entity for a phone number that's never had
 * one — confirmed live via direct Meta reproduction (raw 500 on multiple
 * real, fully CONNECTED/eligible numbers). First-time bind must call
 * agent_onboarding first and use the real returned agent_id.
 */
class AgentServiceBindPhoneOnboardingTest {

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final WabaRepository wabaRepository = mock(WabaRepository.class);
    private final WabaAccessGuard wabaAccessGuard = mock(WabaAccessGuard.class);
    private final AgentAccessService agentAccessService = mock(AgentAccessService.class);
    private final MetaApiClient metaApiClient = mock(MetaApiClient.class);

    private final AgentService agentService = new AgentService(
            agentRepository,
            mock(AgentSkillRepository.class),
            mock(AgentUiSkillRepository.class),
            mock(AgentFaqRepository.class),
            mock(AgentFileRepository.class),
            mock(AgentWebsiteRepository.class),
            mock(AgentWebsitePageRepository.class),
            wabaRepository,
            wabaAccessGuard,
            agentAccessService,
            metaApiClient,
            mock(com.metaagent.platform.domain.conversation.repository.MessageRepository.class),
            mock(com.metaagent.platform.domain.conversation.repository.ConversationRepository.class),
            mock(com.metaagent.platform.domain.webhook.repository.WebhookRawRepository.class),
            mock(MetaMirrorReconciler.class),
            mock(com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository.class),
            mock(AgentConnectorRepository.class),
            mock(com.metaagent.platform.domain.connector.repository.ConnectorDeploymentRepository.class),
            mock(com.metaagent.platform.domain.skill.repository.AgentSkillAttachmentRepository.class)
    );

    private static final Long ACCOUNT_ID = 1L;
    private static final Long AGENT_ID = 100L;
    private static final Long WABA_ID = 200L;
    private static final String PHONE_NUMBER_ID = "777888333";
    private static final String META_WABA_ID = "100200303";

    @BeforeEach
    void setUp() {
        TenantDetails tenantDetails = new TenantDetails(ACCOUNT_ID, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);

        Waba waba = Waba.builder().wabaId(META_WABA_ID).build();
        waba.setId(WABA_ID);
        when(wabaRepository.findById(WABA_ID)).thenReturn(Optional.of(waba));
        when(agentRepository.findByPhoneNumberId(PHONE_NUMBER_ID)).thenReturn(Optional.empty());
        when(metaApiClient.graphGet(eq("/" + META_WABA_ID + "/phone_numbers"), eq(Map.class)))
                .thenReturn(Map.of("data", List.of(Map.of("id", PHONE_NUMBER_ID))));
        when(metaApiClient.get(contains("/agent_eligibility"), eq(Map.class)))
                .thenReturn(Map.of("is_eligible", true));
        when(agentRepository.saveAndFlush(any(Agent.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private Agent freshDraftAgent() {
        Agent agent = Agent.builder().accountId(ACCOUNT_ID).displayName("Bind Agent").enabled(false).build();
        agent.setId(AGENT_ID);
        return agent;
    }

    @Test
    void calls_agent_onboarding_before_settings_on_first_time_bind_and_scopes_settings_to_the_returned_agent_id() {
        Agent agent = freshDraftAgent();
        assertThat(agent.getMetaAgentId()).isNull();
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);
        when(metaApiClient.post(eq("/" + PHONE_NUMBER_ID + "/agent_onboarding?channel=whatsapp"), any(), eq(Map.class)))
                .thenReturn(Map.of("agent_id", "onboarded-agent-id-42"));
        ArgumentCaptor<String> settingsPathCaptor = ArgumentCaptor.forClass(String.class);
        when(metaApiClient.put(settingsPathCaptor.capture(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        Agent bound = agentService.bindPhone(AGENT_ID, PHONE_NUMBER_ID, WABA_ID);

        assertThat(bound.getMetaAgentId()).isEqualTo("onboarded-agent-id-42");
        assertThat(settingsPathCaptor.getValue()).contains("agent_id=onboarded-agent-id-42");
        verify(metaApiClient).post(eq("/" + PHONE_NUMBER_ID + "/agent_onboarding?channel=whatsapp"), any(), eq(Map.class));
    }

    @Test
    void throws_when_agent_onboarding_fails_instead_of_attempting_settings_anyway() {
        Agent agent = freshDraftAgent();
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);
        when(metaApiClient.post(contains("/agent_onboarding"), any(), eq(Map.class)))
                .thenThrow(new MetaApiException(500));

        assertThatThrownBy(() -> agentService.bindPhone(AGENT_ID, PHONE_NUMBER_ID, WABA_ID))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("onboarding failed");

        verify(metaApiClient, never()).put(anyString(), anyMap(), any());
    }

    @Test
    void throws_when_agent_onboarding_response_has_no_agent_id() {
        Agent agent = freshDraftAgent();
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);
        when(metaApiClient.post(contains("/agent_onboarding"), any(), eq(Map.class)))
                .thenReturn(Map.of());

        assertThatThrownBy(() -> agentService.bindPhone(AGENT_ID, PHONE_NUMBER_ID, WABA_ID))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("agent ID");

        verify(metaApiClient, never()).put(anyString(), anyMap(), any());
    }

    @Test
    void does_not_call_agent_onboarding_when_agent_already_has_a_meta_agent_id() {
        Agent agent = freshDraftAgent();
        agent.setMetaAgentId("already-onboarded-id");
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);
        when(metaApiClient.put(contains("/agent_config/settings"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        Agent bound = agentService.bindPhone(AGENT_ID, PHONE_NUMBER_ID, WABA_ID);

        assertThat(bound.getMetaAgentId()).isEqualTo("already-onboarded-id");
        verify(metaApiClient, never()).post(contains("/agent_onboarding"), any(), any());
    }

    // EM-flagged pre-existing gap (2026-09-03, not fixed here — tracked in
    // TASKS.md): the metaAgentId gate is per-Agent-row, not per-phone. A
    // rebind to a DIFFERENT phone on an agent that already has a
    // metaAgentId skips onboarding and scopes the settings call to the OLD
    // phone's agent_id via scopedPath(). This test documents the CURRENT
    // (not-yet-fixed) behavior on purpose, so the gap is asserted rather
    // than silently reachable — it must fail, loudly, if this changes
    // without TASKS.md being updated.
    @Test
    void rebinding_to_a_different_phone_currently_reuses_the_old_agent_id_without_reonboarding() {
        Agent agent = freshDraftAgent();
        agent.setPhoneNumberId("777888OLD");
        agent.setMetaAgentId("old-phone-agent-id");
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);
        when(agentRepository.findByPhoneNumberId(PHONE_NUMBER_ID)).thenReturn(Optional.empty());
        ArgumentCaptor<String> settingsPathCaptor = ArgumentCaptor.forClass(String.class);
        when(metaApiClient.put(settingsPathCaptor.capture(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        Agent bound = agentService.bindPhone(AGENT_ID, PHONE_NUMBER_ID, WABA_ID);

        assertThat(bound.getMetaAgentId()).isEqualTo("old-phone-agent-id");
        assertThat(settingsPathCaptor.getValue())
                .as("settings call for the NEW phone is scoped to the OLD phone's agent_id — known gap")
                .contains("agent_id=old-phone-agent-id");
        verify(metaApiClient, never()).post(contains("/agent_onboarding"), any(), any());
    }
}
