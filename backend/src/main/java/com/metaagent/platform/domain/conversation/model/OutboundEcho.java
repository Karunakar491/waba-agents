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
        String textBody,   // null if the echo has no plain-text body (e.g. a rich/template reply)
        String type,       // Meta's message type: "text", "interactive", "image", …
        String contentJson // the whole message node for anything that is not plain text; null for text
) {
    /** A list, a carousel, a button — something the customer saw that no text body describes. */
    public boolean isRichContent() {
        return contentJson != null && !contentJson.isBlank();
    }
}
