package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.exception.BusinessException;

/**
 * karix-mcp call failure — carries the HTTP status so callers can
 * distinguish "credentials invalid" (401, contact Karix) from a genuine
 * validation/server error, matching MetaApiException's pattern. The raw
 * karix-mcp error body is captured for logging only, NEVER surfaced
 * verbatim to the frontend (EM: never leak karix-mcp's internal error
 * shape to the caller).
 */
public class TemplateStudioException extends BusinessException {

    private final int statusCode;
    private final String responseBody;

    public TemplateStudioException(String userMessage, int statusCode, String responseBody) {
        super(userMessage);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }

    public boolean isCredentialFailure() {
        return statusCode == 401 || statusCode == 403;
    }
}
