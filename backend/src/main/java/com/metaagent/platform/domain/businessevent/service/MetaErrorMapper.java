package com.metaagent.platform.domain.businessevent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.infrastructure.meta.MetaApiException;

/**
 * Turns whatever Meta said into the three error columns on the ledger row.
 *
 * <p>Meta's shape on {@code /agent_event} is
 * {@code {title, detail, type, status}}. If the body will not parse — an HTML
 * error page from a proxy, an empty body, anything unexpected — the raw body is
 * kept in the detail column truncated to fit, because an unrecognised body is
 * still the only evidence of what Meta objected to. It is never swallowed.
 *
 * <p>The truncation widths here are the database column widths, so every value
 * this returns is already safe to store. A refusal or failure row that cannot
 * itself be inserted loses the only trace an operator has.
 */
public final class MetaErrorMapper {

    /** business_event_fire.meta_error_detail is VARCHAR(1024); an unparseable body is truncated to fit, never dropped. */
    private static final int MAX_DETAIL = 1024;
    private static final int MAX_TITLE = 255;
    private static final int MAX_TYPE = 64;

    private static final ObjectMapper ERROR_JSON = new ObjectMapper();

    private MetaErrorMapper() {
    }

    /** Already truncated to the ledger's column widths. Any field may be null. */
    public record LedgerError(Integer httpStatus, String title, String detail, String type) {
    }

    /** Meta answered and rejected us. */
    public static LedgerError fromRejection(MetaApiException e) {
        String title = null;
        String detail = null;
        String type = null;

        JsonNode root = parseJson(e.getResponseBody());
        if (root != null && root.isObject()) {
            title = truncate(text(root, "title"), MAX_TITLE);
            detail = truncate(text(root, "detail"), MAX_DETAIL);
            type = truncate(text(root, "type"), MAX_TYPE);
        }
        if (detail == null) {
            detail = truncate(e.getResponseBody(), MAX_DETAIL);
        }
        return new LedgerError(e.getStatusCode(), title, detail, type);
    }

    /**
     * Meta never answered — a timeout, DNS, a broken socket. 502 because the
     * failure is between us and Meta, and the operator needs to see it was not
     * a rejection.
     */
    public static LedgerError fromTransportFailure(Exception e) {
        return new LedgerError(502, "Could not reach WhatsApp", truncate(e.getMessage(), MAX_DETAIL), null);
    }

    private static JsonNode parseJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return ERROR_JSON.readTree(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
