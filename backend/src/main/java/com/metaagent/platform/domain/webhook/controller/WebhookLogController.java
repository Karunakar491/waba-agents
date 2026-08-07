package com.metaagent.platform.domain.webhook.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Founder-caught gap (2026-08-07 audit): no way existed to view logged
 * webhooks from the UI at all, despite them being persisted to webhook_raw
 * on every inbound event (a deliberate reliability pattern — see
 * WebhookController — so a parser crash never loses the raw payload). This
 * is a read-only debug/audit view, capped at 100 most recent, account-scoped
 * same as everywhere else. Separate from WebhookController (Meta's public,
 * unauthenticated, signature-verified receiver) — this is an authenticated,
 * account-scoped read path, a different trust boundary entirely.
 */
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class WebhookLogController {

    private final WebhookRawRepository webhookRawRepository;

    @GetMapping("/raw")
    public ApiResponse<List<WebhookRaw>> listRecent() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(webhookRawRepository.findTop100ByAccountIdOrderByReceivedAtDesc(accountId));
    }
}
