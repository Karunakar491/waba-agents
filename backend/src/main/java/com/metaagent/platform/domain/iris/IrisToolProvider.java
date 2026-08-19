package com.metaagent.platform.domain.iris;

import java.util.List;
import java.util.Map;

/**
 * One feature's contribution to Iris's tool-calling loop — its tools, the
 * system-prompt fragment describing them, and how to actually execute one.
 * {@link IrisConversationService} asks every registered provider for its
 * tools/fragment and combines them, so adding a second Iris use case (e.g.
 * Business Agent creation) never means touching the generic engine.
 *
 * Extracted 2026-08-12 (see wiki/decisions/2026-08-12-iris-generalization-
 * plan.md) — {@link com.metaagent.platform.domain.templatestudio.iris.TemplateStudioToolProvider}
 * is today's four tools moved here verbatim, zero behavior change. A provider owns its own scoping/
 * access checks inside execute() — the engine has no opinion on what a
 * provider's args mean (wabaId, agentId, or anything else).
 */
public interface IrisToolProvider {

    /** Combined tools from every provider must have unique names across the whole set. */
    List<AiToolSpec> tools();

    /** Appended into the base system prompt — e.g. the operator's available WABAs. */
    String systemPromptFragment(Long accountId);

    /** Only called for a tool name this provider actually declared in tools(). */
    Map<String, Object> execute(String toolName, Map<String, Object> args, Long accountId);

    /**
     * Turns a non-mutating tool's raw result into what the chat actually
     * shows the operator (2026-08-19) — the engine has no domain knowledge to
     * summarize this itself, so it asks the provider that owns the tool.
     * Only called for tools with requiresConfirmation=false, since a
     * mutating tool's result is never shown directly (its confirm/execute
     * flow already tells its own story). Default falls back to "Done." for
     * providers that haven't implemented a specific summary yet — never a
     * raw JSON dump, which is unreadable and was the exact bug this fixes.
     */
    default String summarizeResult(String toolName, Map<String, Object> result) {
        return "Done.";
    }
}
