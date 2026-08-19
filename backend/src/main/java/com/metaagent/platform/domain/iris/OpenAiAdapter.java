package com.metaagent.platform.domain.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * OpenAI adapter (real api.openai.com, gpt-4o/gpt-4o-mini only) — same
 * OpenAI-compatible wire format NvidiaLlamaAdapter already speaks (this is
 * the actual OpenAI API that format was modeled on): request "tools" as
 * {type:"function", function:{name,description,parameters}}, response
 * choices[0].message.tool_calls[].function.arguments is a JSON STRING that
 * must be parsed.
 *
 * A plain-text turn returns tool_calls as null or an absent key, never an
 * empty-but-present list to rely on — checked explicitly below rather than
 * assumed, since trusting "non-null implies non-empty" here would NPE on
 * the first plain-text reply.
 */
@Slf4j
@Component
public class OpenAiAdapter implements AiProviderAdapter {

    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Autowired
    public OpenAiAdapter(RestClient.Builder builder, ObjectMapper objectMapper,
                          @Value("${openai.api.base-url:https://api.openai.com/v1}") String baseUrl) {
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = builder.requestFactory(requestFactory).baseUrl(baseUrl).build();
    }

    /** Test-only — accepts a pre-built RestClient (e.g. bound to MockRestServiceServer). */
    OpenAiAdapter(RestClient restClient, ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public AiProvider provider() {
        return AiProvider.OPENAI;
    }

    @SuppressWarnings("unchecked")
    @Override
    public AiTurnResult converse(String apiKey, String model, String systemPrompt, List<AiMessage> history, List<AiToolSpec> tools) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        for (AiMessage m : history) {
            messages.add(Map.of("role", m.role() == AiMessage.Role.USER ? "user" : "assistant", "content", m.content()));
        }

        List<Map<String, Object>> toolDefs = tools.stream()
                .map(t -> Map.<String, Object>of("type", "function", "function", Map.of(
                        "name", t.name(), "description", t.description(), "parameters", t.inputSchema())))
                .toList();

        Map<String, Object> payload = Map.of(
                "model", model,
                "messages", messages,
                "tools", toolDefs,
                "temperature", 0.2,
                "max_tokens", 1024);

        Map<?, ?> response;
        try {
            response = restClient.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new BusinessException("OpenAI API error: " + resp.getStatusCode());
                    })
                    .body(Map.class);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("OpenAI API call failed ({}): {}", e.getClass().getSimpleName(), e.getMessage(), e);
            throw new BusinessException("Could not reach OpenAI's endpoint — try again in a moment.");
        }

        if (response == null) {
            throw new BusinessException("OpenAI returned an empty response.");
        }
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new BusinessException("OpenAI returned no choices.");
        }
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) {
            throw new BusinessException("OpenAI returned an unrecognized response shape.");
        }

        Integer totalTokens = extractTotalTokens(response);

        List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) message.get("tool_calls");
        if (toolCalls != null && !toolCalls.isEmpty()) {
            Map<String, Object> function = (Map<String, Object>) toolCalls.get(0).get("function");
            String name = (String) function.get("name");
            String argumentsJson = (String) function.get("arguments");
            Map<String, Object> arguments;
            try {
                arguments = objectMapper.readValue(argumentsJson, Map.class);
            } catch (Exception e) {
                throw new BusinessException("OpenAI returned malformed tool-call arguments.");
            }
            return AiTurnResult.toolCall(name, arguments, totalTokens);
        }

        Object content = message.get("content");
        if (content instanceof String text && !text.isBlank()) {
            return AiTurnResult.text(text, totalTokens);
        }
        throw new BusinessException("OpenAI returned an unrecognized response shape.");
    }

    /** Null if the shape is ever missing/unexpected — the daily-budget tier switch treats a
     * null totalTokens as "don't count this turn" rather than crashing on a malformed usage block. */
    private Integer extractTotalTokens(Map<?, ?> response) {
        Object usage = response.get("usage");
        if (!(usage instanceof Map<?, ?> usageMap)) return null;
        Object total = usageMap.get("total_tokens");
        return total instanceof Number n ? n.intValue() : null;
    }
}
