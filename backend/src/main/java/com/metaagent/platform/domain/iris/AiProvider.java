package com.metaagent.platform.domain.iris;

import java.util.List;
import java.util.Map;

/**
 * Closed-set BYOK providers + closed-set models per provider (2026-08-04).
 * "Bring your own key" does NOT mean "bring any provider" — a provider only
 * appears here once we've shipped and tested an AiProviderAdapter for it.
 * Validated server-side on every credential write — never trust the
 * frontend dropdown alone.
 *
 * Do not add a provider to this enum without a matching AiProviderAdapter
 * registered in IrisConversationService — CLAUDE, NVIDIA_LLAMA, and OPENAI
 * all have one now.
 */
public enum AiProvider {
    CLAUDE(List.of("claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022")),
    // Scoped to this exact model family, not "any NVIDIA-hosted model" —
    // same closed-set discipline as CLAUDE's own allowed-models list.
    NVIDIA_LLAMA(List.of("meta/llama-3.3-70b-instruct")),
    // Real api.openai.com only — not Azure OpenAI, not any other
    // OpenAI-compatible host. Closed-set model list, same discipline.
    OPENAI(List.of("gpt-4o", "gpt-4o-mini"));

    private final List<String> allowedModels;

    AiProvider(List<String> allowedModels) {
        this.allowedModels = allowedModels;
    }

    public List<String> allowedModels() {
        return allowedModels;
    }

    public boolean allowsModel(String model) {
        return allowedModels.contains(model);
    }

    public static Map<String, List<String>> allOptions() {
        Map<String, List<String>> options = new java.util.LinkedHashMap<>();
        for (AiProvider p : values()) options.put(p.name(), p.allowedModels());
        return options;
    }
}
