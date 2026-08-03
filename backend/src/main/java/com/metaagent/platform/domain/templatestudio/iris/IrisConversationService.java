package com.metaagent.platform.domain.templatestudio.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.templatestudio.TemplateStudioService;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Iris's tool-calling loop. Fixed allowlist (2026-08-04, locked scope) —
 * create_template/edit_template/list_templates/send_test_template plus a
 * no-op "just talk" path. A tool name the model returns that ISN'T one of
 * these four is hard-rejected here, before anything executes — this
 * enforcement lives in code, never trusted to system-prompt instruction
 * alone.
 *
 * Confirm-before-submit: create_template/edit_template/send_test_template
 * all have requiresConfirmation=true — calling the tool does NOT execute
 * it. Instead the exact args are persisted on the session's pending_tool_*
 * columns and returned to the frontend as a preview; a separate confirm()
 * call replays THOSE persisted args (never a fresh model message) to
 * actually execute. list_templates is read-only and executes inline.
 *
 * v1 simplification (intentional, not hidden): after a tool executes, Iris
 * does not do a second full model round-trip using Anthropic's native
 * tool_result protocol — the outcome is appended as a plain message and the
 * next user turn continues naturally with that as context. A true
 * multi-step native tool loop is real complexity deferred past v1; this is
 * simpler and still correct for a request/response, turn-based assistant.
 */
@Service
@RequiredArgsConstructor
public class IrisConversationService {

    private static final String SYSTEM_PROMPT = """
            You are Iris, the WhatsApp template assistant inside Template Studio. You help create templates, \
            edit templates, list existing templates, send a TEST template to a test number, and discuss \
            marketing copy/strategy for WhatsApp templates. You do nothing else — no bulk sends, no campaigns, \
            no account or settings changes. If asked for something outside this, say plainly that you can't do that here.""";

