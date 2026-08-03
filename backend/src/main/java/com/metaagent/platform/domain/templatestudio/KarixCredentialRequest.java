package com.metaagent.platform.domain.templatestudio;

import jakarta.validation.constraints.NotBlank;

public record KarixCredentialRequest(
    @NotBlank(message = "esmeAddr is required") String esmeAddr,
    @NotBlank(message = "apiKey is required") String apiKey
) {}
