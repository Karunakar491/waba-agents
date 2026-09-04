package com.metaagent.platform.infrastructure.meta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Turns a Meta error response into something a person can act on.
 *
 * Every Meta failure used to reach the operator as "Meta API error: 400". Meta's
 * own reason was captured in {@link MetaApiException#getResponseBody()}, written
 * to api_call_log, and then dropped on the floor. On 2026-09-04 that cost a whole
 * afternoon: a rejected connector tool said only "400", and finding out that the
 * real reason was "request_definition.body.params.tags.items must be a JSON
 * object string" took nine hand-built probes against the live API. An operator in
 * the UI had no route to that at all — they just saw a number and stopped.
 *
 * Two response shapes are handled, because Meta uses both:
 *   - this API's:      {"title": "...", "detail": "...", "status": 400, "fbtrace_id": "..."}
 *   - Graph API's:     {"error": {"message": "...", "type": "...", "code": 100}}
 *
 * fbtrace_id is deliberately NOT surfaced — it means nothing to the operator and
 * is already in the log for anyone raising it with Meta.
 */
public final class MetaApiErrorMessage {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private MetaApiErrorMessage() {
    }

    public static String describe(int statusCode, String responseBody) {
        String fromMeta = extract(responseBody);
        if (fromMeta != null && !fromMeta.isBlank()) {
            return fromMeta.trim();
        }
        return fallbackFor(statusCode);
    }

    /**
     * Meta sometimes double-encodes: the body is a JSON *string* whose content is
     * the JSON object. Unwrap at most once rather than looping, so a hostile or
     * malformed body can't spin here.
     */
    private static String extract(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }
        JsonNode root = parse(responseBody);
        if (root != null && root.isTextual()) {
            root = parse(root.asText());
        }
        if (root == null || !root.isObject()) {
            return null;
        }

        JsonNode error = root.path("error");
        if (error.isObject()) {
            String message = text(error, "message");
            if (message != null) {
                return message;
            }
        }

        String detail = text(root, "detail");
        String title = text(root, "title");
        if (detail != null && title != null && !detail.startsWith(title)) {
            return title + " — " + detail;
        }
        if (detail != null) {
            return detail;
        }
        return title;
    }

    private static JsonNode parse(String raw) {
        try {
            return MAPPER.readTree(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
    }

    /**
     * Used only when Meta sent nothing usable. Says what the status means in
     * plain words instead of restating the number, and never invents a cause.
     */
    private static String fallbackFor(int statusCode) {
        return switch (statusCode) {
            case 400 -> "Meta rejected this as invalid, without saying why. Check the request shape.";
            case 401, 403 -> "Meta refused this request. The access token may have expired or lack permission.";
            case 404 -> "Meta could not find this. It may already have been deleted.";
            case 409 -> "Something with this name already exists on Meta. Try a different name.";
            case 429 -> "Meta is rate-limiting us. Wait a moment and try again.";
            default -> statusCode >= 500
                    ? "Meta had a server error (" + statusCode + "). This is usually temporary — try again."
                    : "Meta rejected this request (" + statusCode + ").";
        };
    }
}
