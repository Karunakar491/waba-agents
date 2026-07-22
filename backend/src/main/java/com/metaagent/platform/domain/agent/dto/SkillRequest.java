package com.metaagent.platform.domain.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SkillRequest(
    @NotBlank(message = "Title is required")
    @Size(max = 64)
    String title,

    @NotBlank(message = "Description is required")
    @Size(max = 1024)
    String description,

    @NotBlank(message = "Body is required")
    @Size(max = 20000, message = "Body cannot exceed 20,000 characters")
    String body
) {}
