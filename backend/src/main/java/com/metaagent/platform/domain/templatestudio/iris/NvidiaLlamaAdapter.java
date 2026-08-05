package com.metaagent.platform.domain.templatestudio.iris;

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
 * NVIDIA NIM adapter (meta/llama-3.3-70b-instruct) — OpenAI-compatible wire
 * format, but a distinct provider from a real future OpenAI adapter (own
 * base_url, own model catalog, own reliability profile). Tool-calling shape
 * differs from Claude's: request "tools" carries {type:"function",
 * function:{name,description,parameters}}, and the response's
 * tool_calls[].function.arguments is a JSON STRING, not an object like
 * Claude's `input` — must be parsed, this is the one place a naive
 * copy-paste from ClaudeAdapter would silently break.
 *
 * Open-model tool-calling has a documented higher malformed-call rate than
 * Claude's (EM note, 2026-08-04) — an unrecognized response shape fails
 * with a clear BusinessException, same as ClaudeAdapter, never a raw NPE.
 */
@Slf4j
@Component
public class NvidiaLlamaAdapter implements AiProviderAdapter {

    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Autowired
    public NvidiaLlamaAdapter(RestClient.Builder builder, ObjectMapper objectMapper,
                               @Value("${nvidia.api.base-url:https://integrate.api.nvidia.com/v1}") String baseUrl) {
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        // 70B model behind a shared NIM endpoint can genuinely take >30s on a
        // cold or loaded backend — 30s was tight enough to read as "could not
        // reach the endpoint" when it was actually just slow. 60s is Claude's
        // own effective ceiling for a tool-calling turn; matches that.
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = builder.requestFactory(requestFactory).baseUrl(baseUrl).build();
    }

    /** Test-only — accepts a pre-built RestClient (e.g. bound to MockRestServiceServer)
     * without this class's own requestFactory override clobbering the mock's wiring. */
    NvidiaLlamaAdapter(RestClient restClient, ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public AiProvider provider() {
        return AiProvider.NVIDIA_LLAMA;
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
                "top_p", 0.7,
                "max_tokens", 1024,
                "stream", false);

        Map<?, ?> response;
        try {
            response = restClient.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new BusinessException("NVIDIA API error: " + resp.getStatusCode());
                    })
                    .body(Map.class);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            // Logged with class + stack trace, not just getMessage() — the
            // prior version collapsed timeout/SSL/DNS failures into one
            // unhelpful log line, making a real production failure (reported
            // 2026-08-06) undiagnosable after the fact.
            log.error("NVIDIA API call failed ({}): {}", e.getClass().getSimpleName(), e.getMessage(), e);
            throw new BusinessException("Could not reach NVIDIA's endpoint — try again in a moment.");
        }

        if (response == null) {
            throw new BusinessException("NVIDIA returned an empty response.");
        }
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new BusinessException("NVIDIA returned no choices.");
        }
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) {
            throw new BusinessException("NVIDIA returned an unrecognized response shape.");
        }

        List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) message.get("tool_calls");
        if (toolCalls != null && !toolCalls.isEmpty()) {
            Map<String, Object> function = (Map<String, Object>) toolCalls.get(0).get("function");
            String name = (String) function.get("name");
            String argumentsJson = (String) function.get("arguments");
            Map<String, Object> arguments;
            try {
                arguments = objectMapper.readValue(argumentsJson, Map.class);
            } catch (Exception e) {
                throw new BusinessException("NVIDIA returned malformed tool-call arguments.");
            }
            return AiTurnResult.toolCall(name, arguments);
        }

        Object content = message.get("content");
        if (content instanceof String text && !text.isBlank()) {
            return AiTurnResult.text(text);
        }
        throw new BusinessException("NVIDIA returned an unrecognized response shape.");
    }
}