    private final IrisSessionRepository sessionRepository;
    private final IrisMessageRepository messageRepository;
    private final AiCredentialService aiCredentialService;
    private final TemplateStudioService templateStudioService;
    private final KarixMessagingClient karixMessagingClient;
    private final List<AiProviderAdapter> adapters;
    private final ObjectMapper objectMapper;

    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("create_template", "Create a new WhatsApp template. Requires user confirmation before it is actually submitted.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateName", Map.of("type", "string"),
                            "language", Map.of("type", "string"),
                            "category", Map.of("type", "string"),
                            "components", Map.of("type", "array")),
                            "required", List.of("wabaId", "templateName", "language", "category", "components")),
                    true),
            new AiToolSpec("edit_template", "Edit an existing WhatsApp template's components. Requires user confirmation.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateId", Map.of("type", "string"),
                            "components", Map.of("type", "array")),
                            "required", List.of("wabaId", "templateId", "components")),
                    true),
            new AiToolSpec("list_templates", "List existing templates for a WABA, optionally filtered by status. Read-only, runs immediately.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "status", Map.of("type", "string")),
                            "required", List.of("wabaId")),
                    false),
            new AiToolSpec("send_test_template", "Send an approved template to a single test phone number. Requires user confirmation.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateId", Map.of("type", "string"),
                            "testPhoneNumber", Map.of("type", "string")),
                            "required", List.of("wabaId", "templateId", "testPhoneNumber")),
                    true)
    );

    public record TurnResponse(Long sessionId, String reply, boolean needsConfirmation, String pendingToolName, Map<String, Object> pendingToolArgs) {}

    public IrisSession createSession(Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        IrisSession session = IrisSession.builder().accountId(accountId).wabaId(wabaId).build();
        return sessionRepository.save(session);
    }

    public TurnResponse sendMessage(Long sessionId, String userText) {
        IrisSession session = requireOwnedSession(sessionId);
        if (session.getPendingToolName() != null) {
            throw new BusinessException("There's a pending action awaiting confirmation — confirm or cancel it before continuing.");
        }

        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.USER).content(userText).build());

        AiCredentialService.ResolvedAiCredential cred = aiCredentialService.resolveForConversation();
        AiProviderAdapter adapter = adapters.stream()
                .filter(a -> a.provider().name().equals(cred.provider()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("No adapter available for provider " + cred.provider()));

        List<AiMessage> history = messageRepository.findAllBySessionIdOrderByCreatedAtAsc(sessionId).stream()
                .filter(m -> m.getRole() != IrisMessage.Role.TOOL)
                .map(m -> new AiMessage(m.getRole() == IrisMessage.Role.USER ? AiMessage.Role.USER : AiMessage.Role.ASSISTANT, m.getContent()))
                .toList();

        AiTurnResult result = adapter.converse(cred.apiKey(), cred.model(), SYSTEM_PROMPT, history, TOOLS);

        if (result.type() == AiTurnResult.Type.TEXT) {
            messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT).content(result.text()).build());
            return new TurnResponse(sessionId, result.text(), false, null, null);
        }

        AiToolSpec tool = TOOLS.stream().filter(t -> t.name().equals(result.toolName())).findFirst()
                .orElseThrow(() -> new BusinessException("Iris tried to use a tool that isn't allowed: " + result.toolName()));

        if (!tool.requiresConfirmation()) {
            Map<String, Object> toolResult = executeTool(tool.name(), result.toolArguments());
            String summary = "Tool " + tool.name() + " result: " + writeJson(toolResult);
            messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.TOOL)
                    .content(summary).toolName(tool.name()).toolArgsJson(writeJson(result.toolArguments())).build());
            return new TurnResponse(sessionId, summary, false, null, null);
        }

        session.setPendingToolName(tool.name());
        session.setPendingToolArgsJson(writeJson(result.toolArguments()));
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT)
                .content("I've drafted this — review it and confirm to submit.").toolName(tool.name()).toolArgsJson(writeJson(result.toolArguments())).build());

        return new TurnResponse(sessionId, "I've drafted this — review it and confirm to submit.", true, tool.name(), result.toolArguments());
    }

    public Map<String, Object> confirmPendingAction(Long sessionId) {
        IrisSession session = requireOwnedSession(sessionId);
        if (session.getPendingToolName() == null) {
            throw new BusinessException("There's no pending action to confirm.");
        }
        String toolName = session.getPendingToolName();
        Map<String, Object> args = readJson(session.getPendingToolArgsJson());

        Map<String, Object> result = executeTool(toolName, args);

        session.setPendingToolName(null);
        session.setPendingToolArgsJson(null);
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.TOOL)
                .content("Confirmed and executed " + toolName + ": " + writeJson(result)).toolName(toolName).build());

        return result;
    }

    public void cancelPendingAction(Long sessionId) {
        IrisSession session = requireOwnedSession(sessionId);
        session.setPendingToolName(null);
        session.setPendingToolArgsJson(null);
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT)
                .content("Cancelled — nothing was submitted.").build());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeTool(String toolName, Map<String, Object> args) {
        Long wabaId = Long.valueOf(String.valueOf(args.get("wabaId")));
        return switch (toolName) {
            case "create_template" -> templateStudioService.createTemplate(wabaId, Map.of(
                    "template_name", args.get("templateName"),
                    "language", args.get("language"),
                    "category", args.get("category"),
                    "components", args.get("components")));
            case "edit_template" -> templateStudioService.editTemplate(wabaId, String.valueOf(args.get("templateId")),
                    Map.of("components", args.get("components")));
            case "list_templates" -> templateStudioService.listTemplates(wabaId, (String) args.get("status"));
            case "send_test_template" -> karixMessagingClient.sendTestTemplate(wabaId, String.valueOf(args.get("templateId")), String.valueOf(args.get("testPhoneNumber")));
            default -> throw new BusinessException("Unknown tool: " + toolName);
        };
    }

    private IrisSession requireOwnedSession(Long sessionId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        if (!sessionRepository.existsByIdAndAccountId(sessionId, accountId)) {
            throw new NotFoundException("Session not found");
        }
        return sessionRepository.findById(sessionId).orElseThrow(() -> new NotFoundException("Session not found"));
    }

    @SneakyThrows
    private String writeJson(Object value) {
        return objectMapper.writeValueAsString(value);
    }

    @SneakyThrows
    @SuppressWarnings("unchecked")
    private Map<String, Object> readJson(String json) {
        return objectMapper.readValue(json, Map.class);
    }
}
