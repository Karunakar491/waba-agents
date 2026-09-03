package com.metaagent.platform.domain.webhook.dto;

import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/**
 * Webhooks view filter bar (2026-08-13, founder: "log ALL webhooks... have a
 * filter for webhooks... phone number, agent id etc"). Every field optional.
 *
 * Scope note (2026-08-14, founder correction): strictly the caller's own
 * accountId. Unattributed rows (null accountId — unknown phone_number_id or
 * failed signature verification) are never returned here; a phone number not
 * linked to this account has no business showing up in this account's log.
 */
public record WebhookRawFilter(
        Long id,
        String phoneNumberId,
        Long agentId,
        WebhookRaw.Status status,
        LocalDateTime from,
        LocalDateTime to
) {
    public static Specification<WebhookRaw> toSpecification(Long accountId, WebhookRawFilter filter) {
        return (root, query, cb) -> {
            var predicates = cb.equal(root.get("accountId"), accountId);

            // Message-to-webhook deep link (Inbox thread "jump to webhook" icon) — id
            // alone is sufficient, but still account-scoped above so a message can never
            // leak another account's webhook row through this endpoint.
            if (filter.id() != null) {
                predicates = cb.and(predicates, cb.equal(root.get("id"), filter.id()));
            }
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
