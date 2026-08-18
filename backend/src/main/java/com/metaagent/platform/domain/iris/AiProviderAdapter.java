package com.metaagent.platform.domain.iris;

import java.util.List;

/**
 * One small adapter per BYOK provider, translating between Iris's neutral
 * message/tool representation and that provider's own wire format (Claude's
 * tool_use blocks vs OpenAI's function-calls, etc.). Everything else in
 * Iris — the tool allowlist, the confirm-before-submit loop, the tool
 * implementations themselves — is 100% identical regardless of which
 * adapter is active. Adding a provider means writing and testing one of
 * these, never touching the loop.
 */
public interface AiProviderAdapter {
    AiProvider provider();

    AiTurnResult converse(String apiKey, String model, String systemPrompt, List<AiMessage> history, List<AiToolSpec> tools);
}
