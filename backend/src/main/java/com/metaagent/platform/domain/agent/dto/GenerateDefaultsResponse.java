package com.metaagent.platform.domain.agent.dto;

import java.util.List;

/**
 * Claude-generated wizard defaults for Step 2 (personality) and Step 3 (FAQs).
 * generated=false means Claude was unavailable/slow — UI falls back to manual entry.
 */
public record GenerateDefaultsResponse(
    boolean generated,
    String tone,
    String language,
    String behaviorRules,
    List<FaqPair> faqs
) {
    public record FaqPair(String question, String answer) {}

    public static GenerateDefaultsResponse fallback() {
        return new GenerateDefaultsResponse(false, null, null, null, List.of());
    }
}
