package com.metaagent.platform.domain.conversation.model;

/**
 * Structured representation of a Meta status webhook event (delivered/read/failed/sent).
 * Extracted from value.statuses[0] in the webhook payload.
 */
public record StatusUpdate(
        String metaMessageId,   // id field from statuses[0]
        String status,          // "sent" | "delivered" | "read" | "failed"
        String recipientPhone   // recipient_id from statuses[0]
) {}
