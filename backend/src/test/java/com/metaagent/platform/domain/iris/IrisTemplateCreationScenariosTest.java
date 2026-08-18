package com.metaagent.platform.domain.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.templatestudio.TemplateStudioService;
import com.metaagent.platform.domain.templatestudio.iris.KarixMessagingClient;
import com.metaagent.platform.domain.templatestudio.iris.TemplateStudioToolProvider;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.service.WabaService;
import jakarta.validation.Validation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Drives IrisConversationService the way a real operator would type in
 * chat — one plain-English ask per WhatsApp template category — with a
 * mocked AiProviderAdapter standing in for the LLM (no real API key, no
 * real Meta/Karix call; the model's tool-call response is scripted per
 * scenario the same way a real Claude/OpenAI response would arrive).
 * Exercises the confirm-before-submit contract end to end: pending state
 * after sendMessage(), executeTool()'s actual payload after confirm().
 *
 * Written alongside the codeExpirationMinutes fix (2026-08-06, PM+EM
 * approved) — the AUTHENTICATION scenario below is exactly the case that
 * was silently broken before that fix (tool schema had no slot for it).
 */
class IrisTemplateCreationScenariosTest {

    private IrisSessionRepository sessionRepository;
    private IrisMessageRepository messageRepository;
    private AiCredentialService aiCredentialService;
    private TemplateStudioService templateStudioService;
    private KarixMessagingClient karixMessagingClient;
    private WabaService wabaService;
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
        karixMessagingClient = mock(KarixMessagingClient.class);
        wabaService = mock(WabaService.class);
        adapter = mock(AiProviderAdapter.class);

        TemplateStudioToolProvider templateStudioToolProvider = new TemplateStudioToolProvider(
                templateStudioService, karixMessagingClient, wabaService,
                Validation.buildDefaultValidatorFactory().getValidator());

        service = new IrisConversationService(
                sessionRepository, messageRepository, aiCredentialService,
                List.of(adapter), List.of(templateStudioToolProvider), new ObjectMapper());

        when(adapter.provider()).thenReturn(AiProvider.CLAUDE);
        when(aiCredentialService.resolveForConversation())
                .thenReturn(new AiCredentialService.ResolvedAiCredential("CLAUDE", "claude-3-5-sonnet-20241022", "sk-test"));

        Waba waba = mock(Waba.class);
        when(waba.getId()).thenReturn(WABA_ID);
        when(waba.getLabel()).thenReturn("Test WABA");
        when(wabaService.listForAccount(ACCOUNT_ID)).thenReturn(List.of(waba));

