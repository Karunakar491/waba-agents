package com.metaagent.platform.domain.templatestudio.iris;

/** Neutral message representation — never a provider's own wire format. */
public record AiMessage(Role role, String content) {
    public enum Role { USER, ASSISTANT, TOOL }
}
