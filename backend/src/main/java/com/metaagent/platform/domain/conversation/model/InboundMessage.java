package com.metaagent.platform.domain.conversation.model;

/**
 * Structured representation of a customer message extracted from a Meta webhook payload.
 *
 * State table:
 *   text:                        textBody=message text,  messageType="text",  contentJson=null
 *   image/audio/video/document:  textBody=null,          messageType=type,    contentJson=full message node JSON
 *   interactive (interim):       textBody=null,          messageType="text",  contentJson=full message node JSON
 */
public record InboundMessage(
        String customerPhone,
        String metaMessageId,
        String textBody,        // null for non-text types
        String messageType,     // Meta type string: "text" | "image" | "audio" | "video" | "document" | "template"
        String contentJson      // full message node JSON for non-text types; null for text
) {}
