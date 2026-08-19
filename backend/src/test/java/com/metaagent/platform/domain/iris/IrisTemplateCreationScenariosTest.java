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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
                .thenReturn(new AiCredentialService.ResolvedAiCredential("CLAUDE", "claude-3-5-sonnet-20241022", "sk-test", false));

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
        when(templateStudioService.listTemplates(WABA_ID, "APPROVED")).thenReturn(Map.of(
                "result", Map.of("response", Map.of("templates", List.of(Map.of("name", "summer_sale"))))));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, userAsk);

        assertThat(response.needsConfirmation()).isFalse();
        // 2026-08-19 fix: this used to be a raw JSON dump of the tool result —
        // now a readable summary, never the JSON itself.
        assertThat(response.reply()).isEqualTo("Found 1 template.");
        verify(templateStudioService).listTemplates(WABA_ID, "APPROVED");
    }

    @Test
    void listing_templates_with_no_results_gets_a_readable_empty_message() {
        Map<String, Object> modelArgs = Map.of("wabaId", String.valueOf(WABA_ID), "status", "APPROVED");
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("list_templates", modelArgs));
        when(templateStudioService.listTemplates(WABA_ID, "APPROVED")).thenReturn(
                Map.of("result", Map.of("response", Map.of("templates", List.of()))));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, "list approved templates");

        assertThat(response.reply()).isEqualTo("No templates found for that filter.");
    }

    @Test
    void cancel_pending_action_is_a_true_no_op_when_nothing_is_pending() {
        // 2026-08-19 fix: used to unconditionally save a "Cancelled" message
        // even when there was nothing to cancel (e.g. a defensive cleanup
        // call after aborting a send that never actually proposed an action).
        service.cancelPendingAction(SESSION_ID);

        verify(sessionRepository, never()).save(any());
        verify(messageRepository, never()).save(any());
    }

    @Test
    void model_omitting_a_required_field_is_rejected_with_a_clear_message_naming_it() {
        // 2026-08-19 fix: this used to silently become the literal string
        // "null" deep inside TemplateStudioToolProvider instead of failing
        // clearly here, before any request was even built.
        Map<String, Object> modelArgs = new java.util.HashMap<>();
        modelArgs.put("wabaId", String.valueOf(WABA_ID));
        modelArgs.put("language", "en_US");
        modelArgs.put("category", "MARKETING");
        modelArgs.put("components", List.of(Map.of("type", "BODY", "text", "Hello")));
        // templateName deliberately omitted
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("create_template", modelArgs));

        assertThatThrownBy(() -> service.sendMessage(SESSION_ID, "make a template"))
                .isInstanceOf(com.metaagent.platform.common.exception.BusinessException.class)
                .hasMessageContaining("templateName");

        verifyNoInteractions(templateStudioService);
    }

    @Test
    void missing_required_field_is_also_rejected_on_the_inline_execute_no_confirmation_branch() {
        // Same requireArgsPresent() check runs before EITHER branch (confirm-
        // draft above, or inline-execute here for list_templates, which has
        // requiresConfirmation=false) — this proves it's not only reachable
        // on the confirm-draft path. Exception propagation itself is the
        // same, already-proven mechanism as model_proposing_a_tool_outside_
        // the_allowlist_is_hard_rejected below (a plain thrown
        // BusinessException out of sendMessage, no branch-specific catch).
        Map<String, Object> modelArgs = Map.of("status", "APPROVED"); // wabaId omitted
        when(adapter.converse(any(), any(), any(), any(), any())).thenReturn(AiTurnResult.toolCall("list_templates", modelArgs));

        assertThatThrownBy(() -> service.sendMessage(SESSION_ID, "list approved templates"))
                .isInstanceOf(com.metaagent.platform.common.exception.BusinessException.class)
                .hasMessageContaining("wabaId");

        verifyNoInteractions(templateStudioService);
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
    void model_replying_in_prose_that_it_already_created_something_gets_a_correction_appended() {
        // The exact failure the system prompt already tells the model not to
        // do (reply "I've created it" in prose instead of calling the tool) —
        // this is the code-level backstop for when it ignores that anyway.
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.text("I've created the summer_sale template for you!"));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, "create a summer sale template");

        assertThat(response.needsConfirmation()).isFalse();
        assertThat(response.reply()).contains("Nothing has actually been submitted yet");
    }

    @Test
    void model_replying_in_plain_conversation_gets_no_correction_appended() {
        when(adapter.converse(any(), any(), any(), any(), any()))
                .thenReturn(AiTurnResult.text("Sure — what would you like the template to say?"));

        IrisConversationService.TurnResponse response = service.sendMessage(SESSION_ID, "I want to make a template");

        assertThat(response.reply()).doesNotContain("Nothing has actually been submitted yet");
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
