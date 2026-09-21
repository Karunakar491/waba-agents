package com.metaagent.platform.domain.agent.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.dto.WebsiteRequest;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentFaq;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.entity.AgentWebsite;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.iris.AiToolSpec;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.skill.dto.SkillDtos;
import com.metaagent.platform.domain.skill.service.SkillLibraryService;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentCreationToolProviderTest {

    private final AgentService agentService = mock(AgentService.class);
    private final BusinessProfileRepository businessProfileRepository = mock(BusinessProfileRepository.class);
    private final SkillLibraryService skillLibraryService = mock(SkillLibraryService.class);

    private AgentCreationToolProvider provider;

    @BeforeEach
    void setUp() {
        provider = new AgentCreationToolProvider(
                agentService,
                businessProfileRepository,
                skillLibraryService,
                Validation.buildDefaultValidatorFactory().getValidator());
    }

    @Test
    void tools_includesCreateSkillAndOnAgentSkillCrudWithCorrectConfirmation() {
        List<AiToolSpec> tools = provider.tools();

        assertThat(tools).extracting(AiToolSpec::name)
                .contains(
                        "create_skill", "list_skills", "get_skill", "update_skill", "delete_skill",
                        "create_faq", "list_faqs", "get_faq", "update_faq", "delete_faq",
                        "add_knowledge_website", "list_knowledge_websites",
                        "update_knowledge_website", "delete_knowledge_website");
        assertThat(named(tools, "create_skill").requiresConfirmation()).isTrue();
        assertThat(named(tools, "list_skills").requiresConfirmation()).isFalse();
        assertThat(named(tools, "get_skill").requiresConfirmation()).isFalse();
        assertThat(named(tools, "update_skill").requiresConfirmation()).isTrue();
        assertThat(named(tools, "delete_skill").requiresConfirmation()).isTrue();
        assertThat(named(tools, "create_faq").requiresConfirmation()).isTrue();
        assertThat(named(tools, "list_faqs").requiresConfirmation()).isFalse();
        assertThat(named(tools, "get_faq").requiresConfirmation()).isFalse();
        assertThat(named(tools, "update_faq").requiresConfirmation()).isTrue();
        assertThat(named(tools, "delete_faq").requiresConfirmation()).isTrue();
        assertThat(named(tools, "add_knowledge_website").requiresConfirmation()).isTrue();
        assertThat(named(tools, "list_knowledge_websites").requiresConfirmation()).isFalse();
        assertThat(named(tools, "update_knowledge_website").requiresConfirmation()).isTrue();
        assertThat(named(tools, "delete_knowledge_website").requiresConfirmation()).isTrue();
        assertThat(named(tools, "create_skill").description()).containsIgnoringCase("library");
    }

    @Test
    void execute_createSkill_callsLibraryWithWabaFromAgent() {
        Long agentId = 42L;
        Long wabaId = 99L;
        Agent agent = Agent.builder().id(agentId).wabaId(wabaId).build();
        when(agentService.getAgent(agentId)).thenReturn(agent);
        SkillDtos.SkillResponse created = mock(SkillDtos.SkillResponse.class);
        when(skillLibraryService.createSkill(any())).thenReturn(created);

        Map<String, Object> result = provider.execute("create_skill", Map.of(
                "agentId", String.valueOf(agentId),
                "title", "Return Policy",
                "description", "How returns work",
                "body", "Quote the saved return policy."
        ), 1L);

        ArgumentCaptor<SkillDtos.CreateRequest> captor = ArgumentCaptor.forClass(SkillDtos.CreateRequest.class);
        verify(skillLibraryService).createSkill(captor.capture());
        SkillDtos.CreateRequest request = captor.getValue();
        assertThat(request.wabaId()).isEqualTo(String.valueOf(wabaId));
        assertThat(request.title()).isEqualTo("Return Policy");
        assertThat(request.description()).isEqualTo("How returns work");
        assertThat(request.body()).isEqualTo("Quote the saved return policy.");
        assertThat(result).containsEntry("skill", created);
    }

    @Test
    void execute_listSkills_dispatchesToAgentServiceAndSummarizes() {
        Long agentId = 42L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        AgentSkill one = AgentSkill.builder().id(11L).agentId(agentId).title("A").description("d").body("long body").build();
        AgentSkill two = AgentSkill.builder().id(12L).agentId(agentId).title("B").description("d").body("long body").build();
        when(agentService.getSkills(agentId)).thenReturn(List.of(one, two));

        Map<String, Object> result = provider.execute("list_skills", Map.of("agentId", String.valueOf(agentId)), 1L);

        verify(agentService).getSkills(agentId);
        assertThat(result.get("count")).isEqualTo(2);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> skills = (List<Map<String, Object>>) result.get("skills");
        assertThat(skills).hasSize(2);
        assertThat(skills.get(0).get("id")).isEqualTo("11");
        assertThat(provider.summarizeResult("list_skills", result)).isEqualTo("Found 2 skills.");
    }

    @Test
    void summarizeResult_listSkills_empty() {
        Long agentId = 42L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        when(agentService.getSkills(agentId)).thenReturn(List.of());

        Map<String, Object> result = provider.execute("list_skills", Map.of("agentId", "42"), 1L);

        assertThat(provider.summarizeResult("list_skills", result)).isEqualTo("No skills on this agent yet.");
    }

    @Test
    void execute_getSkill_dispatchesToAgentService() {
        Long agentId = 42L;
        Long skillId = 11L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        AgentSkill skill = AgentSkill.builder()
                .id(skillId).agentId(agentId).title("Hours").description("When we are open").body("9-5")
                .build();
        when(agentService.getSkill(agentId, skillId)).thenReturn(skill);

        Map<String, Object> result = provider.execute("get_skill", Map.of(
                "agentId", String.valueOf(agentId),
                "skillId", String.valueOf(skillId)
        ), 1L);

        verify(agentService).getSkill(agentId, skillId);
        assertThat(result.get("id")).isEqualTo("11");
        assertThat(result.get("title")).isEqualTo("Hours");
        assertThat(provider.summarizeResult("get_skill", result)).doesNotContain("9-5");
    }

    @Test
    void execute_updateSkill_getAgentThenUpdateSkill() {
        Long agentId = 42L;
        Long skillId = 11L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        AgentSkill updated = AgentSkill.builder()
                .id(skillId).agentId(agentId).title("New").description("Desc").body("Body")
                .build();
        when(agentService.updateSkill(eq(agentId), eq(skillId), any())).thenReturn(updated);

        Map<String, Object> result = provider.execute("update_skill", Map.of(
                "agentId", String.valueOf(agentId),
                "skillId", String.valueOf(skillId),
                "title", "New",
                "description", "Desc",
                "body", "Body"
        ), 1L);

        InOrder order = inOrder(agentService);
        order.verify(agentService).getAgent(agentId);
        ArgumentCaptor<SkillRequest> captor = ArgumentCaptor.forClass(SkillRequest.class);
        order.verify(agentService).updateSkill(eq(agentId), eq(skillId), captor.capture());
        SkillRequest request = captor.getValue();
        assertThat(request.title()).isEqualTo("New");
        assertThat(request.description()).isEqualTo("Desc");
        assertThat(request.body()).isEqualTo("Body");
        assertThat(result.get("id")).isEqualTo("11");
        assertThat(result.get("title")).isEqualTo("New");
    }

    @Test
    void execute_deleteSkill_getAgentThenDeleteSkill() {
        Long agentId = 42L;
        Long skillId = 11L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());

        provider.execute("delete_skill", Map.of(
                "agentId", String.valueOf(agentId),
                "skillId", String.valueOf(skillId)
        ), 1L);

        InOrder order = inOrder(agentService);
        order.verify(agentService).getAgent(agentId);
        order.verify(agentService).deleteSkill(agentId, skillId);
    }

    @Test
    void execute_unknownTool_throwsBusinessException() {
        assertThatThrownBy(() -> provider.execute("not_a_tool", Map.of(), 1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Unknown tool");
    }

    @Test
    void execute_createSkill_missingWaba_throwsBusinessException() {
        Long agentId = 7L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).wabaId(null).build());

        assertThatThrownBy(() -> provider.execute("create_skill", Map.of(
                "agentId", agentId,
                "title", "T",
                "description", "D",
                "body", "B"
        ), 1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("WABA")
                .hasMessageContaining("connect");
    }

    @Test
    void execute_createFaq_validatesAndCallsAddFaq() {
        Long agentId = 42L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        AgentFaq saved = AgentFaq.builder().id(8L).agentId(agentId).question("Hours?").answer("9-5").build();
        when(agentService.addFaq(eq(agentId), any())).thenReturn(saved);

        Map<String, Object> result = provider.execute("create_faq", Map.of(
                "agentId", "42",
                "question", "Hours?",
                "answer", "9-5"
        ), 1L);

        InOrder order = inOrder(agentService);
        order.verify(agentService).getAgent(agentId);
        ArgumentCaptor<FaqRequest> captor = ArgumentCaptor.forClass(FaqRequest.class);
        order.verify(agentService).addFaq(eq(agentId), captor.capture());
        assertThat(captor.getValue().question()).isEqualTo("Hours?");
        assertThat(captor.getValue().answer()).isEqualTo("9-5");
        assertThat(result.get("id")).isEqualTo("8");
    }

    @Test
    void execute_listFaqs_summarizes() {
        Long agentId = 42L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        when(agentService.getFaqs(agentId)).thenReturn(List.of(
                AgentFaq.builder().id(1L).question("Q").answer("A").build()));

        Map<String, Object> result = provider.execute("list_faqs", Map.of("agentId", "42"), 1L);

        assertThat(result.get("count")).isEqualTo(1);
        assertThat(provider.summarizeResult("list_faqs", result)).isEqualTo("Found 1 FAQs.");
    }

    @Test
    void execute_getUpdateDeleteFaq() {
        Long agentId = 42L;
        Long faqId = 8L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).build());
        AgentFaq faq = AgentFaq.builder().id(faqId).question("Q").answer("A").build();
        when(agentService.getFaq(agentId, faqId)).thenReturn(faq);
        when(agentService.updateFaq(eq(agentId), eq(faqId), any())).thenReturn(faq);

        assertThat(provider.execute("get_faq", Map.of("agentId", "42", "faqId", "8"), 1L).get("question"))
                .isEqualTo("Q");
        provider.execute("update_faq", Map.of("agentId", "42", "faqId", "8", "question", "Q2", "answer", "A2"), 1L);
        provider.execute("delete_faq", Map.of("agentId", "42", "faqId", "8"), 1L);

        verify(agentService).getFaq(agentId, faqId);
        verify(agentService).updateFaq(eq(agentId), eq(faqId), any());
        verify(agentService).deleteFaq(agentId, faqId);
    }

    @Test
    void execute_addWebsite_requiresPhoneThenCallsService() {
        Long agentId = 42L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).phoneNumberId("pn").build());
        AgentWebsite saved = AgentWebsite.builder().id(3L).url("https://example.com").build();
        when(agentService.addWebsite(eq(agentId), any())).thenReturn(saved);

        Map<String, Object> result = provider.execute("add_knowledge_website", Map.of(
                "agentId", "42", "url", "https://example.com"), 1L);

        ArgumentCaptor<WebsiteRequest> captor = ArgumentCaptor.forClass(WebsiteRequest.class);
        verify(agentService).addWebsite(eq(agentId), captor.capture());
        assertThat(captor.getValue().url()).isEqualTo("https://example.com");
        assertThat(result.get("id")).isEqualTo("3");
    }

    @Test
    void execute_addWebsite_withoutPhone_throws() {
        when(agentService.getAgent(42L)).thenReturn(Agent.builder().id(42L).phoneNumberId(null).build());

        assertThatThrownBy(() -> provider.execute("add_knowledge_website", Map.of(
                "agentId", "42", "url", "https://example.com"), 1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Connect a phone number in Basics");
    }

    @Test
    void execute_listUpdateDeleteWebsites() {
        Long agentId = 42L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).phoneNumberId("pn").build());
        AgentWebsite site = AgentWebsite.builder().id(3L).url("https://example.com").build();
        when(agentService.getWebsites(agentId)).thenReturn(List.of(site));
        when(agentService.updateWebsite(eq(agentId), eq(3L), any())).thenReturn(site);

        Map<String, Object> listed = provider.execute("list_knowledge_websites", Map.of("agentId", "42"), 1L);
        assertThat(provider.summarizeResult("list_knowledge_websites", listed)).isEqualTo("Found 1 websites.");
        provider.execute("update_knowledge_website", Map.of("agentId", "42", "websiteId", "3", "url", "https://example.com/a"), 1L);
        provider.execute("delete_knowledge_website", Map.of("agentId", "42", "websiteId", "3"), 1L);
        verify(agentService).updateWebsite(eq(agentId), eq(3L), any());
        verify(agentService).deleteWebsite(agentId, 3L);
    }

    private static AiToolSpec named(List<AiToolSpec> tools, String name) {
        return tools.stream().filter(t -> name.equals(t.name())).findFirst().orElseThrow();
    }
}
