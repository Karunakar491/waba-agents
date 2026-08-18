package com.metaagent.platform.domain.iris;

import com.metaagent.platform.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST surface for Iris — a shared assistant used by both Template Studio
 * and Business Agents (see AgentCreationToolProvider). 2026-08-18: mounted
 * at BOTH /api/v1/iris (the real, permanent path) and /api/v1/templates/iris
 * (kept live so neither frontend caller breaks mid-migration) — see
 * wiki/decisions/2026-08-12-iris-generalization-plan.md. Once both frontend
 * consumers have cut over to /api/v1/iris and a full deprecation window has
 * passed with verified-zero traffic on the old path, delete the old mapping
 * here AND its ModuleAccessFilter special-case. ModuleAccessFilter accepts
 * either TEMPLATE_STUDIO or BUSINESS_AGENTS for BOTH paths — they must stay
 * in lockstep until the old path is removed (see ModuleAccessFilterTest's
 * dual-path pinning test).
 */
@RestController
@RequestMapping({IrisPaths.NEW_PREFIX, IrisPaths.LEGACY_PREFIX})
@RequiredArgsConstructor
public class IrisController {

    private final IrisConversationService conversationService;
    private final AiCredentialService aiCredentialService;

    @PostMapping("/sessions")
    public ApiResponse<IrisSession> createSession(@RequestBody CreateSessionRequest request) {
        return ApiResponse.ok(conversationService.createSession(request.wabaId(), request.featureKey()));
    }

    @GetMapping("/sessions")
    public ApiResponse<java.util.List<IrisConversationService.SessionSummary>> listSessions() {
        return ApiResponse.ok(conversationService.listSessions());
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public ApiResponse<IrisConversationService.SessionResumeResponse> getMessages(@PathVariable Long sessionId) {
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
