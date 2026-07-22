package com.metaagent.platform.domain.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AgentTestRequest(
    @NotBlank(message = "Message is required")
    @Size(max = 1000)
    String userMsg,

    String conversationId  // null on first turn; returned by Meta and passed back for multi-turn
) {}
