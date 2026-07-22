package com.metaagent.platform.domain.agent.dto;

import jakarta.validation.constraints.NotBlank;
import org.hibernate.validator.constraints.URL;

public record WebsiteRequest(
    @NotBlank(message = "URL is required")
    @URL(message = "Invalid URL format")
    String url
) {}
