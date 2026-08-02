package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.dto.AgentRequest;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentFaq;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.repository.AgentFaqRepository;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentSkillRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
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
 * Integration tests for AgentService.
 *
 * Real MySQL via Testcontainers (from IntegrationTestBase).
 * MetaApiClient is @MockBean — never calls real Meta APIs.
 * Each test creates its own BusinessAccount so accountId is TSID-safe.
 */
class AgentServiceTest extends IntegrationTestBase {

    @Autowired
    private AgentService agentService;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private AgentFaqRepository agentFaqRepository;

    @Autowired
    private AgentSkillRepository agentSkillRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    @Autowired
    private WabaRepository wabaRepository;

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Test Company")
                .email("agent-svc-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        agentFaqRepository.deleteAll();
        agentSkillRepository.deleteAll();
        agentRepository.deleteAll();
        wabaRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // createAgent()
    // -------------------------------------------------------------------------

    @Test
    void should_create_phoneless_draft_agent_without_meta_calls() {
        AgentRequest request = new AgentRequest("My Agent", null, null, "You are a helpful agent.", null, null, null, false, null);
        Agent created = agentService.createAgent(request);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getAccountId()).isEqualTo(accountId);
        assertThat(created.getPhoneNumberId()).isNull();
        assertThat(created.getStatus()).isEqualTo(Agent.Status.draft);
        assertThat(created.getDisplayName()).isEqualTo("My Agent");
        assertThat(agentRepository.findById(created.getId())).isPresent();

        // Creation must not touch Meta — provisioning happens at bindPhone
        verifyNoInteractions(metaApiClient);
    }

    // -------------------------------------------------------------------------
    // bindPhone()
    // -------------------------------------------------------------------------

