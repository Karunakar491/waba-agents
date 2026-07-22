package com.metaagent.platform.domain.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FaqRequest(
    @NotBlank(message = "Question is required")
    @Size(max = 512)
    String question,

    @NotBlank(message = "Answer is required")
    String answer
) {}
