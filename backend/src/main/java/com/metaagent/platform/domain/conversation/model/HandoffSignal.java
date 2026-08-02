package com.metaagent.platform.domain.conversation.model;

/**
 * Classification of a webhook payload's standby/handoff shape.
 * See docs/meta-api/webhook-standby-handoff.md for the observed payload shapes this maps to.
 */
public enum HandoffSignal {
    BIZAI_ACTIVE,   // value.standby present — Meta's AI is handling this conversation, observe only
    NEEDS_HUMAN,    // top-level value.messages present, no value.standby, no value.statuses — handoff moment
    STATUS_UPDATE,  // value.statuses present — normal delivery receipt, unrelated to handoff
    UNRECOGNIZED    // none of the above shapes matched
}
