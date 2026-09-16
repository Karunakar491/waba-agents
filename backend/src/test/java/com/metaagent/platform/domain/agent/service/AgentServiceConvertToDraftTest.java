package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentFaq;
import com.metaagent.platform.domain.agent.entity.AgentFile;
import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import com.metaagent.platform.domain.agent.entity.AgentWebsite;
import com.metaagent.platform.domain.agent.repository.AgentFaqRepository;
import com.metaagent.platform.domain.agent.repository.AgentFileRepository;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentUiSkillRepository;
import com.metaagent.platform.domain.agent.repository.AgentWebsiteRepository;
import com.metaagent.platform.domain.skill.entity.AgentSkillAttachment;
import com.metaagent.platform.domain.skill.entity.Skill;
import com.metaagent.platform.domain.skill.repository.AgentSkillAttachmentRepository;
import com.metaagent.platform.domain.skill.repository.SkillRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.entity.WabaAccountAccess;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Preserving an agent as a draft, against a real schema.
 *
 * <p>Mocks would prove nothing here: the question is which rows actually
 * survive a delete and whether the cascade still runs in an FK-safe order, and
 * only the real database answers that. The hard-delete case is covered too —
 * moving both paths onto one shared manifest must not have changed it.
 */
class AgentServiceConvertToDraftTest extends IntegrationTestBase {

    @Autowired private AgentService agentService;
    @Autowired private AgentRepository agentRepository;
    @Autowired private AgentFaqRepository agentFaqRepository;
    @Autowired private AgentWebsiteRepository agentWebsiteRepository;
    @Autowired private AgentFileRepository agentFileRepository;
    @Autowired private AgentUiSkillRepository agentUiSkillRepository;
    @Autowired private AgentSkillAttachmentRepository agentSkillAttachmentRepository;
    @Autowired private SkillRepository skillRepository;
    @Autowired private BusinessAccountRepository businessAccountRepository;
    @Autowired private WabaRepository wabaRepository;
    @Autowired private WabaAccountAccessRepository wabaAccountAccessRepository;

