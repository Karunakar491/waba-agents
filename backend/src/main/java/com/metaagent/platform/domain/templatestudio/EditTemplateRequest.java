package com.metaagent.platform.domain.templatestudio;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record EditTemplateRequest(
    @NotNull(message = "components is required") @NotEmpty(message = "components must not be empty") List<Map<String, Object>> components,
    String altTempBody,
    String editAltBody,
    Boolean allowCategoryChange,
    Integer codeExpirationMinutes
) {
    Map<String, Object> toKarixPayload() {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("components", components);
        if (altTempBody != null) payload.put("alt_temp_body", altTempBody);
        if (editAltBody != null) payload.put("edit_alt_body", editAltBody);
        payload.put("allow_category_change", allowCategoryChange != null ? allowCategoryChange : true);
        if (codeExpirationMinutes != null) {
            payload.put("code_expiration_minutes", codeExpirationMinutes);
        }
        return payload;
    }
}
