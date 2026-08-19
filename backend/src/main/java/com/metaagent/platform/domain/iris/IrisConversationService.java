package com.metaagent.platform.domain.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Iris's generic tool-calling engine. Tools/system-prompt-fragments/
 * execution are supplied by every registered {@link IrisToolProvider} bean
 * (today: only {@link com.metaagent.platform.domain.templatestudio.iris.TemplateStudioToolProvider})
 * — this class owns
 * session/message persistence, the model round-trip, and the confirm-
 * before-submit mechanism, none of which are feature-specific.
 * Extracted 2026-08-12 (see wiki/decisions/2026-08-12-iris-generalization-
 * plan.md, step 1) — pure refactor, byte-identical behavior for the one
 * provider that existed before this change.
 *
 * A tool name the model returns that isn't declared by ANY provider is
 * hard-rejected here, before anything executes — this enforcement lives in
 * code, never trusted to system-prompt instruction alone.
 *
 * Confirm-before-submit: a provider marks a tool requiresConfirmation=true
 * to mean calling it does NOT execute it. Instead the exact args are
 * persisted on the session's pending_tool_* columns and returned to the
 * frontend as a preview; a separate confirm() call replays THOSE persisted
 * args (never a fresh model message) to actually execute. A tool with
 * requiresConfirmation=false executes inline.
 *
 * v1 simplification (intentional, not hidden): after a tool executes, Iris
 * does not do a second full model round-trip using Anthropic's native
 * tool_result protocol — the outcome is appended as a plain message and the
 * next user turn continues naturally with that as context. A true
 * multi-step native tool loop is real complexity deferred past v1; this is
 * simpler and still correct for a request/response, turn-based assistant.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IrisConversationService {

    // Feature-agnostic identity + the confirm-before-submit and attached-
    // image mechanics, which are true of every provider's tools, not just
    // Template Studio's. Provider-specific scope/values guidance is
    // appended per-provider via systemPromptFragment() below.
    private static final String SYSTEM_PROMPT_BASE = """
            You are Iris, an assistant inside this platform. Depending on where you're being used, you help with \
            WhatsApp templates, or with setting up a Business Agent. You do nothing else — no bulk sends, no \
            campaigns, no account or settings changes outside what your available tools cover. If asked for \
            something outside that, say plainly that you can't do that here.

            %s

            Critical: any tool that requires confirmation already shows the operator a preview and a Confirm \
            button automatically the moment you call it — this app does that, not you. Because of that, you must \
            call the tool as soon as you have everything it needs — never describe the action in plain text and \
            ask "shall I proceed?" or "do you want me to do this?" instead of calling it. Asking in prose skips \
            the real confirmation step entirely and nothing gets drafted. If you are missing required information, \
            ask for exactly that missing piece — but once you have it all, call the tool immediately in that same turn.

            If the operator's message contains a line like "[Attached image: <filename> — file_handle: <handle>]", \
            they have already uploaded that image on your behalf — that exact handle is ready to use immediately. \
            Never tell the operator you can't use images, and never ask them to attach it differently — this tag \
            is the only way an image reaches you, and it means the upload already succeeded.""";

    private final IrisSessionRepository sessionRepository;
    private final IrisMessageRepository messageRepository;
    private final AiCredentialService aiCredentialService;
    private final List<AiProviderAdapter> adapters;
    private final List<IrisToolProvider> toolProviders;
    private final ObjectMapper objectMapper;

    // sessionId/id as String — TSID values exceed JS Number.MAX_SAFE_INTEGER,
    // same convention as WabaResponse (see WabaDtos.java).
    public record TurnResponse(String sessionId, String reply, boolean needsConfirmation, String pendingToolName, Map<String, Object> pendingToolArgs) {}
    public record SessionSummary(String id, String title, java.time.LocalDateTime updatedAt) {}
    /**
     * toolName/toolArgs are non-null only for an ASSISTANT message that
     * proposed a create_template/edit_template draft (2026-08-07, Iris
     * redesign phase 2) -- IrisMessage already persisted these columns for
     * every such turn (see sendMessage's pending-confirmation save below),
     * they just weren't surfaced through this DTO. Lets the frontend render
     * an inline WhatsApp-preview snapshot per turn instead of plain text,
     * without any new column or endpoint.
     */
    public record MessageDto(String role, String content, java.time.LocalDateTime createdAt, String toolName, Map<String, Object> toolArgs) {}
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

    private static final String DEFAULT_FEATURE_KEY = "template_studio";

    public IrisSession createSession(Long wabaId, String featureKey) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        String resolvedFeatureKey = (featureKey == null || featureKey.isBlank()) ? DEFAULT_FEATURE_KEY : featureKey;
        IrisSession session = IrisSession.builder().accountId(accountId).wabaId(wabaId).featureKey(resolvedFeatureKey).build();
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
                .map(m -> new MessageDto(m.getRole().name(), m.getContent(), m.getCreatedAt(),
                        m.getToolName(), m.getToolArgsJson() != null ? readJson(m.getToolArgsJson()) : null))
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
        if (cred.usingPlatformDefault()) {
            // EM-required (2026-08-19 platform-default fallback review): no other
            // signal exists to notice runaway usage of the shared default key
            // before an OpenAI bill or rate-limit error surfaces it.
            log.info("Iris turn using platform-default AI key: accountId={}", SecurityContextHelper.getRequiredAccountId());
        }
        AiProviderAdapter adapter = adapters.stream()
                .filter(a -> a.provider().name().equals(cred.provider()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("No adapter available for provider " + cred.provider()));

        List<AiMessage> history = conversationHistory(sessionId).stream()
                .map(m -> new AiMessage(m.getRole() == IrisMessage.Role.USER ? AiMessage.Role.USER : AiMessage.Role.ASSISTANT, m.getContent()))
                .toList();

        List<AiToolSpec> tools = toolProviders.stream().flatMap(p -> p.tools().stream()).toList();
        String fragments = toolProviders.stream().map(p -> p.systemPromptFragment(session.getAccountId())).collect(Collectors.joining("\n\n"));
        String systemPrompt = SYSTEM_PROMPT_BASE.formatted(fragments);

        AiTurnResult result = adapter.converse(cred.apiKey(), cred.model(), systemPrompt, history, tools);
        log.info("sendMessage: sessionId={} provider={} resultType={}", sessionId, cred.provider(), result.type());

        if (result.type() == AiTurnResult.Type.TEXT) {
            String text = appendUnconfirmedActionWarningIfNeeded(result.text());
            messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT).content(text).build());
            return new TurnResponse(String.valueOf(sessionId), text, false, null, null);
        }

        AiToolSpec tool = tools.stream().filter(t -> t.name().equals(result.toolName())).findFirst()
                .orElseThrow(() -> new BusinessException("Iris tried to use a tool that isn't allowed: " + result.toolName()));
        log.info("sendMessage: sessionId={} modelSelectedTool={} requiresConfirmation={}",
                sessionId, tool.name(), tool.requiresConfirmation());
        requireArgsPresent(tool, result.toolArguments());

        if (!tool.requiresConfirmation()) {
            Map<String, Object> toolResult = executeTool(tool.name(), result.toolArguments(), session.getAccountId());
            String summary = summarizeToolResult(tool.name(), toolResult);
            messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.TOOL)
                    .content(summary).toolName(tool.name()).toolArgsJson(writeJson(result.toolArguments())).build());
            log.info("sendMessage: sessionId={} tool={} executed inline, resultKeys={}", sessionId, tool.name(),
                    toolResult != null ? toolResult.keySet() : null);
            return new TurnResponse(String.valueOf(sessionId), summary, false, null, null);
        }

        session.setPendingToolName(tool.name());
        session.setPendingToolArgsJson(writeJson(result.toolArguments()));
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT)
                .content("I've drafted this — review it and confirm to submit.").toolName(tool.name()).toolArgsJson(writeJson(result.toolArguments())).build());
        log.info("sendMessage: sessionId={} tool={} drafted, awaiting confirmation", sessionId, tool.name());

        return new TurnResponse(String.valueOf(sessionId), "I've drafted this — review it and confirm to submit.", true, tool.name(), result.toolArguments());
    }

    public Map<String, Object> confirmPendingAction(Long sessionId) {
        IrisSession session = requireOwnedSession(sessionId);
        if (session.getPendingToolName() == null) {
            throw new BusinessException("There's no pending action to confirm.");
        }
        String toolName = session.getPendingToolName();
        Map<String, Object> args = readJson(session.getPendingToolArgsJson());
        log.info("confirmPendingAction: sessionId={} tool={}", sessionId, toolName);

        Map<String, Object> result = executeTool(toolName, args, session.getAccountId());
        log.info("confirmPendingAction: sessionId={} tool={} executed, resultKeys={}", sessionId, toolName,
                result != null ? result.keySet() : null);

        session.setPendingToolName(null);
        session.setPendingToolArgsJson(null);
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.TOOL)
                .content("Confirmed and executed " + toolName + ": " + writeJson(result)).toolName(toolName).build());

        return result;
    }

    /**
     * 2026-08-19 fix: used to unconditionally insert a "Cancelled — nothing
     * was submitted." message even when there was nothing pending — a no-op
     * call (safe to make defensively, e.g. after aborting a mid-flight send
     * that might or might not have set a pending action server-side) used to
     * leave visible garbage in the conversation history. Now a true no-op
     * when there's nothing to cancel.
     */
    public void cancelPendingAction(Long sessionId) {
        IrisSession session = requireOwnedSession(sessionId);
        if (session.getPendingToolName() == null) {
            return;
        }
        session.setPendingToolName(null);
        session.setPendingToolArgsJson(null);
        sessionRepository.save(session);
        messageRepository.save(IrisMessage.builder().sessionId(sessionId).role(IrisMessage.Role.ASSISTANT)
                .content("Cancelled — nothing was submitted.").build());
    }

    /**
     * Closed set of phrases a model uses when it falsely claims to have
     * already created/sent/submitted something in plain text instead of
     * actually calling the tool (the exact failure the system prompt above
     * already tells it not to do — this is the code-level backstop for when
     * it ignores that anyway, since prompt wording alone isn't enforceable).
     * Deliberately narrow and case-insensitive, not a general sentiment
     * classifier — a false positive here just adds one harmless disclaimer
     * line; a false negative leaves the original silent-confusion bug.
     */
    private static final java.util.regex.Pattern UNCONFIRMED_ACTION_CLAIM = java.util.regex.Pattern.compile(
            "\\b(i'?ve|i have)\\s+(already\\s+)?(created|submitted|sent|drafted and submitted)\\b"
                    + "|\\balready (created|submitted|sent)\\b",
            java.util.regex.Pattern.CASE_INSENSITIVE);

    private String appendUnconfirmedActionWarningIfNeeded(String text) {
        if (!UNCONFIRMED_ACTION_CLAIM.matcher(text).find()) {
            return text;
        }
        log.warn("sendMessage: model claimed an action in plain text with no tool call — appending correction");
        return text + "\n\n⚠️ Nothing has actually been submitted yet — I can only act once you see and confirm a draft, not just from saying so in chat.";
    }

    /**
     * 2026-08-19 fix: a model omitting a required field used to flow through
     * silently as the literal string "null" (String.valueOf(null)) deep
     * inside the provider's request-building code, only failing later —
     * confusingly — in Meta/Karix validation. Checked here, generically,
     * against the tool's own declared "required" list (the same schema the
     * model was given), so every provider gets this for free instead of
     * each one re-implementing its own null check.
     */
    private void requireArgsPresent(AiToolSpec tool, Map<String, Object> args) {
        Object requiredObj = tool.inputSchema().get("required");
        if (!(requiredObj instanceof List<?> required)) {
            return;
        }
        for (Object entry : required) {
            String key = String.valueOf(entry);
            Object value = args.get(key);
            if (value == null || (value instanceof String s && s.isBlank())) {
                throw new BusinessException("Iris tried to use \"" + tool.name() + "\" without \"" + key
                        + "\" — ask for that before proposing this action.");
            }
        }
    }

    private Map<String, Object> executeTool(String toolName, Map<String, Object> args, Long accountId) {
        return ownerOf(toolName).execute(toolName, args, accountId);
    }

    /** Delegates to whichever provider declared the tool — never a raw JSON
     * dump of the result (2026-08-19 fix; see IrisToolProvider.summarizeResult). */
    private String summarizeToolResult(String toolName, Map<String, Object> result) {
        return ownerOf(toolName).summarizeResult(toolName, result);
    }

    private IrisToolProvider ownerOf(String toolName) {
        return toolProviders.stream()
                .filter(p -> p.tools().stream().anyMatch(t -> t.name().equals(toolName)))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Unknown tool: " + toolName));
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