    private Long accountId;
    private Long wabaId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Test Company")
                .email("convert-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
        // skill.waba_id is a real FK, so the library skill below needs a real WABA.
        wabaId = wabaRepository.save(Waba.builder()
                .accountId(accountId)
                .wabaId("waba-" + UUID.randomUUID().toString().substring(0, 8))
                .label("Test WABA")
                .build()).getId();
        // Access to a bound agent is granted through waba_account_access, not
        // Agent.accountId (the 2026-07-28 decoupling), so without this grant the
        // agent is invisible even to the account that created it.
        wabaAccountAccessRepository.save(WabaAccountAccess.builder()
                .wabaId(wabaId).accountId(accountId).grantedBy(accountId)
                .build());
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // -------------------------------------------------------------------------
    // Preserve
    // -------------------------------------------------------------------------

    @Test
    void keepsTheAgentAsADraftWithItsWaba() {
        Agent agent = agentWithContent();

        agentService.convertToDraft(agent.getId(), wabaId);

        Agent preserved = agentRepository.findById(agent.getId()).orElseThrow();
        assertThat(preserved.getStatus()).isEqualTo(Agent.Status.draft);
        assertThat(preserved.isEnabled()).isFalse();
        // Without the WABA the draft cannot see its own library content or be rebound.
        assertThat(preserved.getWabaId()).isEqualTo(wabaId);
    }

    @Test
    void keepsTheKnowledgeBaseTheOperatorWroteByHand() {
        Agent agent = agentWithContent();

        AgentService.DraftPreservationCounts counts =
                agentService.convertToDraft(agent.getId(), wabaId);

        assertThat(agentFaqRepository.findAllByAgentId(agent.getId())).hasSize(2);
        assertThat(agentWebsiteRepository.findAllByAgentId(agent.getId())).hasSize(1);
        assertThat(counts.faqsKept()).isEqualTo(2);
        assertThat(counts.websitesKept()).isEqualTo(1);
    }

    /**
     * Teardown has just deleted these objects on Meta. Leaving the ids set would
     * have a later republish patch records Meta no longer knows about.
     */
    @Test
    void clearsMetaIdsOnEverythingItKeeps() {
        Agent agent = agentWithContent();

        agentService.convertToDraft(agent.getId(), wabaId);

        assertThat(agentFaqRepository.findAllByAgentId(agent.getId()))
                .allSatisfy(faq -> {
                    assertThat(faq.getMetaFaqId()).isNull();
                    assertThat(faq.isMetaSynced()).isFalse();
                });
        assertThat(agentWebsiteRepository.findAllByAgentId(agent.getId()))
                .allSatisfy(site -> assertThat(site.getMetaWebsiteId()).isNull());
        assertThat(agentUiSkillRepository.findAllByAgentId(agent.getId()))
                .allSatisfy(skill -> assertThat(skill.getMetaUiSkillId()).isNull());
    }

    /** The attachment is the draft's link to the Skill Library; only its Meta id is dead. */
    @Test
    void keepsSkillAttachmentsButClearsTheirMetaIds() {
        Agent agent = agentWithContent();

        agentService.convertToDraft(agent.getId(), wabaId);

        assertThat(agentSkillAttachmentRepository.findAllByAgentId(agent.getId()))
                .singleElement()
                .satisfies(attachment -> {
                    assertThat(attachment.getMetaSkillId()).isNull();
                    assertThat(attachment.getDeployedAt()).isNull();
                });
    }

    /**
     * addFile streams the bytes straight to Meta and keeps only the id, and
     * teardown has just deleted them there. A kept row would be a filename
     * pointing at nothing, so the dialog warns and the rows go.
     */
    @Test
    void dropsFileRowsBecauseTheirContentsOnlyEverLivedOnMeta() {
        Agent agent = agentWithContent();

        AgentService.DraftPreservationCounts counts =
                agentService.convertToDraft(agent.getId(), wabaId);

        assertThat(agentFileRepository.findAllByAgentId(agent.getId())).isEmpty();
        assertThat(counts.filesDropped()).isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // Hard delete — unchanged by the shared manifest
    // -------------------------------------------------------------------------

    @Test
    void deleteAgentStillClearsEveryChildTableAndTheAgentRow() {
        Agent agent = agentWithContent();
        Long id = agent.getId();

        agentService.deleteAgent(id);

        assertThat(agentRepository.findById(id)).isEmpty();
        assertThat(agentFaqRepository.findAllByAgentId(id)).isEmpty();
        assertThat(agentWebsiteRepository.findAllByAgentId(id)).isEmpty();
        assertThat(agentFileRepository.findAllByAgentId(id)).isEmpty();
        assertThat(agentUiSkillRepository.findAllByAgentId(id)).isEmpty();
        assertThat(agentSkillAttachmentRepository.findAllByAgentId(id)).isEmpty();
    }

    /**
     * The founder's requirement, and today it holds only because the cascade
     * never touches the library table. Pinned so it stays a contract rather than
     * an accident.
     */
    @Test
    void deletingAPreservedDraftLaterRemovesTheAttachmentNotTheLibrarySkill() {
        Agent agent = agentWithContent();
        Long id = agent.getId();
        Long librarySkillId = agentSkillAttachmentRepository.findAllByAgentId(id).get(0).getSkillId();

        agentService.convertToDraft(id, wabaId);
        agentService.deleteAgent(id);

        assertThat(agentRepository.findById(id)).isEmpty();
        assertThat(agentSkillAttachmentRepository.findAllByAgentId(id)).isEmpty();
        assertThat(skillRepository.findById(librarySkillId))
                .as("the Library skill is not owned by the agent and must outlive it")
                .isPresent();
    }

    // -------------------------------------------------------------------------
    // Fixtures
    // -------------------------------------------------------------------------

    /** An agent carrying one row in each child table the preserve path touches. */
    private Agent agentWithContent() {
        Agent agent = agentRepository.save(Agent.builder()
                .accountId(accountId)
                .wabaId(wabaId)
                .displayName("Support Agent")
                .status(Agent.Status.paused)
                .enabled(true)
                .build());
        Long id = agent.getId();

        agentFaqRepository.save(AgentFaq.builder()
                .accountId(accountId).agentId(id)
                .question("What are your hours?").answer("9 to 5.")
                .metaFaqId("meta-faq-1").metaSynced(true)
                .status(AgentFaq.Status.published)
                .build());
        agentFaqRepository.save(AgentFaq.builder()
                .accountId(accountId).agentId(id)
                .question("Do you ship overseas?").answer("Yes.")
                .metaFaqId("meta-faq-2").metaSynced(true)
                .status(AgentFaq.Status.published)
                .build());
        agentWebsiteRepository.save(AgentWebsite.builder()
                .accountId(accountId).agentId(id)
                .url("https://example.com")
                .metaWebsiteId("meta-site-1").metaSynced(true)
                .build());
        agentFileRepository.save(AgentFile.builder()
                .accountId(accountId).agentId(id)
                .filename("returns-policy.pdf").mimeType("application/pdf")
                .sizeBytes(1024L).metaFileId("meta-file-1")
                .build());
        agentUiSkillRepository.save(AgentUiSkill.builder()
                .accountId(accountId).agentId(id)
                .title("Book a table").componentType(AgentUiSkill.ComponentType.cta_url)
                .instruction("Offer the booking link when the customer asks for a table.")
                .status(AgentUiSkill.Status.enabled)
                .metaUiSkillId("meta-ui-1")
                .build());
        // A real Library skill, not a fabricated id — agent_skill_attachment has a
        // FK to it, and whether that row outlives the agent is the whole point of
        // the last test below.
        Skill librarySkill = skillRepository.save(Skill.builder()
                .accountId(accountId)
                .wabaId(wabaId)
                .title("intent-router")
                .description("Routes the customer to the right flow.")
                .body("When the customer asks about an order, use the order lookup.")
                .build());
        agentSkillAttachmentRepository.save(AgentSkillAttachment.builder()
                .agentId(id).skillId(librarySkill.getId())
                .metaSkillId("meta-skill-1")
                .deployedAt(LocalDateTime.now())
                .build());

        return agent;
    }

    private void authenticateAs(Long targetAccountId) {
        TenantDetails tenantDetails = new TenantDetails(targetAccountId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                tenantDetails, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }
}
