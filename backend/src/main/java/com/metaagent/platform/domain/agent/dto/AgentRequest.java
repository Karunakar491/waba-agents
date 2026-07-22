package com.metaagent.platform.domain.agent.dto;

import com.metaagent.platform.domain.agent.entity.Agent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create/update payload for the agent wizard (spec section 4).
 * channel may only be set at creation — service layer rejects changes after.
 */
public record AgentRequest(
    @NotBlank(message = "Agent name is required")
    @Size(max = 40, message = "Agent name must be at most 40 characters")
    String displayName,

    @Size(max = 25, message = "Customer-facing name must be at most 25 characters")
    String customerFacingName,

    Agent.Channel channel,

    // Business description seeds this (wizard caps at 200 chars); settings page allows longer edits
    @Size(max = 4000)
    String systemPrompt,

    @Size(max = 50)
    String tone,

    @Size(max = 50)
    String language,

    @Size(max = 4000, message = "Behavior rules must be at most 4000 characters")
    String behaviorRules
) {}
