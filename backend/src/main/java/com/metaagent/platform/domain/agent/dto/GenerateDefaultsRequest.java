package com.metaagent.platform.domain.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Wizard Step 1 → auto-generation input (spec section 4). */
public record GenerateDefaultsRequest(
    @NotBlank(message = "Business description is required")
    @Size(max = 200, message = "Business description must be at most 200 characters")
    String businessDescription
) {}
