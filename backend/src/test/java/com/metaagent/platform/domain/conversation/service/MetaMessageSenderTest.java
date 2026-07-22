package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MetaMessageSenderTest {

    @Mock
    MetaApiClient metaApiClient;

    @InjectMocks
    MetaMessageSender sender;

    // ------------------------------------------------------------------
    // Tests
    // ------------------------------------------------------------------

    @Test
    void should_return_meta_message_id_when_send_succeeds() {
        Map<String, Object> apiResponse = Map.of(
                "messages", List.of(Map.of("id", "wamid.xyz"))
        );
        when(metaApiClient.post(anyString(), any(), eq(Map.class)))
                .thenReturn(apiResponse);

        String result = sender.send("111", "919876543210", "Hi there");

        assertEquals("wamid.xyz", result);
    }

    @Test
    void should_throw_business_exception_when_meta_returns_no_message_id() {
        // Response has an empty messages list — no ID to extract.
        Map<String, Object> emptyMessages = Map.of("messages", List.of());
        when(metaApiClient.post(anyString(), any(), eq(Map.class)))
                .thenReturn(emptyMessages);

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> sender.send("111", "919876543210", "Hi")
        );
        assertTrue(
                ex.getMessage().contains("no message ID"),
                "Expected exception message to mention 'no message ID', got: " + ex.getMessage()
        );
    }

    @Test
    void should_throw_business_exception_when_meta_api_throws() {
        when(metaApiClient.post(anyString(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("connection refused"));

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> sender.send("111", "919876543210", "Hi")
        );
        assertTrue(
                ex.getMessage().contains("connection refused"),
                "Expected wrapped exception message to contain original cause, got: " + ex.getMessage()
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void should_build_correct_whatsapp_payload() {
        // Capture the payload map that is passed to metaApiClient.post.
        Map<String, Object> apiResponse = Map.of(
                "messages", List.of(Map.of("id", "wamid.chk001"))
        );
        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        when(metaApiClient.post(anyString(), payloadCaptor.capture(), eq(Map.class)))
                .thenReturn(apiResponse);

        sender.send("222", "919000000001", "Test message");

        Map<String, Object> captured = (Map<String, Object>) payloadCaptor.getValue();

        assertEquals("whatsapp", captured.get("messaging_product"),
                "messaging_product must be 'whatsapp'");
        assertEquals("text", captured.get("type"),
                "type must be 'text'");
        assertEquals("919000000001", captured.get("to"),
                "to must match the recipient phone number");

        // Verify the nested text body is also present.
        Object textNode = captured.get("text");
        assertNotNull(textNode, "text node must be present in payload");
        Map<String, Object> textMap = (Map<String, Object>) textNode;
        assertEquals("Test message", textMap.get("body"),
                "text.body must match the message text");
    }
}
