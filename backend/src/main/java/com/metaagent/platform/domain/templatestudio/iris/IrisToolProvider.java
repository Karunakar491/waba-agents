package com.metaagent.platform.domain.templatestudio.iris;

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
 * plan.md) — {@link TemplateStudioToolProvider} is today's four tools moved
 * here verbatim, zero behavior change. A provider owns its own scoping/
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
}
