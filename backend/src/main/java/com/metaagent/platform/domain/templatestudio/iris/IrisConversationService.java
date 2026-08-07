package com.metaagent.platform.domain.templatestudio.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.templatestudio.EditTemplateRequest;
import com.metaagent.platform.domain.templatestudio.TemplateRequest;
import com.metaagent.platform.domain.templatestudio.TemplateStudioService;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.service.WabaService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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

    private static final String SYSTEM_PROMPT_BASE = """
            You are Iris, the WhatsApp template assistant inside Template Studio. You help create templates, \
            edit templates, list existing templates, send a TEST template to a test number, and discuss \
            marketing copy/strategy for WhatsApp templates. You do nothing else — no bulk sends, no campaigns, \
            no account or settings changes. If asked for something outside this, say plainly that you can't do that here.

            Every tool call requires a wabaId. Here are the WABAs this operator can use:
            %s
            If there is only one, use it without asking. If there are several, ask which one they mean before \
            doing anything — never guess. Once you know which WABA, say its name back in your reply before \
            proposing any action (e.g. "Using WABA \\"Acme Retail\\" — here's the template I'll create") so the \
            operator always sees which WABA an action applies to.

            Meta requires exact values on every template: category must be exactly MARKETING, UTILITY, or \
            AUTHENTICATION (uppercase, no other categories exist) — never a lowercase guess. language must be a \
            Meta locale code like en_US, never a bare language name like "English".""";

    /**
     * A bare {"type":"array"} schema gave the model zero shape guidance —
     * live-tested (2026-08-06) against a real model with that bare schema,
     * it reliably invented Meta's message-SENDING-time component shapes
     * (flat {"type":"image","image":{"link":...}}, one component per
     * button) instead of the correct template-CREATION-time shapes below.
     * Kept terse by design (EM condition) — component essentials only, not
     * a full API reference.
     */
    private static final String COMPONENTS_SCHEMA_DESCRIPTION =
            "Each entry is one Meta template component (creation-time shape, NOT the message-sending shape). " +
            "BODY {type,text} — required, exactly one. If text contains any {{n}} variable placeholder, you MUST also " +
            "include \"example\":{\"body_text\":[[\"<sample value for {{1}}>\",\"<sample for {{2}}>\",...]]} with one " +
            "sample string per placeholder, in order — Karix rejects a template with placeholders and no example block " +
            "(confirmed live 2026-08-07: \"BODY text has placeholders (1) but no example block\"). " +
            "Also: {{n}} must never be the very first or very last thing in the body text — Meta rejects leading/trailing " +
            "variables (confirmed live 2026-08-07: \"Leading or trailing params not allowed\"); always put real words " +
            "before and after every placeholder. " +
            "HEADER {type,format} where format is TEXT/IMAGE/VIDEO/DOCUMENT/LOCATION — optional; no media link needed at creation time. " +
            "FOOTER {type,text} — optional. " +
            "BUTTONS {type,buttons:[...]} — at most ONE such component wrapping ALL buttons in one nested array, " +
            "never one component per button; each entry in that array is {type,text,...} where type is URL/PHONE_NUMBER/QUICK_REPLY/OTP. " +
            "For category AUTHENTICATION specifically, the BUTTONS component's single button MUST be " +
            "{\"type\":\"OTP\",\"otp_type\":\"COPY_CODE\",\"example\":\"<sample one-time code, e.g. 123456>\"} — " +
            "Meta rejects an AUTHENTICATION template missing otp_type or example on the OTP button (PM-caught gap, 2026-08-07 audit).";

    private final IrisSessionRepository sessionRepository;
    private final IrisMessageRepository messageRepository;
    private final AiCredentialService aiCredentialService;
    private final TemplateStudioService templateStudioService;
    private final KarixMessagingClient karixMessagingClient;
    private final WabaService wabaService;
    private final Validator validator;
    private final List<AiProviderAdapter> adapters;
    private final ObjectMapper objectMapper;

    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("create_template", "Create a new WhatsApp template. Requires user confirmation before it is actually submitted. " +
                    "For category AUTHENTICATION specifically, codeExpirationMinutes (1-90) is required by Meta — omit it for every other category.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateName", Map.of("type", "string"),
                            "language", Map.of("type", "string"),
                            "category", Map.of("type", "string"),
                            "components", Map.of("type", "array", "description", COMPONENTS_SCHEMA_DESCRIPTION),
                            "codeExpirationMinutes", Map.of("type", "integer")),
                            "required", List.of("wabaId", "templateName", "language", "category", "components")),
                    true),
            new AiToolSpec("edit_template", "Edit an existing WhatsApp template's components. Requires user confirmation. " +
                    "For an AUTHENTICATION template, codeExpirationMinutes (1-90) is required by Meta — omit it for every other category.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateId", Map.of("type", "string"),
                            "components", Map.of("type", "array", "description", COMPONENTS_SCHEMA_DESCRIPTION),
                            "codeExpirationMinutes", Map.of("type", "integer")),
                            "required", List.of("wabaId", "templateId", "components")),
                    true),
            new AiToolSpec("list_templates", "List existing templates for a WABA, optionally filtered by status. Read-only, runs immediately.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "status", Map.of("type", "string")),
                            "required", List.of("wabaId")),
                    false),
            new AiToolSpec("send_test_template", "Send an approved template to a single test phone number. Requires user confirmation. " +
                    "templateName MUST be the template's name field (e.g. from list_templates), NEVER its numeric fb_template_id — " +
                    "Karix's real send API rejects a numeric id with \"HSM ID does not exist\" (confirmed 2026-08-07 live send test). " +
                    "parameterValues fills the template's positional placeholders in order — for an AUTHENTICATION/OTP template " +
                    "this is the one-time code value that goes into {{1}} and the OTP button.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateName", Map.of("type", "string"),
                            "testPhoneNumber", Map.of("type", "string"),
                            "parameterValues", Map.of("type", "array", "items", Map.of("type", "string"))),
                            "required", List.of("wabaId", "templateName", "testPhoneNumber")),
                    true)
    );

    // sessionId/id as String — TSID values exceed JS Number.MAX_SAFE_INTEGER,
    // same convention as WabaResponse (see WabaDtos.java).
    public record TurnResponse(String sessionId, String reply, boolean needsConfirmation, String pendingToolName, Map<String, Object> pendingToolArgs) {}
    public record SessionSummary(String id, String title, java.time.LocalDateTime updatedAt) {}
    public record MessageDto(String role, String content, java.time.LocalDateTime createdAt) {}
    /**
     * PM-caught gap (2026-08-07 audit, finding C1): resuming a session used
     * to only return its messages, silently dropping any pending
     * confirmation — a user who navigated away mid-confirmation and came
     * back had no way to see or act on it, and the next message they sent
     * hard-failed on the "pending action awaiting confirmation" guard with
     * no visible reason why. Now resuming restores the exact same
     * needsConfirmation/pendingToolName/pendingToolArgs shape sendMessage
     * returns, so the frontend can rehydrate the confirm panel.
     */
    public record SessionResumeResponse(List<MessageDto> messages, boolean needsConfirmation, String pendingToolName, Map<String, Object> pendingToolArgs) {}

    private static final int TITLE_MAX_LENGTH = 120;

    public IrisSession createSession(Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        IrisSession session = IrisSession.builder().accountId(accountId).wabaId(wabaId).build();
        return sessionRepository.save(session);
    }

    public List<SessionSummary> listSessions() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return sessionRepository.findTop50ByAccountIdOrderByUpdatedAtDesc(accountId).stream()
                .map(s -> new SessionSummary(String.valueOf(s.getId()), s.getTitle(), s.getUpdatedAt()))
                .toList();
    }

    public SessionResumeResponse getMessages(Long sessionId) {
        IrisSession session = requireOwnedSession(sessionId);
        List<MessageDto> messages = conversationHistory(sessionId).stream()
                .map(m -> new MessageDto(m.getRole().name(), m.getContent(), m.getCreatedAt()))
                .toList();
        boolean needsConfirmation = session.getPendingToolName() != null;
        Map<String, Object> pendingArgs = needsConfirmation ? readJson(session.getPendingToolArgsJson()) : null;
        return new SessionResumeResponse(messages, needsConfirmation, session.getPendingToolName(), pendingArgs);
    }

    public TurnResponse sendMessage(Long sessionId, String userText) {
        IrisSession session = requireOwnedSession(sessionId);
        if (session.getPendingToolName() != null) {
            throw new BusinessException("There's a pending action awaiting confirmation — confirm or cancel it before continuing.");
        }

        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.USER).content(userText).build());
        if (session.getTitle() == null) {
            session.setTitle(truncateForTitle(userText));
            sessionRepository.save(session);
        }

        AiCredentialService.ResolvedAiCredential cred = aiCredentialService.resolveForConversation();
        AiProviderAdapter adapter = adapters.stream()
                .filter(a -> a.provider().name().equals(cred.provider()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("No adapter available for provider " + cred.provider()));

        List<AiMessage> history = conversationHistory(sessionId).stream()
                .map(m -> new AiMessage(m.getRole() == IrisMessage.Role.USER ? AiMessage.Role.USER : AiMessage.Role.ASSISTANT, m.getContent()))
                .toList();

        List<Waba> accountWabas = wabaService.listForAccount(session.getAccountId());
        String systemPrompt = SYSTEM_PROMPT_BASE.formatted(describeWabas(accountWabas));

        AiTurnResult result = adapter.converse(cred.apiKey(), cred.model(), systemPrompt, history, TOOLS);

        if (result.type() == AiTurnResult.Type.TEXT) {
            messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT).content(result.text()).build());
            return new TurnResponse(String.valueOf(sessionId), result.text(), false, null, null);
        }

        AiToolSpec tool = TOOLS.stream().filter(t -> t.name().equals(result.toolName())).findFirst()
                .orElseThrow(() -> new BusinessException("Iris tried to use a tool that isn't allowed: " + result.toolName()));

        if (!tool.requiresConfirmation()) {
            Map<String, Object> toolResult = executeTool(tool.name(), result.toolArguments(), accountWabas);
            String summary = "Tool " + tool.name() + " result: " + writeJson(toolResult);
            messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.TOOL)
                    .content(summary).toolName(tool.name()).toolArgsJson(writeJson(result.toolArguments())).build());
            return new TurnResponse(String.valueOf(sessionId), summary, false, null, null);
        }

        session.setPendingToolName(tool.name());
        session.setPendingToolArgsJson(writeJson(result.toolArguments()));
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT)
                .content("I've drafted this — review it and confirm to submit.").toolName(tool.name()).toolArgsJson(writeJson(result.toolArguments())).build());

        return new TurnResponse(String.valueOf(sessionId), "I've drafted this — review it and confirm to submit.", true, tool.name(), result.toolArguments());
    }

    public Map<String, Object> confirmPendingAction(Long sessionId) {
        IrisSession session = requireOwnedSession(sessionId);
        if (session.getPendingToolName() == null) {
            throw new BusinessException("There's no pending action to confirm.");
        }
        String toolName = session.getPendingToolName();
        Map<String, Object> args = readJson(session.getPendingToolArgsJson());

        Map<String, Object> result = executeTool(toolName, args, wabaService.listForAccount(session.getAccountId()));

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

    /**
     * Iris resolves wabaId itself from conversation (no upfront picker) —
     * the model supplies it on every tool call. This is the one place ALL
     * tool dispatch passes through, so the account-membership check lives
     * here rather than trusting each downstream service to remember its
     * own (TemplateStudioService/KarixMessagingClient both already check
     * too, but that's defense in depth, not a substitute for this).
     */
    private Map<String, Object> executeTool(String toolName, Map<String, Object> args, List<Waba> accountWabas) {
        Long wabaId = Long.valueOf(String.valueOf(args.get("wabaId")));
        Set<Long> accountWabaIds = accountWabas.stream().map(Waba::getId).collect(Collectors.toSet());
        if (!accountWabaIds.contains(wabaId)) {
            throw new BusinessException("That WABA isn't available on this account.");
        }
        return switch (toolName) {
            // EL-caught gap (2026-08-07 audit): this used to build the raw
            // Karix payload by hand from model output, bypassing the exact
            // @Valid TemplateRequest/EditTemplateRequest validation the
            // human UI path enforces — a model-drafted template could reach
            // Karix with no schema check at all beyond system-prompt prose.
            // Now runs through the SAME validated DTO the controller uses.
            case "create_template" -> {
                TemplateRequest request = new TemplateRequest(
                        String.valueOf(args.get("templateName")),
                        String.valueOf(args.get("language")),
                        String.valueOf(args.get("category")),
                        castComponents(args.get("components")),
                        args.get("codeExpirationMinutes") == null ? null : Integer.valueOf(String.valueOf(args.get("codeExpirationMinutes"))));
                validateOrThrow(request);
                yield templateStudioService.createTemplate(wabaId, request.toKarixPayload());
            }
            case "edit_template" -> {
                EditTemplateRequest request = new EditTemplateRequest(
                        castComponents(args.get("components")),
                        null, null, null,
                        args.get("codeExpirationMinutes") == null ? null : Integer.valueOf(String.valueOf(args.get("codeExpirationMinutes"))));
                validateOrThrow(request);
                yield templateStudioService.editTemplate(wabaId, String.valueOf(args.get("templateId")), request.toKarixPayload());
            }
            case "list_templates" -> templateStudioService.listTemplates(wabaId, (String) args.get("status"));
            case "send_test_template" -> {
                @SuppressWarnings("unchecked")
                List<String> parameterValues = args.get("parameterValues") == null
                        ? List.of()
                        : ((List<Object>) args.get("parameterValues")).stream().map(String::valueOf).toList();
                yield karixMessagingClient.sendTestTemplate(wabaId, String.valueOf(args.get("templateName")), String.valueOf(args.get("testPhoneNumber")), parameterValues);
            }
            default -> throw new BusinessException("Unknown tool: " + toolName);
        };
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castComponents(Object rawComponents) {
        if (!(rawComponents instanceof List<?> list)) {
            throw new BusinessException("components must be a list.");
        }
        return (List<Map<String, Object>>) list;
    }

    private <T> void validateOrThrow(T request) {
        Set<ConstraintViolation<T>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .findFirst()
                    .orElse("Validation failed");
            throw new BusinessException(message);
        }
    }

    private String describeWabas(List<Waba> wabas) {
        if (wabas.isEmpty()) {
            return "(none — this account has no WABAs yet, tell the operator there's nothing to work with)";
        }
        return wabas.stream()
                .map(w -> "- \"%s\" (wabaId: %d)".formatted(w.getLabel(), w.getId()))
                .collect(Collectors.joining("\n"));
    }

    /**
     * USER/ASSISTANT-only, chronological — the single source both the
     * model's history (sendMessage) and the resumable transcript
     * (getMessages) read from, so the two never drift on what counts as
     * displayable conversation vs. internal tool bookkeeping.
     */
    private List<IrisMessage> conversationHistory(Long sessionId) {
        return messageRepository.findAllBySessionIdOrderByCreatedAtAsc(sessionId).stream()
                .filter(m -> m.getRole() != IrisMessage.Role.TOOL)
                .toList();
    }

    private String truncateForTitle(String text) {
        String trimmed = text.trim();
        return trimmed.length() > TITLE_MAX_LENGTH - 3
                ? trimmed.substring(0, TITLE_MAX_LENGTH - 3) + "..."
                : trimmed;
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
