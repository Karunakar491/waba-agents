package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.dto.AgentDeleteResult;
import com.metaagent.platform.domain.agent.dto.AgentDeleteResult.Step;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.persona.service.BusinessProfileDeployService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * The whole point of AgentTeardownService is what happens when Meta is
 * uncooperative, so that's what these cover: one failing step must not abort
 * the others, must not be hidden, and must not block the local delete.
 */
@ExtendWith(MockitoExtension.class)
class AgentTeardownServiceTest {

    @Mock private AgentService agentService;
    @Mock private AgentDeployService agentDeployService;
    @Mock private BusinessProfileDeployService businessProfileDeployService;

    @InjectMocks private AgentTeardownService teardownService;

    private static final Long AGENT_ID = 42L;
    private static final String PHONE_NUMBER_ID = "1234567890";

    private Agent pausedAgent() {
        return Agent.builder()
                .id(AGENT_ID)
                .displayName("Support Agent")
                .phoneNumberId(PHONE_NUMBER_ID)
                .status(Agent.Status.paused)
                .build();
    }

    @Test
    void everyStepSucceeds_reportsFullyCleaned() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        when(agentDeployService.listConnectors(AGENT_ID)).thenReturn(List.of());
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of());
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID);

        assertThat(result.metaFullyCleaned()).isTrue();
        verify(businessProfileDeployService).resetLive(PHONE_NUMBER_ID);
        verify(agentDeployService).deleteFromMeta(AGENT_ID);
        verify(agentService).deleteAgent(AGENT_ID);
    }

    @Test
    void oneFailingStep_doesNotStopTheRestAndIsReported() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        doThrow(new BusinessException("Meta business info reset failed"))
                .when(businessProfileDeployService).resetLive(PHONE_NUMBER_ID);
        when(agentDeployService.listConnectors(AGENT_ID))
                .thenReturn(List.of(Map.of("id", "conn-1")));
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of());
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID);

        assertThat(result.metaFullyCleaned()).isFalse();
        assertThat(result.steps())
                .filteredOn(s -> s.status() == Step.Status.FAILED)
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.name()).isEqualTo("Business persona");
                    assertThat(s.detail()).contains("Meta business info reset failed");
                });

        // The later steps still ran, and the local row is still gone — an
        // operator must never be left with an agent they cannot delete.
        verify(agentDeployService).deleteConnector(AGENT_ID, "conn-1");
        verify(agentDeployService).deleteFromMeta(AGENT_ID);
        verify(agentService).deleteAgent(AGENT_ID);
    }

    @Test
    void oneFailingSkill_doesNotStopTheOtherSkills() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        when(agentDeployService.listConnectors(AGENT_ID)).thenReturn(List.of());
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of(
                AgentSkill.builder().id(1L).agentId(AGENT_ID).title("greeting").build(),
                AgentSkill.builder().id(2L).agentId(AGENT_ID).title("returns").build()));
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());
        doThrow(new BusinessException("404 from Meta")).when(agentService).deleteSkill(AGENT_ID, 1L);

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID);

        assertThat(result.metaFullyCleaned()).isFalse();
        assertThat(result.steps())
                .filteredOn(s -> s.status() == Step.Status.FAILED)
                .singleElement()
                .satisfies(s -> assertThat(s.name()).isEqualTo("Skills: greeting"));
        verify(agentService).deleteSkill(AGENT_ID, 2L);
    }

    @Test
    void draftAgentWithNoPhoneNumber_skipsMetaEntirelyAndStillDeletes() {
        Agent draft = Agent.builder()
                .id(AGENT_ID)
                .displayName("Never deployed")
                .status(Agent.Status.draft)
                .build();
        when(agentService.getAgent(AGENT_ID)).thenReturn(draft);

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID);

        assertThat(result.metaFullyCleaned()).isTrue();
        assertThat(result.steps()).singleElement()
                .satisfies(s -> assertThat(s.status()).isEqualTo(Step.Status.SKIPPED));
        verify(agentService).deleteAgent(AGENT_ID);
        verifyNoInteractions(businessProfileDeployService);
        verify(agentDeployService, never()).deleteFromMeta(anyLong());
    }

    /**
     * The create wizard binds the phone number on its first step, so abandoning
     * it leaves a draft that HAS a phoneNumberId and has still never answered a
     * customer. Requiring a pause here deadlocked such a draft permanently:
     * pause refuses drafts ("Agent is not currently active"), so it could be
     * neither paused nor deleted, and it held its phone number hostage against
     * every later attempt to create an agent on that number.
     */
    @Test
    void draftAgentThatAlreadyClaimedAPhoneNumber_isStillDeletable() {
        Agent draft = Agent.builder()
                .id(AGENT_ID)
                .displayName("Abandoned in the wizard")
                .phoneNumberId(PHONE_NUMBER_ID)
                .status(Agent.Status.draft)
                .build();
        when(agentService.getAgent(AGENT_ID)).thenReturn(draft);
        when(agentDeployService.listConnectors(AGENT_ID)).thenReturn(List.of());
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of());
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID);

        // Meta teardown still runs — the wizard may already have provisioned an
        // agent there — but the pause requirement must not block the delete.
        assertThat(result.metaFullyCleaned()).isTrue();
        verify(agentService).deleteAgent(AGENT_ID);
    }

    @Test
    void liveAgent_isRefusedBeforeAnythingIsTouched() {
        Agent live = pausedAgent();
        live.setStatus(Agent.Status.active);
        when(agentService.getAgent(AGENT_ID)).thenReturn(live);

        assertThatThrownBy(() -> teardownService.deleteEverywhere(AGENT_ID))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Pause this agent");

        verifyNoInteractions(businessProfileDeployService);
        verify(agentService, never()).deleteAgent(anyLong());
        verify(agentDeployService, never()).deleteConnector(anyLong(), anyString());
    }

    @Test
    void unreachableConnectorList_isRecordedRatherThanCrashingTheDelete() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        when(agentDeployService.listConnectors(AGENT_ID))
                .thenThrow(new RuntimeException("Could not reach Meta"));
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of());
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID);

        assertThat(result.metaFullyCleaned()).isFalse();
        assertThat(result.steps())
                .filteredOn(s -> s.status() == Step.Status.FAILED)
                .singleElement()
                .satisfies(s -> assertThat(s.detail()).contains("Could not list connectors"));
        verify(agentService).deleteAgent(AGENT_ID);
    }
}
