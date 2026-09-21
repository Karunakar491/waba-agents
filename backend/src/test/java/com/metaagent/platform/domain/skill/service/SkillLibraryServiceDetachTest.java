package com.metaagent.platform.domain.skill.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentSkillRepository;
import com.metaagent.platform.domain.agent.repository.AgentUiSkillRepository;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.skill.entity.AgentSkillAttachment;
import com.metaagent.platform.domain.skill.repository.AgentSkillAttachmentRepository;
import com.metaagent.platform.domain.skill.repository.SkillRepository;
import com.metaagent.platform.domain.skill.repository.SkillTemplateRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Detach — removing ONE agent's use of a shared Library skill.
 *
 * Built because there was no way to do it (2026-09-11): three Library skills
 * were live on the IndiaMART agent, contradicting its own new skill set, and
 * the only levers were editing the body (changes every attached agent) or
 * deleting the skill WABA-wide (the FK refuses while anyone is attached).
 *
 * The risk being tested is losing a Meta-side skill. metaSkillId is the only
 * handle we hold on the skill Meta created for that agent's phone number, so
 * dropping the attachment row before Meta has confirmed the removal would
 * leave a skill running on a real number with nothing here pointing at it.
 */
class SkillLibraryServiceDetachTest {

    private SkillLibraryService service;
    private AgentSkillAttachmentRepository attachmentRepository;
    private AgentService agentService;
    private MetaApiClient metaApiClient;

    @BeforeEach
    void setUp() {
        attachmentRepository = mock(AgentSkillAttachmentRepository.class);
        agentService = mock(AgentService.class);
        metaApiClient = mock(MetaApiClient.class);
        service = new SkillLibraryService(
                mock(SkillRepository.class),
                attachmentRepository,
                mock(AgentSkillRepository.class),
                mock(AgentUiSkillRepository.class),
                mock(AgentRepository.class),
                mock(WabaAccessGuard.class),
                mock(SkillTemplateRepository.class),
                metaApiClient,
                agentService);
    }

    private Agent agent() {
        return Agent.builder()
                .id(7L)
                .phoneNumberId("1046051241927239")
                .metaAgentId("pfbid0827")
                .build();
    }

    @Test
    void should_remove_the_skill_from_meta_before_dropping_our_row() {
        when(agentService.getAgent(7L)).thenReturn(agent());
        AgentSkillAttachment attachment = AgentSkillAttachment.builder()
                .id(11L).agentId(7L).skillId(99L).metaSkillId("meta-abc").build();
        when(attachmentRepository.findByIdAndAgentId(11L, 7L)).thenReturn(Optional.of(attachment));

        service.detachSkill(7L, 11L);

        // Scoped to the agent's own phone number and Meta agent id — a skill
        // id alone is not addressable on Meta.
        verify(metaApiClient).delete(contains("/1046051241927239/agent_config/skills/meta-abc"));
        verify(attachmentRepository).delete(attachment);
    }

    @Test
    void should_keep_the_attachment_when_meta_refuses() {
        when(agentService.getAgent(7L)).thenReturn(agent());
        AgentSkillAttachment attachment = AgentSkillAttachment.builder()
                .id(11L).agentId(7L).skillId(99L).metaSkillId("meta-abc").build();
        when(attachmentRepository.findByIdAndAgentId(11L, 7L)).thenReturn(Optional.of(attachment));
        doThrow(new RuntimeException("Skill not found: meta-abc")).when(metaApiClient).delete(anyString());

        BusinessException thrown = assertThrows(BusinessException.class, () -> service.detachSkill(7L, 11L));

        // The row survives, because metaSkillId is the only handle on the
        // Meta-side skill. It also says it can be retried, and carries Meta's
        // own reason rather than "could not detach".
        verify(attachmentRepository, never()).delete(any());
        assertTrue(thrown.getMessage().contains("Skill not found: meta-abc"), thrown.getMessage());
        assertTrue(thrown.getMessage().contains("retried"), thrown.getMessage());
    }

    @Test
    void should_skip_meta_entirely_for_an_attachment_that_never_reached_it() {
        when(agentService.getAgent(7L)).thenReturn(agent());
        // metaSkillId null = attached here, never synced. There is nothing on
        // Meta to remove, and calling it would 404 on a null id.
        AgentSkillAttachment attachment = AgentSkillAttachment.builder()
                .id(11L).agentId(7L).skillId(99L).build();
        when(attachmentRepository.findByIdAndAgentId(11L, 7L)).thenReturn(Optional.of(attachment));

        service.detachSkill(7L, 11L);

        verify(metaApiClient, never()).delete(anyString());
        verify(attachmentRepository).delete(attachment);
    }

    @Test
    void should_refuse_an_attachment_belonging_to_another_agent() {
        when(agentService.getAgent(7L)).thenReturn(agent());
        // Scoped by agent as well as id: an attachment id alone would let the
        // owner of agent 7 detach a skill from someone else's agent by
        // guessing an id.
        when(attachmentRepository.findByIdAndAgentId(11L, 7L)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.detachSkill(7L, 11L));
        verify(metaApiClient, never()).delete(anyString());
        verify(attachmentRepository, never()).delete(any());
    }

    @Test
    void should_refuse_when_the_agent_has_no_phone_number_to_remove_it_from() {
        when(agentService.getAgent(7L)).thenReturn(Agent.builder().id(7L).metaAgentId("pfbid0827").build());
        AgentSkillAttachment attachment = AgentSkillAttachment.builder()
                .id(11L).agentId(7L).skillId(99L).metaSkillId("meta-abc").build();
        when(attachmentRepository.findByIdAndAgentId(11L, 7L)).thenReturn(Optional.of(attachment));

        BusinessException thrown = assertThrows(BusinessException.class, () -> service.detachSkill(7L, 11L));
        assertTrue(thrown.getMessage().contains("no phone number"), thrown.getMessage());
        verify(attachmentRepository, never()).delete(any());
    }
}
