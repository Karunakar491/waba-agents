package com.metaagent.platform.domain.iris;

import jakarta.validation.constraints.NotBlank;

public record UpsertAiCredentialRequest(
    @NotBlank(message = "provider is required") String provider,
    @NotBlank(message = "model is required") String model,
    @NotBlank(message = "apiKey is required") String apiKey
) {}
