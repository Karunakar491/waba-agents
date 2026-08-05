package com.metaagent.platform.domain.conversation.model;

/**
 * BizAI's own outbound reply, echoed to us via value.standby.message_echoes[]
 * (docs/meta-api/webhook-standby-handoff.md). Before this existed, outbound
 * messages created from a "sent" status webhook had no text — the reply
 * content is only available through this echo.
 */
public record OutboundEcho(
        String metaMessageId,
        String recipientPhone,
        String textBody   // null if the echo has no plain-text body (e.g. a rich/template reply)
) {}
