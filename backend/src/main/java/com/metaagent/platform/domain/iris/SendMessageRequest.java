package com.metaagent.platform.domain.iris;

import jakarta.validation.constraints.NotBlank;

public record SendMessageRequest(@NotBlank(message = "text is required") String text) {}
