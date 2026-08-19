package com.metaagent.platform.domain.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * 2026-08-19: covers the new usage-token parsing this adapter now does (see
 * AiTurnResult.totalTokens), feeding AiCredentialService's daily-budget
 * mini-tier switch — a malformed/missing usage block must never crash the
 * turn, just yield a null totalTokens.
 */
class OpenAiAdapterTest {

    private static final List<AiMessage> HISTORY = List.of(new AiMessage(AiMessage.Role.USER, "list my templates"));
    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("list_templates", "list templates", Map.of("type", "object"), false));

    private OpenAiAdapter buildAdapterWithMockServer(String responseJson) {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OpenAiAdapter adapter = new OpenAiAdapter(builder.build(), new ObjectMapper());
        server.expect(requestTo("http://localhost/chat/completions"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));
        return adapter;
    }

    @Test
    void should_capture_total_tokens_from_a_text_response() {
        String response = """
                {"choices":[{"message":{"content":"Sure, what would you like the template to say?"}}],"usage":{"prompt_tokens":120,"completion_tokens":18,"total_tokens":138}}""";
        OpenAiAdapter adapter = buildAdapterWithMockServer(response);

        AiTurnResult result = adapter.converse("sk-test-key", "gpt-5.4-mini", "system prompt", HISTORY, TOOLS);

        assertThat(result.type()).isEqualTo(AiTurnResult.Type.TEXT);
        assertThat(result.totalTokens()).isEqualTo(138);
    }

    @Test
    void should_capture_total_tokens_from_a_tool_call_response() {
        String response = """
                {"choices":[{"message":{"tool_calls":[{"function":{"name":"list_templates","arguments":"{\\"wabaId\\":\\"123\\"}"}}]}}],"usage":{"total_tokens":204}}""";
        OpenAiAdapter adapter = buildAdapterWithMockServer(response);

        AiTurnResult result = adapter.converse("sk-test-key", "gpt-5.4-mini", "system prompt", HISTORY, TOOLS);

        assertThat(result.type()).isEqualTo(AiTurnResult.Type.TOOL_CALL);
        assertThat(result.totalTokens()).isEqualTo(204);
    }

    @Test
    void should_return_null_total_tokens_when_usage_block_is_missing_rather_than_crash() {
        String response = """
                {"choices":[{"message":{"content":"Hi there!"}}]}""";
        OpenAiAdapter adapter = buildAdapterWithMockServer(response);

        AiTurnResult result = adapter.converse("sk-test-key", "gpt-5.4-mini", "system prompt", HISTORY, TOOLS);

        assertThat(result.totalTokens()).isNull();
    }
}
