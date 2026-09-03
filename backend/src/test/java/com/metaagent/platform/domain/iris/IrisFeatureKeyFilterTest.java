package com.metaagent.platform.domain.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.iris.AgentCreationToolProvider;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.skill.service.SkillLibraryService;
import com.metaagent.platform.domain.templatestudio.TemplateStudioService;
import com.metaagent.platform.domain.templatestudio.iris.KarixMessagingClient;
import com.metaagent.platform.domain.templatestudio.iris.TemplateStudioToolProvider;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.service.WabaService;
import jakarta.validation.Validation;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IrisFeatureKeyFilterTest {

    private IrisSessionRepository sessionRepository;
    private IrisMessageRepository messageRepository;
    private AiCredentialService aiCredentialService;
    private TemplateStudioService templateStudioService;
    private AgentService agentService;
    private AiProviderAdapter adapter;
    private IrisConversationService service;

    private static final Long ACCOUNT_ID = 1L;
    private static final Long WABA_ID = 100L;
    private static final Long SESSION_ID = 999L;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(IrisSessionRepository.class);
        messageRepository = mock(IrisMessageRepository.class);
        aiCredentialService = mock(AiCredentialService.class);
        templateStudioService = mock(TemplateStudioService.class);
        KarixMessagingClient karixMessagingClient = mock(KarixMessagingClient.class);
        WabaService wabaService = mock(WabaService.class);
        agentService = mock(AgentService.class);
        BusinessProfileRepository businessProfileRepository = mock(BusinessProfileRepository.class);
        SkillLibraryService skillLibraryService = mock(SkillLibraryService.class);
        adapter = mock(AiProviderAdapter.class);

        TemplateStudioToolProvider templateStudioToolProvider = new TemplateStudioToolProvider(
                templateStudioService, karixMessagingClient, new ObjectMapper(),
                new com.metaagent.platform.domain.templatestudio.iris.IrisAttachmentRegistry(), wabaService,
                Validation.buildDefaultValidatorFactory().getValidator());
        AgentCreationToolProvider agentCreationToolProvider = new AgentCreationToolProvider(
                agentService, businessProfileRepository, skillLibraryService,
                Validation.buildDefaultValidatorFactory().getValidator());

        service = new IrisConversationService(
                sessionRepository, messageRepository, aiCredentialService,
                List.of(adapter), List.of(templateStudioToolProvider, agentCreationToolProvider), new ObjectMapper());

        when(adapter.provider()).thenReturn(AiProvider.CLAUDE);
        when(aiCredentialService.resolveForConversation())
                .thenReturn(new AiCredentialService.ResolvedAiCredential("CLAUDE", "claude-3-5-sonnet-20241022", "sk-test", false));

        Waba waba = mock(Waba.class);
        when(waba.getId()).thenReturn(WABA_ID);
        when(waba.getLabel()).thenReturn("Test WABA");
        when(wabaService.listForAccount(ACCOUNT_ID)).thenReturn(List.of(waba));
        when(agentService.listAgents()).thenReturn(List.of());

        when(sessionRepository.existsByIdAndAccountId(SESSION_ID, ACCOUNT_ID)).thenReturn(true);
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.findAllBySessionIdOrderByCreatedAtAsc(SESSION_ID)).thenReturn(List.of());

        authenticateAs(ACCOUNT_ID);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void template_studio_session_does_not_see_create_skill() {
        stubSession("template_studio");
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.text("ok"));

        service.sendMessage(SESSION_ID, "hello");

        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<List<AiToolSpec>> tools = ArgumentCaptor.forClass(List.class);
        verify(adapter).converse(any(), any(), prompt.capture(), any(), tools.capture());
        assertThat(tools.getValue()).extracting(AiToolSpec::name)
                .contains("create_template", "list_templates")
                .doesNotContain("create_skill");
        assertThat(prompt.getValue())
                .contains("Here are the WABAs this operator can use")
                .doesNotContain("This operator's Business Agents")
                .doesNotContain("This operator has no Business Agents yet");
    }

    @Test
    void agent_creation_session_does_not_see_template_tools() {
        stubSession("agent_creation");
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.text("ok"));

        service.sendMessage(SESSION_ID, "hello");

        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<List<AiToolSpec>> tools = ArgumentCaptor.forClass(List.class);
        verify(adapter).converse(any(), any(), prompt.capture(), any(), tools.capture());
        assertThat(tools.getValue()).extracting(AiToolSpec::name)
                .contains("create_skill")
                .doesNotContain("create_template", "edit_template", "list_templates", "get_template", "send_test_template");
        assertThat(prompt.getValue())
                .doesNotContain("Here are the WABAs this operator can use")
                .contains("This operator has no Business Agents yet");
    }

    @Test
    void agent_creation_session_rejects_create_template_tool_call() {
        stubSession("agent_creation");
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.toolCall("create_template", Map.of(
                        "wabaId", String.valueOf(WABA_ID),
                        "templateName", "summer_sale",
                        "language", "en_US",
                        "category", "MARKETING",
                        "components", List.of(Map.of("type", "BODY", "text", "Hi")))));

        assertThatThrownBy(() -> service.sendMessage(SESSION_ID, "make a template"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("create_template");
    }

    @Test
    void template_studio_session_rejects_create_skill_tool_call() {
        stubSession("template_studio");
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.toolCall("create_skill", Map.of(
                        "agentId", "1", "title", "Returns", "description", "d", "body", "b")));

        assertThatThrownBy(() -> service.sendMessage(SESSION_ID, "create a skill"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("create_skill");
    }

    @Test
    void agent_creation_session_cannot_confirm_pending_create_template() {
        IrisSession session = IrisSession.builder()
                .id(SESSION_ID).accountId(ACCOUNT_ID)
                .featureKey("agent_creation")
                .pendingToolName("create_template")
                .pendingToolArgsJson("{\"wabaId\":\"100\",\"templateName\":\"x\",\"language\":\"en_US\",\"category\":\"MARKETING\",\"components\":[]}")
                .build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.confirmPendingAction(SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("create_template");
    }

    @Test
    void template_studio_session_cannot_confirm_pending_create_skill() {
        IrisSession session = IrisSession.builder()
                .id(SESSION_ID).accountId(ACCOUNT_ID)
                .featureKey("template_studio")
                .pendingToolName("create_skill")
                .pendingToolArgsJson("{\"agentId\":\"1\",\"title\":\"t\",\"description\":\"d\",\"body\":\"b\"}")
                .build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.confirmPendingAction(SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("create_skill");
    }

    @Test
    void unknown_feature_key_is_rejected() {
        stubSession("unknown_feature");

        assertThatThrownBy(() -> service.sendMessage(SESSION_ID, "hello"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Iris is not configured for this chat.");
    }

    private void stubSession(String featureKey) {
        IrisSession session = IrisSession.builder()
                .id(SESSION_ID).accountId(ACCOUNT_ID)
                .featureKey(featureKey).build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));
    }

    private void authenticateAs(Long accId) {
        com.metaagent.platform.common.security.TenantDetails tenantDetails =
                new com.metaagent.platform.common.security.TenantDetails(accId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }
}
