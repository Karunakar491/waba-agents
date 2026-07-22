package com.metaagent.platform.domain.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.dto.GenerateDefaultsResponse;
import com.metaagent.platform.domain.agent.dto.GenerateDefaultsResponse.FaqPair;
import com.metaagent.platform.infrastructure.claude.ClaudeApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Wizard-time only: turns a business description into personality defaults
 * and starter FAQs via Claude (spec section 4, Step 2 auto-generation).
 * Timeouts live on ClaudeApiClient's HTTP layer (5s connect / 10s read);
 * on any failure it returns a fallback so the wizard degrades to manual
 * entry — never blocks agent creation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentDefaultsService {

    private static final String SYSTEM_PROMPT = """
        You generate configuration defaults for a business's customer-service messaging agent.
        Respond with ONLY a JSON object, no markdown fences, matching exactly:
        {
          "tone": "<one of: Friendly, Professional, Casual, Formal>",
          "language": "<primary customer language, e.g. English>",
          "behaviorRules": "<3-5 short rules the agent must follow, one per line>",
          "faqs": [ { "question": "...", "answer": "..." } ]
        }
        Generate exactly 5 FAQ pairs a customer of this business would actually ask.
        Answers must be grounded only in the description — never invent prices, hours, or policies;
        where specifics are unknown, answer generically and suggest contacting the business.
        """;

    private final ClaudeApiClient claudeApiClient;
    private final ObjectMapper objectMapper;

    public GenerateDefaultsResponse generateDefaults(String businessDescription) {
        try {
            return callAndParse(businessDescription);
        } catch (Exception e) {
            log.warn("Wizard defaults generation failed, falling back to manual entry: {}", e.getMessage());
            return GenerateDefaultsResponse.fallback();
        }
    }

    private GenerateDefaultsResponse callAndParse(String businessDescription) {
        String raw = claudeApiClient.generate(SYSTEM_PROMPT, "Business description: " + businessDescription);
        try {
            JsonNode root = objectMapper.readTree(stripFences(raw));
            List<FaqPair> faqs = new ArrayList<>();
            for (JsonNode faq : root.path("faqs")) {
                String q = faq.path("question").asText(null);
                String a = faq.path("answer").asText(null);
                if (q != null && a != null) {
                    faqs.add(new FaqPair(q, a));
                }
            }
            return new GenerateDefaultsResponse(
                true,
                root.path("tone").asText(null),
                root.path("language").asText(null),
                root.path("behaviorRules").asText(null),
                faqs
            );
        } catch (Exception e) {
            throw new IllegalStateException("Claude returned unparseable defaults JSON", e);
        }
    }

    /** Claude sometimes wraps JSON in ```json fences despite instructions. */
    private String stripFences(String raw) {
        String s = raw.trim();
        if (s.startsWith("```")) {
            s = s.substring(s.indexOf('\n') + 1);
            int end = s.lastIndexOf("```");
            if (end >= 0) {
                s = s.substring(0, end);
            }
        }
        return s.trim();
    }
}
