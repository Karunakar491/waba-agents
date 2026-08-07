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
    @NotNull(message = "components is required") @NotEmpty(message = "components must not be empty") List<Map<String, Object>> components,
    Integer codeExpirationMinutes
) {
    public Map<String, Object> toKarixPayload() {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("template_name", templateName);
        payload.put("language", language);
        payload.put("category", category);
        payload.put("components", components);
        if (codeExpirationMinutes != null) {
            payload.put("code_expiration_minutes", codeExpirationMinutes);
        }
        return payload;
    }
}
