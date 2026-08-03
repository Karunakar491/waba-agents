package com.metaagent.platform.domain.templatestudio;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MapExistingEsmeRequest(
    @NotBlank(message = "phoneNumberId is required") String phoneNumberId,
    @NotNull(message = "esmeCredentialId is required") Long esmeCredentialId
) {}
