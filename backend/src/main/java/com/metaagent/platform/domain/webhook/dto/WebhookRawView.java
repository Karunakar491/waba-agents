package com.metaagent.platform.domain.webhook.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.metaagent.platform.domain.webhook.entity.WebhookRaw;

/**
 * A webhook row plus its handoff classification.
 *
 * Founder ask (2026-09-03): "Human handoff webhook should be highlighted
 * whenever the agent transfers the chat, because we have another tool which
 * will handle live chat." The moment Meta's AI stops handling a conversation
 * and passes it to us is the moment that other tool has to be told — and until
 * now it was invisible in the log, indistinguishable from every routine
 * message webhook.
 *
 * Derived on read rather than stored in a column, deliberately:
 * HandoffClassifier is a pure function of the payload we already persist, so
 * computing it here needs no migration AND classifies the rows already in the
 * table. A stored column would only have described webhooks arriving after the
 * deploy, which is the opposite of useful for someone looking at what just
 * happened.
 *
 * Same @JsonUnwrapped shape as ConversationListItem, so the row keeps its
 * existing JSON and simply gains a field.
 */
public record WebhookRawView(
        @JsonUnwrapped WebhookRaw webhook,
        String handoffSignal
) {
}
