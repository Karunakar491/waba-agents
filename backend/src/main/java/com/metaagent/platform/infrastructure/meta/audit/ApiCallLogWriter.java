package com.metaagent.platform.infrastructure.meta.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

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
                    .build());
        } catch (Exception e) {
            log.warn("Failed to persist api_call_log row: method={} path={} error={}", method, path, e.getMessage());
        }
    }
}
