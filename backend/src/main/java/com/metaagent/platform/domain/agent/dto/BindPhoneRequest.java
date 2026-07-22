package com.metaagent.platform.domain.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BindPhoneRequest(
    @NotBlank(message = "Phone number ID is required")
    @Size(max = 64)
    String phoneNumberId,

    @NotNull(message = "WABA is required")
    Long wabaId
) {}
