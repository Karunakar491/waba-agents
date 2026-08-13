package com.metaagent.platform.infrastructure.meta.audit;

import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/**
 * Reports > API Calls filter bar (2026-08-13, founder-reported gap: the log
 * had no way to isolate anything from routine GlobalSyncScheduler polling
 * noise — connector-creation failures from hours earlier were real rows,
 * just buried past the most-recent-200 window with no way to search for
 * them). All fields optional/nullable — an unset field is not filtered on.
 */
public record ApiCallLogFilter(
        String method,
        String pathContains,
        String phoneNumberId,
        Long agentId,
        Outcome outcome,
        LocalDateTime from,
        LocalDateTime to
) {
    public enum Outcome { ALL, SUCCESS, ERROR }

    public static Specification<ApiCallLog> toSpecification(Long accountId, ApiCallLogFilter filter) {
        return (root, query, cb) -> {
            var predicates = cb.conjunction();
            predicates = cb.and(predicates, cb.equal(root.get("accountId"), accountId));

            if (filter.method() != null && !filter.method().isBlank()) {
                predicates = cb.and(predicates, cb.equal(cb.upper(root.get("method")), filter.method().toUpperCase()));
            }
            if (filter.pathContains() != null && !filter.pathContains().isBlank()) {
                predicates = cb.and(predicates,
                        cb.like(cb.lower(root.get("path")), "%" + filter.pathContains().toLowerCase() + "%"));
            }
            if (filter.phoneNumberId() != null && !filter.phoneNumberId().isBlank()) {
                predicates = cb.and(predicates, cb.equal(root.get("phoneNumberId"), filter.phoneNumberId()));
            }
            if (filter.agentId() != null) {
                predicates = cb.and(predicates, cb.equal(root.get("agentId"), filter.agentId()));
            }
            if (filter.outcome() == Outcome.SUCCESS) {
                predicates = cb.and(predicates, cb.lessThan(root.get("statusCode"), 400));
            } else if (filter.outcome() == Outcome.ERROR) {
                // A null statusCode (request never got a response — timeout, connection
                // refused) is itself a real failure, not a routine "not an error yet" —
                // treat it as an error, not exclude it from an error-only filter.
                predicates = cb.and(predicates, cb.or(
                        cb.isNull(root.get("statusCode")),
                        cb.greaterThanOrEqualTo(root.get("statusCode"), 400)));
            }
            if (filter.from() != null) {
                predicates = cb.and(predicates, cb.greaterThanOrEqualTo(root.get("calledAt"), filter.from()));
            }
            if (filter.to() != null) {
                predicates = cb.and(predicates, cb.lessThanOrEqualTo(root.get("calledAt"), filter.to()));
            }
            return predicates;
        };
    }
}
