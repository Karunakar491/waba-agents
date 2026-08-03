package com.metaagent.platform.domain.templatestudio;

import jakarta.validation.constraints.NotBlank;

public record MapNewEsmeRequest(
    @NotBlank(message = "phoneNumberId is required") String phoneNumberId,
    @NotBlank(message = "esmeAddr is required") String esmeAddr,
    @NotBlank(message = "label is required") String label,
    @NotBlank(message = "apiKey is required") String apiKey
) {}
