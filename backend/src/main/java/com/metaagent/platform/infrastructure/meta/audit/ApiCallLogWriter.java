package com.metaagent.platform.infrastructure.meta.audit;

import com.metaagent.platform.domain.agent.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Writes one api_call_log row per Meta API call, off the calling thread.
 * Separated into its own bean (not a method on MetaApiClient) so Spring's
 * @Async proxy actually applies — a self-invoked @Async method on the same
 * class silently runs synchronously (same bug class as the @Transactional
 * private-method trap). Never throws back to the caller: a failed audit
 * write must never break the real Meta call it's auditing.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiCallLogWriter {

    private final ApiCallLogRepository repository;
    private final AgentRepository agentRepository;

    // Every phone-scoped MetaApiClient path is "/<phoneNumberId>/..." — the
    // first path segment, always numeric. Not every call is phone-scoped
    // (graphGet's WABA-level paths, e.g. "/{wabaId}/phone_numbers", don't
    // match this and correctly resolve to null).
    private static final Pattern PHONE_NUMBER_ID_PREFIX = Pattern.compile("^/(\\d{5,})(?:/|$|\\?)");

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            Long accountId,
            String method,
            String path,
            Integer statusCode,
            long durationMs,
            Object requestBody,
            Object responseBody,
            String errorMessage
    ) {
        try {
            String phoneNumberId = extractPhoneNumberId(path);
            Long agentId = phoneNumberId != null
                    ? agentRepository.findByPhoneNumberId(phoneNumberId).map(a -> a.getId()).orElse(null)
                    : null;
            repository.save(ApiCallLog.builder()
                    .accountId(accountId)
                    .method(method)
                    .path(path)
                    .statusCode(statusCode)
                    .durationMs(durationMs)
                    .requestBody(ApiCallLogRedactor.toRedactedJson(requestBody))
                    .responseBody(ApiCallLogRedactor.toRedactedJson(responseBody))
                    .errorMessage(errorMessage)
                    .calledAt(LocalDateTime.now())
                    .phoneNumberId(phoneNumberId)
                    .agentId(agentId)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to persist api_call_log row: method={} path={} error={}", method, path, e.getMessage());
        }
    }

    /** Founder-reported gap (2026-08-13): API Calls filter needed phone number + agent id without re-parsing `path` on every request. */
    static String extractPhoneNumberId(String path) {
        if (path == null) return null;
        Matcher m = PHONE_NUMBER_ID_PREFIX.matcher(path);
        return m.find() ? m.group(1) : null;
    }
}
