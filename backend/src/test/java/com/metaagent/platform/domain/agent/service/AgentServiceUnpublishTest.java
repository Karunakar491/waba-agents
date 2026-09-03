package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.dto.UiSkillRequest;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentFaq;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import com.metaagent.platform.domain.agent.repository.AgentFaqRepository;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentSkillRepository;
import com.metaagent.platform.domain.agent.repository.AgentUiSkillRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Covers the Unpublish/Draft soft-transition feature: unpublish flips
 * status to draft immediately without touching Meta, republish either
 * cancels cheaply (Meta record still present) or recreates on Meta (record
 * already swept), and {@link SkillUnpublishSweepJob} is what actually
 * deletes from Meta once past the grace window.
 */
class AgentServiceUnpublishTest extends IntegrationTestBase {

    @Autowired
    private AgentService agentService;
    @Autowired
    private SkillUnpublishSweepJob sweepJob;
    @Autowired
    private AgentRepository agentRepository;
    @Autowired
    private AgentSkillRepository agentSkillRepository;
    @Autowired
    private AgentUiSkillRepository agentUiSkillRepository;
    @Autowired
    private AgentFaqRepository agentFaqRepository;
    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Test Company")
                .email("unpublish-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        agentSkillRepository.deleteAll();
        agentUiSkillRepository.deleteAll();
        agentFaqRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Skills
    // -------------------------------------------------------------------------

    @Test
    void unpublish_skill_flips_to_draft_without_touching_meta() {
        Agent agent = agentRepository.save(draftAgent("s1"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-1"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));

        AgentSkill result = agentService.unpublishSkill(agent.getId(), skill.getId());

        assertThat(result.getStatus()).isEqualTo(AgentSkill.Status.draft);
        assertThat(result.getUnpublishedAt()).isNotNull();
        assertThat(result.getMetaSkillId()).isEqualTo("meta-skill-1"); // untouched — sweep job's job, not unpublish's
        verify(metaApiClient, never()).delete(anyString());
    }

    @Test
    void unpublish_skill_is_idempotent_when_already_draft() {
        Agent agent = agentRepository.save(draftAgent("s2"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-2"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        agentService.unpublishSkill(agent.getId(), skill.getId());

        AgentSkill result = agentService.unpublishSkill(agent.getId(), skill.getId());

        assertThat(result.getStatus()).isEqualTo(AgentSkill.Status.draft);
    }

    @Test
    void republish_skill_is_a_cheap_cancel_when_meta_record_still_present() {
        Agent agent = agentRepository.save(draftAgent("s3"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-3"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        agentService.unpublishSkill(agent.getId(), skill.getId());
        clearInvocations(metaApiClient);

        AgentSkill result = agentService.republishSkill(agent.getId(), skill.getId());

        assertThat(result.getStatus()).isEqualTo(AgentSkill.Status.published);
        assertThat(result.getMetaSkillId()).isEqualTo("meta-skill-3"); // unchanged, never re-created
        verifyNoInteractions(metaApiClient);
    }

    @Test
    void republish_skill_recreates_on_meta_once_sweep_has_already_deleted_it() {
        Agent agent = agentRepository.save(draftAgent("s4"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-4"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        skill.setStatus(AgentSkill.Status.draft);
        skill.setUnpublishedAt(LocalDateTime.now());
        skill.setMetaSkillId(null); // simulates the sweep job having already run
        agentSkillRepository.save(skill);
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-4-new"));

        AgentSkill result = agentService.republishSkill(agent.getId(), skill.getId());

        assertThat(result.getStatus()).isEqualTo(AgentSkill.Status.published);
        assertThat(result.getMetaSkillId()).isEqualTo("meta-skill-4-new");
        assertThat(result.getUnpublishedAt()).isNull();
    }

    @Test
    void republish_skill_throws_rather_than_silently_marking_published_when_meta_returns_no_id() {
        Agent agent = agentRepository.save(draftAgent("s5"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-5"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        skill.setStatus(AgentSkill.Status.draft);
        skill.setMetaSkillId(null);
        agentSkillRepository.save(skill);
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of()); // 2xx, no "id" — the exact desync scenario EL flagged

        assertThatThrownBy(() -> agentService.republishSkill(agent.getId(), skill.getId()))
                .isInstanceOf(BusinessException.class);
        assertThat(agentSkillRepository.findByIdAndAgentId(skill.getId(), agent.getId()).orElseThrow().getStatus())
                .isEqualTo(AgentSkill.Status.draft); // never silently flipped to published with a null id
    }

    // -------------------------------------------------------------------------
    // UI Skills — same desync guard, condensed to the one case that matters
    // -------------------------------------------------------------------------

    @Test
    void republish_ui_skill_throws_rather_than_silently_marking_published_when_meta_returns_no_id() {
        Agent agent = agentRepository.save(draftAgent("u1"));
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-ui-1"));
        AgentUiSkill skill = agentService.addUiSkill(agent.getId(),
                new UiSkillRequest("title", AgentUiSkill.ComponentType.interactive_list, AgentUiSkill.Status.enabled, "instr"));
        skill.setPublishStatus(AgentUiSkill.PublishStatus.draft);
        skill.setMetaUiSkillId(null);
        agentUiSkillRepository.save(skill);
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class))).thenReturn(Map.of());

        assertThatThrownBy(() -> agentService.republishUiSkill(agent.getId(), skill.getId()))
                .isInstanceOf(BusinessException.class);
        assertThat(agentUiSkillRepository.findByIdAndAgentId(skill.getId(), agent.getId()).orElseThrow().getPublishStatus())
                .isEqualTo(AgentUiSkill.PublishStatus.draft);
    }

    // -------------------------------------------------------------------------
    // FAQ — same desync guard
    // -------------------------------------------------------------------------

    @Test
    void republish_faq_throws_rather_than_silently_marking_published_when_meta_returns_no_id() {
        Agent agent = agentRepository.save(draftAgent("f1"));
        when(metaApiClient.post(contains("/agent_config/faq"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-faq-1"));
        AgentFaq faq = agentService.addFaq(agent.getId(), new FaqRequest("Q?", "A."));
        faq.setStatus(AgentFaq.Status.draft);
        faq.setMetaFaqId(null);
        agentFaqRepository.save(faq);
        when(metaApiClient.post(contains("/agent_config/faq"), anyMap(), eq(Map.class))).thenReturn(Map.of());

        assertThatThrownBy(() -> agentService.republishFaq(agent.getId(), faq.getId()))
                .isInstanceOf(BusinessException.class);
        assertThat(agentFaqRepository.findByIdAndAgentId(faq.getId(), agent.getId()).orElseThrow().getStatus())
                .isEqualTo(AgentFaq.Status.draft);
    }

    // -------------------------------------------------------------------------
    // SkillUnpublishSweepJob
    // -------------------------------------------------------------------------

    @Test
    void sweep_leaves_skill_untouched_before_its_grace_window_elapses() {
        Agent agent = agentRepository.save(draftAgent("sw1"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-sw1"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        skill.setStatus(AgentSkill.Status.draft);
        skill.setUnpublishedAt(LocalDateTime.now()); // just unpublished, well within any grace window
        agentSkillRepository.save(skill);
        clearInvocations(metaApiClient);

        sweepJob.sweep();

        verify(metaApiClient, never()).delete(anyString());
        assertThat(agentSkillRepository.findByIdAndAgentId(skill.getId(), agent.getId()).orElseThrow().getMetaSkillId())
                .isEqualTo("meta-skill-sw1");
    }

    @Test
    void sweep_deletes_from_meta_and_clears_meta_id_once_past_grace_window() {
        Agent agent = agentRepository.save(draftAgent("sw2"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-sw2"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        skill.setStatus(AgentSkill.Status.draft);
        skill.setUnpublishedAt(LocalDateTime.now().minusMinutes(5)); // well past any realistic grace window
        agentSkillRepository.save(skill);

        sweepJob.sweep();

        verify(metaApiClient).delete(contains("meta-skill-sw2"));
        AgentSkill result = agentSkillRepository.findByIdAndAgentId(skill.getId(), agent.getId()).orElseThrow();
        assertThat(result.getMetaSkillId()).isNull();
        assertThat(result.getPreviousMetaSkillId()).isEqualTo("meta-skill-sw2");
    }

    @Test
    void sweep_leaves_row_in_draft_when_meta_delete_fails_so_it_retries_next_sweep() {
        Agent agent = agentRepository.save(draftAgent("sw3"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-sw3"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));
        skill.setStatus(AgentSkill.Status.draft);
        skill.setUnpublishedAt(LocalDateTime.now().minusMinutes(5));
        agentSkillRepository.save(skill);
        doThrow(new RuntimeException("Meta down")).when(metaApiClient).delete(contains("meta-skill-sw3"));

        sweepJob.sweep();

        AgentSkill result = agentSkillRepository.findByIdAndAgentId(skill.getId(), agent.getId()).orElseThrow();
        assertThat(result.getMetaSkillId()).isEqualTo("meta-skill-sw3"); // untouched — will retry next sweep
        assertThat(result.getStatus()).isEqualTo(AgentSkill.Status.draft);
    }

    private Agent draftAgent(String phoneNumberId) {
        return Agent.builder()
                .accountId(accountId)
                .phoneNumberId(phoneNumberId)
                .displayName("Test Agent")
                .enabled(false)
                .status(Agent.Status.draft)
                .build();
    }

    private void authenticateAs(Long targetAccountId) {
        TenantDetails tenantDetails = new TenantDetails(targetAccountId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                tenantDetails, null, java.util.List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }
}
