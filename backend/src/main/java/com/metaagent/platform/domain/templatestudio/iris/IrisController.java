package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST surface for Iris — same /api/v1/templates/** prefix as the rest of
 * Template Studio (TEMPLATE_STUDIO module gate applies unchanged).
 */
@RestController
@RequestMapping("/api/v1/templates/iris")
@RequiredArgsConstructor
public class IrisController {

    private final IrisConversationService conversationService;
    private final AiCredentialService aiCredentialService;

    @PostMapping("/sessions")
    public ApiResponse<IrisSession> createSession(@RequestBody CreateSessionRequest request) {
        return ApiResponse.ok(conversationService.createSession(request.wabaId()));
    }

    @GetMapping("/sessions")
    public ApiResponse<java.util.List<IrisConversationService.SessionSummary>> listSessions() {
        return ApiResponse.ok(conversationService.listSessions());
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public ApiResponse<java.util.List<IrisConversationService.MessageDto>> getMessages(@PathVariable Long sessionId) {
        return ApiResponse.ok(conversationService.getMessages(sessionId));
    }

    @PostMapping("/sessions/{sessionId}/messages")
    public ApiResponse<IrisConversationService.TurnResponse> sendMessage(@PathVariable Long sessionId, @Valid @RequestBody SendMessageRequest request) {
        return ApiResponse.ok(conversationService.sendMessage(sessionId, request.text()));
    }

    @PostMapping("/sessions/{sessionId}/confirm")
    public ApiResponse<Map<String, Object>> confirm(@PathVariable Long sessionId) {
        return ApiResponse.ok(conversationService.confirmPendingAction(sessionId));
    }

    @PostMapping("/sessions/{sessionId}/cancel")
    public ApiResponse<Void> cancel(@PathVariable Long sessionId) {
        conversationService.cancelPendingAction(sessionId);
        return ApiResponse.ok();
    }

    @GetMapping("/credential")
    public ApiResponse<AiCredentialService.CredentialStatus> getCredentialStatus() {
        return ApiResponse.ok(aiCredentialService.getStatus());
    }

    @GetMapping("/credential/options")
    public ApiResponse<Map<String, Object>> getCredentialOptions() {
        return ApiResponse.ok(aiCredentialService.listOptions());
    }

    @PutMapping("/credential")
    public ApiResponse<Void> upsertCredential(@Valid @RequestBody UpsertAiCredentialRequest request) {
        aiCredentialService.upsert(request.provider(), request.model(), request.apiKey());
        return ApiResponse.ok();
    }
}
