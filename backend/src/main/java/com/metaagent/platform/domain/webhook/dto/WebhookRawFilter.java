package com.metaagent.platform.domain.webhook.dto;

import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/**
 * Webhooks view filter bar (2026-08-13, founder: "log ALL webhooks... have a
 * filter for webhooks... phone number, agent id etc"). Every field optional.
 *
 * Scope note: includes the caller's own accountId rows AND every row with a
 * null accountId (unattributable payloads — unknown phone_number_id, or
 * failed signature verification, per V50/WebhookController). Those rows
 * belong to no tenant, so excluding them would just recreate the exact
 * "logged but nobody can ever see it" problem this filter exists to fix —
 * any authenticated operator can see them, same as a shared "System" bucket.
 */
public record WebhookRawFilter(
        String phoneNumberId,
        Long agentId,
        WebhookRaw.Status status,
        LocalDateTime from,
        LocalDateTime to
) {
    public static Specification<WebhookRaw> toSpecification(Long accountId, WebhookRawFilter filter) {
        return (root, query, cb) -> {
            var predicates = cb.or(cb.equal(root.get("accountId"), accountId), cb.isNull(root.get("accountId")));

            if (filter.phoneNumberId() != null && !filter.phoneNumberId().isBlank()) {
                predicates = cb.and(predicates, cb.equal(root.get("phoneNumberId"), filter.phoneNumberId()));
            }
            if (filter.agentId() != null) {
                predicates = cb.and(predicates, cb.equal(root.get("agentId"), filter.agentId()));
            }
            if (filter.status() != null) {
                predicates = cb.and(predicates, cb.equal(root.get("status"), filter.status()));
            }
            if (filter.from() != null) {
                predicates = cb.and(predicates, cb.greaterThanOrEqualTo(root.get("receivedAt"), filter.from()));
            }
            if (filter.to() != null) {
                predicates = cb.and(predicates, cb.lessThanOrEqualTo(root.get("receivedAt"), filter.to()));
            }
            return predicates;
        };
    }
}
