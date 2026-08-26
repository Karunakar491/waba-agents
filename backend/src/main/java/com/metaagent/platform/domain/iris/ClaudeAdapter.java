package com.metaagent.platform.domain.iris;

import com.metaagent.platform.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Claude adapter for Iris's BYOK tool-calling loop — deliberately separate
 * from ClaudeApiClient (that class is wizard-only, platform-key, no tool
 * support, per its own javadoc contract; bending it to also do per-account
 * BYOK tool-calling would be two different contracts on one class). This
 * class calls the Anthropic Messages API directly with a per-call api key
 * and the `tools` param, parsing tool_use blocks into the neutral
 * AiTurnResult shape every other adapter also returns.
 */
@Slf4j
@Component
public class ClaudeAdapter implements AiProviderAdapter {

    private final RestClient restClient;

    public ClaudeAdapter(RestClient.Builder builder,
                          @Value("${claude.api.base-url:https://api.anthropic.com}") String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = builder.requestFactory(requestFactory).baseUrl(baseUrl).build();
    }

    @Override
    public AiProvider provider() {
        return AiProvider.CLAUDE;
    }

    @SuppressWarnings("unchecked")
    @Override
    public AiTurnResult converse(String apiKey, String model, String systemPrompt, List<AiMessage> history, List<AiToolSpec> tools) {
        List<Map<String, String>> messages = history.stream()
                .map(m -> Map.of("role", m.role() == AiMessage.Role.USER ? "user" : "assistant", "content", m.content()))
                .toList();

        List<Map<String, Object>> toolDefs = tools.stream()
                .map(t -> Map.<String, Object>of("name", t.name(), "description", t.description(), "input_schema", t.inputSchema()))
                .toList();

        Map<String, Object> payload = Map.of(
                "model", model,
                "max_tokens", 1024,
                "temperature", 0.7,
                "system", systemPrompt,
                "messages", messages,
                "tools", toolDefs);

        Map<?, ?> response;
        try {
            response = restClient.post()
                    .uri("/v1/messages")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new BusinessException("Claude API error: " + resp.getStatusCode());
                    })
                    .body(Map.class);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Claude API call failed: {}", e.getMessage());
            throw new BusinessException("Could not reach Claude — try again in a moment.");
        }

        List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
        if (content == null || content.isEmpty()) {
            throw new BusinessException("Claude returned no content.");
        }

        for (Map<String, Object> block : content) {
            if ("tool_use".equals(block.get("type"))) {
                return AiTurnResult.toolCall((String) block.get("name"), (Map<String, Object>) block.get("input"));
            }
        }
        // No tool_use block — first text block is the reply.
        for (Map<String, Object> block : content) {
            if ("text".equals(block.get("type"))) {
                return AiTurnResult.text((String) block.get("text"));
            }
        }
        throw new BusinessException("Claude returned an unrecognized response shape.");
    }
}
