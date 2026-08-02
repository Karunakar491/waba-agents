package com.metaagent.platform.infrastructure.meta;

import com.metaagent.platform.common.exception.BusinessException;

/**
 * Meta API failure carrying the HTTP status code, so callers can map
 * distinct Meta failure modes to distinct user-facing errors (spec 5.4).
 */
public class MetaApiException extends BusinessException {

    private final int statusCode;
    private final String responseBody;

    public MetaApiException(int statusCode) {
        this(statusCode, null);
    }

    /** responseBody is best-effort (may be null if the body couldn't be read) — used for the api_call_log debug trail, never for control flow. */
    public MetaApiException(int statusCode, String responseBody) {
        super("Meta API error: " + statusCode);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }

    public boolean isNotFound() {
        return statusCode == 404;
    }

    public boolean isAccessDenied() {
        return statusCode == 401 || statusCode == 403;
    }
}
