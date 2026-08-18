package com.metaagent.platform.domain.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * The load-bearing risk this adapter introduces vs ClaudeAdapter: NVIDIA's
 * tool_calls[].function.arguments is a JSON STRING, not an object — a naive
 * copy-paste would silently break on this. No live NVIDIA credential
 * required — MockRestServiceServer stands in for the HTTP boundary.
 */
class NvidiaLlamaAdapterTest {

    private static final List<AiMessage> HISTORY = List.of(new AiMessage(AiMessage.Role.USER, "list my templates"));
    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("list_templates", "list templates", Map.of("type", "object"), false));

    private NvidiaLlamaAdapter buildAdapterWithMockServer(String responseJson, MockRestServiceServer[] serverOut) {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        serverOut[0] = server;
        NvidiaLlamaAdapter adapter = new NvidiaLlamaAdapter(builder.build(), new ObjectMapper());
        server.expect(requestTo("http://localhost/chat/completions"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));
        return adapter;
    }

    @Test
    void should_parse_stringified_tool_call_arguments_into_a_map() {
        String response = """
                {"choices":[{"message":{"tool_calls":[{"function":{"name":"list_templates","arguments":"{\\"wabaId\\":\\"123\\",\\"status\\":\\"APPROVED\\"}"}}]}}]}""";
        NvidiaLlamaAdapter adapter = buildAdapterWithMockServer(response, new MockRestServiceServer[1]);

        AiTurnResult result = adapter.converse("nvapi-test-key", "meta/llama-3.3-70b-instruct", "system prompt", HISTORY, TOOLS);

        assertThat(result.type()).isEqualTo(AiTurnResult.Type.TOOL_CALL);
        assertThat(result.toolName()).isEqualTo("list_templates");
        assertThat(result.toolArguments()).containsEntry("wabaId", "123").containsEntry("status", "APPROVED");
    }

    @Test
    void should_return_text_when_no_tool_calls() {
        String response = """
                {"choices":[{"message":{"content":"Sure, what would you like the template to say?"}}]}""";
        NvidiaLlamaAdapter adapter = buildAdapterWithMockServer(response, new MockRestServiceServer[1]);

        AiTurnResult result = adapter.converse("nvapi-test-key", "meta/llama-3.3-70b-instruct", "system prompt", HISTORY, TOOLS);

        assertThat(result.type()).isEqualTo(AiTurnResult.Type.TEXT);
        assertThat(result.text()).isEqualTo("Sure, what would you like the template to say?");
    }

    @Test
    void should_fail_clearly_on_malformed_arguments_json_rather_than_throw_raw_parse_error() {
        String response = """
                {"choices":[{"message":{"tool_calls":[{"function":{"name":"list_templates","arguments":"not-json"}}]}}]}""";
        NvidiaLlamaAdapter adapter = buildAdapterWithMockServer(response, new MockRestServiceServer[1]);

        assertThatThrownBy(() -> adapter.converse("nvapi-test-key", "meta/llama-3.3-70b-instruct", "system prompt", HISTORY, TOOLS))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("malformed tool-call arguments");
    }

    @Test
    void should_fail_clearly_on_unrecognized_response_shape() {
        String response = """
                {"choices":[{"message":{}}]}""";
        NvidiaLlamaAdapter adapter = buildAdapterWithMockServer(response, new MockRestServiceServer[1]);

        assertThatThrownBy(() -> adapter.converse("nvapi-test-key", "meta/llama-3.3-70b-instruct", "system prompt", HISTORY, TOOLS))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("unrecognized response shape");
    }
}
