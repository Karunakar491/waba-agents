package com.metaagent.platform.domain.templatestudio.iris;

import jakarta.validation.constraints.NotBlank;

public record SendMessageRequest(@NotBlank(message = "text is required") String text) {}
