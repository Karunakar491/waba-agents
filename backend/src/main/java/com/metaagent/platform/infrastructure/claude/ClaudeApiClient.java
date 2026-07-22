package com.metaagent.platform.infrastructure.claude;

import com.metaagent.platform.common.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;

@Slf4j
@Component
public class ClaudeApiClient {

    private final RestClient restClient;
    private final String model;
    private final String apiKey;

    public ClaudeApiClient(
            RestClient.Builder builder,
            @Value("${claude.api.base-url:https://api.anthropic.com}") String baseUrl,
            @Value("${claude.api.key}") String apiKey,
            @Value("${claude.api.model:claude-3-5-sonnet-20241022}") String model
    ) {
        this.apiKey = apiKey;
        // Hard timeouts: a hung Anthropic connection must never block a request
        // thread indefinitely — the wizard falls back to manual entry instead.
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = builder
                .requestFactory(requestFactory)
                .baseUrl(baseUrl)
                .defaultHeader("x-api-key", apiKey)
                .defaultHeader("anthropic-version", "2023-06-01")
                .defaultHeader("content-type", "application/json")
                .build();
        this.model = model;
    }

    @PostConstruct
    public void validateApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("claude.api.key must be set — application cannot start without a valid Claude API key");
        }
    }

    /**
     * Wizard use only: given a business description, ask Claude to generate
     * agent personality defaults and starter FAQs for Step 1 auto-generation.
     * Never call this in the message pipeline — Meta's AI handles customer replies.
     */
    public String generate(String systemPrompt, String userPrompt) {
        return callClaude(systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
    }

    private String generateReply(String systemPrompt, List<Map<String, String>> messages) {
        return callClaude(systemPrompt, messages);
    }

    private String callClaude(String systemPrompt, List<Map<String, String>> messages) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("max_tokens", 1024);
        payload.put("system", systemPrompt);
        payload.put("messages", messages);

        try {
            Map<?, ?> response = restClient.post()
                    .uri("/v1/messages")
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new BusinessException("Claude API error: " + resp.getStatusCode());
                    })
                    .body(Map.class);

            if (response != null && response.get("content") instanceof List) {
                List<?> contentList = (List<?>) response.get("content");
                if (!contentList.isEmpty() && contentList.get(0) instanceof Map) {
                    Map<?, ?> contentMap = (Map<?, ?>) contentList.get(0);
                    return (String) contentMap.get("text");
                }
            }
            throw new BusinessException("Claude API returned empty content");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Claude API call failed: {}", e.getMessage());
            throw new BusinessException("Claude API invocation failed: " + e.getMessage());
        }
    }
}
