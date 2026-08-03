package com.metaagent.platform.domain.agent.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Pattern;

public record AudienceRequest(
    @JsonProperty("ai_audience")
    @Pattern(regexp = "EVERYONE|ALLOWLISTED_ONLY", message = "ai_audience must be EVERYONE or ALLOWLISTED_ONLY")
    String aiAudience
) {}