    @Test
    void should_bind_phone_when_waba_owned_phone_in_waba_and_eligible() {
        Agent agent = agentService.createAgent(new AgentRequest("Bind Agent", null, null, null, null, null, null, false, null));
        Waba waba = ownedWaba("100200300");
        stubPhoneList("100200300", "777888999");
        when(metaApiClient.get(contains("/agent_eligibility"), eq(Map.class)))
                .thenReturn(Map.of("is_eligible", true));
        when(metaApiClient.put(contains("/agent_config/settings"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        Agent bound = agentService.bindPhone(agent.getId(), "777888999", waba.getId());

        assertThat(bound.getPhoneNumberId()).isEqualTo("777888999");
        assertThat(bound.getWabaId()).isEqualTo(waba.getId());
    }

    @Test
    void should_throw_not_found_when_waba_belongs_to_another_account() {
        Agent agent = agentService.createAgent(new AgentRequest("Bind Agent", null, null, null, null, null, null, false, null));
        BusinessAccount other = businessAccountRepository.save(BusinessAccount.builder()
                .name("Other Co").email("other-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed").build());
        Waba foreignWaba = wabaRepository.save(Waba.builder()
                .accountId(other.getId()).wabaId("999888777").build());

        assertThatThrownBy(() -> agentService.bindPhone(agent.getId(), "777888999", foreignWaba.getId()))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(metaApiClient);
    }

    @Test
    void should_reject_phone_that_does_not_belong_to_waba() {
        Agent agent = agentService.createAgent(new AgentRequest("Bind Agent", null, null, null, null, null, null, false, null));
        Waba waba = ownedWaba("100200300");
        stubPhoneList("100200300", "111111111"); // different phone

        assertThatThrownBy(() -> agentService.bindPhone(agent.getId(), "777888999", waba.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("doesn't belong");
        verify(metaApiClient, never()).put(anyString(), anyMap(), any());
    }

    @Test
    void should_throw_business_exception_when_phone_number_not_eligible() {
        Agent agent = agentService.createAgent(new AgentRequest("Bind Agent", null, null, null, null, null, null, false, null));
        Waba waba = ownedWaba("100200300");
        stubPhoneList("100200300", "000000001");
        when(metaApiClient.get(contains("/agent_eligibility"), eq(Map.class)))
                .thenReturn(Map.of("is_eligible", false));

        assertThatThrownBy(() -> agentService.bindPhone(agent.getId(), "000000001", waba.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not eligible");

        assertThat(agentRepository.findById(agent.getId()).orElseThrow().getPhoneNumberId()).isNull();
        verify(metaApiClient, never()).put(anyString(), anyMap(), any());
    }

    @Test
    void should_reject_binding_phone_already_connected_to_another_agent() {
        agentRepository.save(draftAgent("777888999")); // occupies the number
        Agent agent = agentService.createAgent(new AgentRequest("Bind Agent", null, null, null, null, null, null, false, null));
        Waba waba = ownedWaba("100200300");
        stubPhoneList("100200300", "777888999");

        assertThatThrownBy(() -> agentService.bindPhone(agent.getId(), "777888999", waba.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already connected");
    }

    private Waba ownedWaba(String metaWabaId) {
        return wabaRepository.save(Waba.builder()
                .accountId(accountId)
                .wabaId(metaWabaId)
                .build());
    }

    private void stubPhoneList(String metaWabaId, String phoneNumberId) {
        when(metaApiClient.get(eq("/" + metaWabaId + "/phone_numbers"), eq(Map.class)))
                .thenReturn(Map.of("data", List.of(Map.of(
                        "id", phoneNumberId,
                        "display_phone_number", "+1 555 0100",
                        "verified_name", "Test Business"))));
    }

    // -------------------------------------------------------------------------
    // addFaq()
    // -------------------------------------------------------------------------

    @Test
    void should_add_faq_and_sync_to_meta() {
        Agent agent = agentRepository.save(draftAgent("111222333"));
        when(metaApiClient.post(contains("/agent_config/faq"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-faq-abc"));

        FaqRequest request = new FaqRequest("What are your hours?", "We are open 9-5 Mon-Fri.");
        AgentFaq faq = agentService.addFaq(agent.getId(), request);

        assertThat(faq.getId()).isNotNull();
        assertThat(faq.getMetaFaqId()).isEqualTo("meta-faq-abc");
        assertThat(faq.getQuestion()).isEqualTo("What are your hours?");
        assertThat(faq.getAgentId()).isEqualTo(agent.getId());

        // Verify persisted
        assertThat(agentFaqRepository.findAllByAgentId(agent.getId())).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // addSkill()
    // -------------------------------------------------------------------------

    @Test
    void should_add_skill_and_sync_to_meta() {
        Agent agent = agentRepository.save(draftAgent("444555666"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-xyz"));

        SkillRequest request = new SkillRequest(
                "Order Tracking",
                "Helps customers track their orders",
                "When a customer asks about an order, look it up by order number."
        );
        AgentSkill skill = agentService.addSkill(agent.getId(), request);

        assertThat(skill.getId()).isNotNull();
        assertThat(skill.getMetaSkillId()).isEqualTo("meta-skill-xyz");
        assertThat(skill.getTitle()).isEqualTo("Order Tracking");
        assertThat(skill.getAgentId()).isEqualTo(agent.getId());

        // Verify persisted
        assertThat(agentSkillRepository.findAllByAgentId(agent.getId())).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // Meta wire-contract regression guards (audit item 7, 2026-08-03):
    // these assert the *exact* outgoing field names and query-scoping Meta
    // requires — both were previously broken silently in production with no
    // compile-time signal (skill field-name bug: broken since inception;
    // FAQ over-scoping on addFaq: caused a live Meta 500). A test asserting
    // only "a call happened" would pass through the exact bugs these guard
    // against.
    //
    // Scope note (EL review, 2026-08-03): updateFaq DOES agent_id-scope its
    // Meta call (see updateFaq's own syncPath, a few methods below) — an
    // existing inconsistency with addFaq/getFaqs/deleteFaq, not something
    // this test suite invents or silently "fixes". Flagged to EM/TASKS.md as
    // its own follow-up; the guard below is deliberately scoped to addFaq
    // only, not a universal "FAQ never scopes" claim.
    // -------------------------------------------------------------------------

    @Test
    void should_send_skill_body_as_skill_field_not_body_field_on_add() {
        Agent agent = agentRepository.save(draftAgent("222333444"));
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-1"));

        agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "the actual instructions"));

        verify(metaApiClient).post(anyString(), payloadCaptor.capture(), eq(Map.class));
        Map<String, Object> sent = payloadCaptor.getValue();
        assertThat(sent).containsEntry("skill", "the actual instructions");
        assertThat(sent).doesNotContainKey("body");
    }

    @Test
    void should_send_skill_body_as_skill_field_not_body_field_on_update() {
        Agent agent = agentRepository.save(draftAgent("222333447"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-3"));
        AgentSkill skill = agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "original"));

        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        when(metaApiClient.put(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        agentService.updateSkill(agent.getId(), skill.getId(), new SkillRequest("t2", "d2", "updated instructions"));

        verify(metaApiClient).put(anyString(), payloadCaptor.capture(), eq(Map.class));
        Map<String, Object> sent = payloadCaptor.getValue();
        assertThat(sent).containsEntry("skill", "updated instructions");
        assertThat(sent).doesNotContainKey("body");
    }

    @Test
    void should_scope_skill_sync_path_with_agent_id_when_meta_agent_id_present() {
        Agent agent = draftAgent("222333445");
        agent.setMetaAgentId("meta-agent-9");
        agent = agentRepository.save(agent);
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-2"));

        agentService.addSkill(agent.getId(), new SkillRequest("t", "d", "b"));

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).post(pathCaptor.capture(), anyMap(), eq(Map.class));
        assertThat(pathCaptor.getValue()).contains("agent_id=meta-agent-9");
    }

    @Test
    void should_not_scope_add_faq_sync_path_with_agent_id_even_when_meta_agent_id_present() {
        // addFaq must NOT be agent_id-scoped — confirmed live: adding
        // ?agent_id= to this endpoint caused a real Meta 500 (see addFaq's
        // syncPath construction below). updateFaq is a separate, already
        // agent_id-scoped call path — not covered by this guard, see class
        // comment above.
        Agent agent = draftAgent("222333446");
        agent.setMetaAgentId("meta-agent-9");
        agent = agentRepository.save(agent);
        when(metaApiClient.post(anyString(), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-faq-1"));

        agentService.addFaq(agent.getId(), new FaqRequest("Q?", "A."));

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).post(pathCaptor.capture(), anyMap(), eq(Map.class));

        assertThat(pathCaptor.getValue()).doesNotContain("agent_id");
    }

    // -------------------------------------------------------------------------
    // deleteFaq()
    // -------------------------------------------------------------------------

    @Test
    void should_throw_not_found_when_deleting_faq_that_does_not_exist() {
        Agent agent = agentRepository.save(draftAgent("777888001"));
        long nonExistentFaqId = Long.MAX_VALUE;

        assertThatThrownBy(() -> agentService.deleteFaq(agent.getId(), nonExistentFaqId))
                .isInstanceOf(NotFoundException.class);
    }

    // -------------------------------------------------------------------------
    // deleteAgent() — regression: FK RESTRICT on child tables previously threw an
    // unhandled ConstraintViolationException / 500 for any agent with child data.
    // -------------------------------------------------------------------------

    @Test
    void should_delete_agent_with_no_child_data() {
        Agent agent = agentRepository.save(draftAgent("700000001"));

        agentService.deleteAgent(agent.getId());

        assertThat(agentRepository.findById(agent.getId())).isEmpty();
    }

    @Test
    void should_delete_agent_and_cascade_faqs_without_constraint_violation() {
        Agent agent = agentRepository.save(draftAgent("700000002"));
        // No phone-sync path exercised here — this agent has a phone, so addFaq
        // will attempt a Meta sync; stub it so the FAQ save succeeds.
        when(metaApiClient.post(contains("/agent_config/faq"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-faq-del"));
        agentService.addFaq(agent.getId(), new FaqRequest("Q?", "A."));
        assertThat(agentFaqRepository.findAllByAgentId(agent.getId())).hasSize(1);

        agentService.deleteAgent(agent.getId());

        assertThat(agentRepository.findById(agent.getId())).isEmpty();
        assertThat(agentFaqRepository.findAllByAgentId(agent.getId())).isEmpty();
    }

    @Test
    void should_delete_agent_and_cascade_skills_without_constraint_violation() {
        Agent agent = agentRepository.save(draftAgent("700000003"));
        when(metaApiClient.post(contains("/agent_config/skills"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("id", "meta-skill-del"));
        agentService.addSkill(agent.getId(), new SkillRequest("Title", "Desc", "Body"));
        assertThat(agentSkillRepository.findAllByAgentId(agent.getId())).hasSize(1);

        agentService.deleteAgent(agent.getId());

        assertThat(agentRepository.findById(agent.getId())).isEmpty();
        assertThat(agentSkillRepository.findAllByAgentId(agent.getId())).isEmpty();
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
