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
    Integer codeExpirationMinutes,
    // Named-vs-positional variables (Meta's parameter_format, docs/meta-api/
    // .../location_templates.md, LTO.md) — optional, defaults to Meta's own
    // "positional" default when omitted. Only meaningful at creation; Meta
    // does not allow changing it on edit, so EditTemplateRequest doesn't
    // carry this field.
    String parameterFormat
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
        if (parameterFormat != null) {
            payload.put("parameter_format", parameterFormat);
        }
        return payload;
    }
}
