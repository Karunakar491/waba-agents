package com.metaagent.platform.domain.templatestudio.iris;

import java.util.List;
import java.util.Map;

/**
 * Closed-set BYOK providers + closed-set models per provider (2026-08-04).
 * "Bring your own key" does NOT mean "bring any provider" — a provider only
 * appears here once we've shipped and tested an AiProviderAdapter for it.
 * Validated server-side on every credential write — never trust the
 * frontend dropdown alone.
 *
 * CLAUDE only for v1 — OPENAI is a deliberate P1 addition (its own adapter,
 * its own test pass) per the approved build order, not added here until
 * that adapter actually exists. Do not add a provider to this enum without
 * a matching AiProviderAdapter registered in IrisConversationService.
 */
public enum AiProvider {
    CLAUDE(List.of("claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"));

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
