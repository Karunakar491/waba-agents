package com.metaagent.platform.domain.templatestudio;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record TemplateRequest(
    @NotBlank(message = "template_name is required") String templateName,
    @NotBlank(message = "language is required") String language,
    @NotBlank(message = "category is required") String category,
    @NotNull(message = "components is required") @NotEmpty(message = "components must not be empty") List<Map<String, Object>> components
) {
    Map<String, Object> toKarixPayload() {
        return Map.of(
                "template_name", templateName,
                "language", language,
                "category", category,
                "components", components);
    }
}
