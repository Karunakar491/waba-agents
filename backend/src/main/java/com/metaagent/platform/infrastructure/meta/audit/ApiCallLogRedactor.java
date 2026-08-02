package com.metaagent.platform.infrastructure.meta.audit;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Redacts secret-shaped fields (connector API keys, OAuth client secrets,
 * bearer tokens, passwords) from a request/response body before it's
 * persisted to api_call_log. The Meta bearer token itself is never part of
 * any body we serialize — MetaApiClient sets it as a default header, not a
 * per-request payload field — so this only needs to catch what callers
 * (mainly connector creation) put in POST/PUT bodies.
 *
 * Allowlist-style key matching, not blanket blackout: only fields whose name
 * looks like a secret are masked, everything else in the body stays visible
 * so it's actually useful for debugging.
 */
public final class ApiCallLogRedactor {

    private static final Pattern SECRET_KEY = Pattern.compile(
            "(?i)secret|token|password|authorization|api[_-]?key|client[_-]?secret");
    private static final int MAX_LENGTH = 4000;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ApiCallLogRedactor() {}

    public static String toRedactedJson(Object body) {
        if (body == null) return null;
        try {
            Object redacted = redact(body);
            String json = MAPPER.writeValueAsString(redacted);
            return json.length() > MAX_LENGTH ? json.substring(0, MAX_LENGTH) + "…(truncated)" : json;
        } catch (Exception e) {
            return "(unserializable body)";
        }
    }

    private static Object redact(Object value) {
        if (value instanceof Map<?, ?> map) {
            // Connector auth header shape: {"field_name": "X-API-Key", "value": "secret"} —
            // "value" alone doesn't look secret by name, but paired with field_name here it is.
            boolean isAuthHeaderEntry = map.containsKey("field_name") && map.containsKey("value");

            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                boolean secretLike = SECRET_KEY.matcher(key).find()
                        || (isAuthHeaderEntry && "value".equalsIgnoreCase(key));
                out.put(key, secretLike ? "[REDACTED]" : redact(entry.getValue()));
            }
            return out;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(ApiCallLogRedactor::redact).toList();
        }
        return value;
    }
}
