package com.metaagent.platform.domain.webhook.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.webhook.dto.WebhookRawFilter;
import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Founder-caught gap (2026-08-07 audit): no way existed to view logged
 * webhooks from the UI at all, despite them being persisted to webhook_raw
 * on every inbound event (a deliberate reliability pattern — see
 * WebhookController — so a parser crash never loses the raw payload). This
 * is a read-only debug/audit view, account-scoped same as everywhere else
 * (plus unattributable rows — see WebhookRawFilter). Separate from
 * WebhookController (Meta's public, unauthenticated, signature-verified
 * receiver) — this is an authenticated, account-scoped read path, a
 * different trust boundary entirely.
 */
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class WebhookLogController {

    private final WebhookRawRepository webhookRawRepository;

    /** Unfiltered default — matches the founder's "every webhook related to the WABA should be displayed" ask; filters below narrow it further. */
    @GetMapping("/raw")
    public ApiResponse<List<WebhookRaw>> listRecent(
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(required = false) String phoneNumberId,
            @RequestParam(required = false) Long agentId,
            @RequestParam(required = false) WebhookRaw.Status status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        var spec = WebhookRawFilter.toSpecification(accountId, new WebhookRawFilter(phoneNumberId, agentId, status, from, to));
        return ApiResponse.ok(webhookRawRepository.findAll(spec,
                PageRequest.of(0, Math.min(limit, 300), Sort.by("receivedAt").descending())).getContent());
    }
}
