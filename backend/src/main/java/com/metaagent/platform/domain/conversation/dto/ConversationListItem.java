package com.metaagent.platform.domain.conversation.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.metaagent.platform.domain.conversation.entity.Conversation;

/**
 * Conversations list response (founder-reported gap, 2026-08-13): with 7-8
 * phone numbers live on one account, the Inbox conversation list gave no way
 * to tell which business number a customer actually messaged — only
 * Conversation.agentId, which isn't human-readable and isn't even the
 * number. displayPhoneNumber/agentDisplayName are resolved via the owning
 * agent (Conversation has no phone number of its own — it's stable per
 * agent, since a bound phone doesn't change agent ownership day to day).
 * Both best-effort null if the agent was deleted or the number never synced.
 */
public record ConversationListItem(
        @JsonUnwrapped Conversation conversation,
        String displayPhoneNumber,
        String agentDisplayName
) {
}