        IrisSession session = IrisSession.builder().id(SESSION_ID).accountId(ACCOUNT_ID).wabaId(null).build();
        when(sessionRepository.existsByIdAndAccountId(SESSION_ID, ACCOUNT_ID)).thenReturn(true);
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));
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
    void user_asks_for_a_plain_marketing_template() {
        String userAsk = "Create a marketing template called summer_sale in English announcing our summer discount, "
                + "just a text body with a discount message.";
        Map<String, Object> modelArgs = Map.of(
                "wabaId", String.valueOf(WABA_ID),
                "templateName", "summer_sale",
                "language", "en_US",
                "category", "MARKETING",
                "components", List.of(Map.of("type", "BODY", "text", "Summer sale! Get 20% off everything this week.")));
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("create_template", modelArgs));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, userAsk);

        assertThat(response.needsConfirmation()).isTrue();
        assertThat(response.pendingToolName()).isEqualTo("create_template");
        assertThat(response.pendingToolArgs()).isEqualTo(modelArgs);
    }

    @Test
    void user_asks_for_a_utility_template_with_an_image_header() {
        String userAsk = "I need a utility template for order shipped notifications, with a picture at the top, "
                + "called order_shipped.";
        Map<String, Object> modelArgs = Map.of(
                "wabaId", String.valueOf(WABA_ID),
                "templateName", "order_shipped",
                "language", "en_US",
                "category", "UTILITY",
                "components", List.of(
                        Map.of("type", "HEADER", "format", "IMAGE"),
                        Map.of("type", "BODY", "text", "Your order has shipped and is on its way.")));
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("create_template", modelArgs));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, userAsk);

        assertThat(response.pendingToolArgs()).isEqualTo(modelArgs);
    }

    @Test
    void user_asks_for_an_otp_authentication_template_and_expiration_reaches_karix() {
        // The exact scenario that was silently broken before the codeExpirationMinutes fix.
        String userAsk = "Set up an authentication template for our login OTP, code should expire in 10 minutes.";
        Map<String, Object> modelArgs = Map.of(
                "wabaId", String.valueOf(WABA_ID),
                "templateName", "login_otp",
                "language", "en_US",
                "category", "AUTHENTICATION",
                "components", List.of(
                        Map.of("type", "BODY", "text", "{{1}}"),
                        Map.of("type", "BUTTONS", "buttons", List.of(Map.of("type", "OTP", "otp_type", "COPY_CODE")))),
                "codeExpirationMinutes", 10);
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("create_template", modelArgs));

        IrisConversationService.TurnResponse turn = service.sendMessage(SESSION_ID, userAsk);
        assertThat(turn.needsConfirmation()).isTrue();

        IrisSession sessionWithPending = IrisSession.builder().id(SESSION_ID).accountId(ACCOUNT_ID)
                .pendingToolName(turn.pendingToolName()).pendingToolArgsJson(toJson(modelArgs)).build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(sessionWithPending));

        service.confirmPendingAction(SESSION_ID);

        verify(templateStudioService).createTemplate(eq(WABA_ID), argThat(payload ->
                Integer.valueOf(10).equals(payload.get("code_expiration_minutes"))
                        && "AUTHENTICATION".equals(payload.get("category"))));
    }

    @Test
    void user_asks_for_a_template_with_call_to_action_buttons() {
        String userAsk = "Make a marketing template with a 'Visit website' button and a 'Call us' button, "
                + "call it store_promo.";
        Map<String, Object> modelArgs = Map.of(
                "wabaId", String.valueOf(WABA_ID),
                "templateName", "store_promo",
                "language", "en_US",
                "category", "MARKETING",
                "components", List.of(
                        Map.of("type", "BODY", "text", "Check out our new arrivals."),
                        Map.of("type", "BUTTONS", "buttons", List.of(
                                Map.of("type", "URL", "text", "Visit website", "url", "https://example.com"),
                                Map.of("type", "PHONE_NUMBER", "text", "Call us", "phone_number", "+15551234567")))));
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("create_template", modelArgs));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, userAsk);

        assertThat(response.pendingToolArgs()).isEqualTo(modelArgs);
    }

    @Test
    void user_asks_iris_to_just_list_existing_templates_and_it_executes_immediately_no_confirmation() {
        String userAsk = "What templates do we already have approved?";
        Map<String, Object> modelArgs = Map.of("wabaId", String.valueOf(WABA_ID), "status", "APPROVED");
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("list_templates", modelArgs));
        when(templateStudioService.listTemplates(WABA_ID, "APPROVED")).thenReturn(Map.of("data", List.of()));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, userAsk);

        assertThat(response.needsConfirmation()).isFalse();
        verify(templateStudioService).listTemplates(WABA_ID, "APPROVED");
    }

    @Test
    void model_proposing_a_tool_outside_the_allowlist_is_hard_rejected() {
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.toolCall("delete_everything", Map.of("wabaId", String.valueOf(WABA_ID))));

        org.junit.jupiter.api.Assertions.assertThrows(
                com.metaagent.platform.common.exception.BusinessException.class,
                () -> service.sendMessage(SESSION_ID, "please wipe all templates"));
    }

    @Test
    void create_session_defaults_null_feature_key_to_template_studio() {
        service.createSession(WABA_ID, null);

        verify(sessionRepository).save(argThat(s -> "template_studio".equals(s.getFeatureKey())));
    }

    @Test
    void create_session_defaults_blank_feature_key_to_template_studio() {
        service.createSession(WABA_ID, "   ");

        verify(sessionRepository).save(argThat(s -> "template_studio".equals(s.getFeatureKey())));
    }

    @Test
    void create_session_stores_explicit_feature_key_verbatim() {
        service.createSession(WABA_ID, "agent_creation");

        verify(sessionRepository).save(argThat(s -> "agent_creation".equals(s.getFeatureKey())));
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

    private String toJson(Object value) {
        try {
            return new ObjectMapper().writeValueAsString(value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
