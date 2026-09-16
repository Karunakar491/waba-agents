package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.domain.agent.dto.AgentDeleteResult;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.persona.service.BusinessProfileDeployService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Deleting an agent can keep it locally as a draft instead of destroying it.
 *
 * <p>Two things must hold no matter what, and both are easy to break: the agent
 * is removed from Meta either way — preserving is about our database, never
 * about leaving a live agent answering on a client's number — and the WABA must
 * survive, because the teardown itself clears it and a draft without one cannot
 * see its own content.
 */
@ExtendWith(MockitoExtension.class)
class AgentTeardownServicePreserveTest {

    @Mock private AgentService agentService;
    @Mock private AgentDeployService agentDeployService;
    @Mock private BusinessProfileDeployService businessProfileDeployService;

    @InjectMocks private AgentTeardownService teardownService;

    private static final Long AGENT_ID = 42L;
    private static final Long WABA_ID = 7L;
    private static final String PHONE_NUMBER_ID = "1234567890";

    @BeforeEach
    void enableTheFeature() {
        ReflectionTestUtils.setField(teardownService, "draftOnDeleteEnabled", true);
    }

    private Agent pausedAgent() {
        return Agent.builder()
                .id(AGENT_ID)
                .displayName("Support Agent")
                .phoneNumberId(PHONE_NUMBER_ID)
                .wabaId(WABA_ID)
                .status(Agent.Status.paused)
                .build();
    }

    private void metaIsEmpty() {
        when(agentDeployService.listConnectors(AGENT_ID)).thenReturn(List.of());
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of());
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());
    }

    private void preservationReturns(int faqs, int websites, int files) {
        when(agentService.convertToDraft(eq(AGENT_ID), anyLong()))
                .thenReturn(new AgentService.DraftPreservationCounts(faqs, websites, files));
    }

    @Test
    void preservesTheAgentInsteadOfDeletingIt() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        metaIsEmpty();
        preservationReturns(3, 1, 0);

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID, true);

        verify(agentService).convertToDraft(AGENT_ID, WABA_ID);
        verify(agentService, never()).deleteAgent(anyLong());
        assertThat(result.preserved()).isNotNull();
        assertThat(result.preserved().faqsKept()).isEqualTo(3);
        assertThat(result.preserved().websitesKept()).isEqualTo(1);
    }

    /**
     * The WABA is read off the agent before the teardown steps run because
     * deleteFromMeta clears it on the way past. Reading it afterwards — or
     * letting convertToDraft read it itself — would preserve a draft that has
     * lost its tenant, and the Skill and Connector libraries are WABA-scoped.
     */
    @Test
    void restoresTheWabaThatMetaTeardownClears() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        metaIsEmpty();
        preservationReturns(0, 0, 0);
        // deleteFromMeta nulls wabaId on its own copy of the row, exactly as in production.
        doAnswer(invocation -> {
            pausedAgent().setWabaId(null);
            return null;
        }).when(agentDeployService).deleteFromMeta(AGENT_ID);

        teardownService.deleteEverywhere(AGENT_ID, true);

        verify(agentService).convertToDraft(AGENT_ID, WABA_ID);
    }

    @Test
    void stillRemovesTheAgentFromMetaWhenPreserving() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        metaIsEmpty();
        preservationReturns(0, 0, 0);

        teardownService.deleteEverywhere(AGENT_ID, true);

        verify(businessProfileDeployService).resetLive(PHONE_NUMBER_ID);
        verify(agentDeployService).deleteFromMeta(AGENT_ID);
    }

    /** Meta must be emptied before we decide what to keep, never after. */
    @Test
    void tearsDownMetaBeforeConvertingTheRow() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        metaIsEmpty();
        preservationReturns(0, 0, 0);

        teardownService.deleteEverywhere(AGENT_ID, true);

        InOrder inOrder = inOrder(agentDeployService, agentService);
        inOrder.verify(agentDeployService).deleteFromMeta(AGENT_ID);
        inOrder.verify(agentService).convertToDraft(AGENT_ID, WABA_ID);
    }

    /**
     * A half-emptied number is the worst outcome, so a failed Meta step must not
     * cost the operator their content as well.
     */
    @Test
    void stillPreservesTheDraftWhenMetaTeardownFails() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        when(agentDeployService.listConnectors(AGENT_ID))
                .thenThrow(new RuntimeException("Could not reach Meta"));
        when(agentService.getSkills(AGENT_ID)).thenReturn(List.of());
        when(agentService.getUiSkills(AGENT_ID)).thenReturn(List.of());
        preservationReturns(2, 0, 0);

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID, true);

        assertThat(result.metaFullyCleaned()).isFalse();
        assertThat(result.preserved()).isNotNull();
        verify(agentService).convertToDraft(AGENT_ID, WABA_ID);
    }

    @Test
    void hardDeletesWhenPreserveIsNotRequested() {
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        metaIsEmpty();

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID, false);

        verify(agentService).deleteAgent(AGENT_ID);
        verify(agentService, never()).convertToDraft(anyLong(), anyLong());
        assertThat(result.preserved()).isNull();
    }

    /** The kill switch fails closed: off means the product behaves as it did before. */
    @Test
    void hardDeletesWhenTheFeatureIsSwitchedOff() {
        ReflectionTestUtils.setField(teardownService, "draftOnDeleteEnabled", false);
        when(agentService.getAgent(AGENT_ID)).thenReturn(pausedAgent());
        metaIsEmpty();

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID, true);

        verify(agentService).deleteAgent(AGENT_ID);
        verify(agentService, never()).convertToDraft(anyLong(), anyLong());
        assertThat(result.preserved()).isNull();
    }

    /** A never-deployed draft has nothing on Meta, but its content is still worth keeping. */
    @Test
    void preservesADraftThatWasNeverConnectedToAPhoneNumber() {
        Agent draft = Agent.builder()
                .id(AGENT_ID)
                .displayName("Never deployed")
                .wabaId(WABA_ID)
                .status(Agent.Status.draft)
                .build();
        when(agentService.getAgent(AGENT_ID)).thenReturn(draft);
        preservationReturns(5, 0, 0);

        AgentDeleteResult result = teardownService.deleteEverywhere(AGENT_ID, true);

        assertThat(result.metaFullyCleaned()).isTrue();
        assertThat(result.preserved().faqsKept()).isEqualTo(5);
        verify(agentService).convertToDraft(AGENT_ID, WABA_ID);
        verifyNoInteractions(businessProfileDeployService);
    }
}
