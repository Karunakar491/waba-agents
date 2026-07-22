package com.metaagent.platform.infrastructure.meta;

import com.metaagent.platform.common.exception.BusinessException;

/**
 * Meta API failure carrying the HTTP status code, so callers can map
 * distinct Meta failure modes to distinct user-facing errors (spec 5.4).
 */
public class MetaApiException extends BusinessException {

    private final int statusCode;

    public MetaApiException(int statusCode) {
        super("Meta API error: " + statusCode);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public boolean isNotFound() {
        return statusCode == 404;
    }

    public boolean isAccessDenied() {
        return statusCode == 401 || statusCode == 403;
    }
}
