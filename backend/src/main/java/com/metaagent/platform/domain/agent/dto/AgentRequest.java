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

    // Figma 8.1 "About" column — short human label, distinct from systemPrompt. Optional.
    @Size(max = 255, message = "About label must be at most 255 characters")
    String aboutLabel,

    @Size(max = 50)
    String tone,

    @Size(max = 50)
    String language,

    @Size(max = 4000, message = "Behavior rules must be at most 4000 characters")
    String behaviorRules,

    // Figma 8.4 — edited sample reply setting the agent's starting style.
    @Size(max = 4000, message = "Starting style must be at most 4000 characters")
    String personaSampleReply,

    boolean handoffEnabled,

    @Size(max = 1000, message = "Handoff message must be at most 1000 characters")
    String handoffMessage
) {}
