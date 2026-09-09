package com.metaagent.platform.domain.connector.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * Sending one test request, and what came back.
 *
 * <p>Deliberately not the stored shape of an action. An operator sends what is
 * on screen — including edits not saved yet, which is the whole point of a test
 * button — so this carries the request as typed rather than an action id.
 */
public final class ConnectorProbeDtos {

    private ConnectorProbeDtos() {}

    /**
     * @param method GET, POST, PUT, PATCH or DELETE
     * @param path appended to the connector's stored base URL. There is no
     *     {@code baseUrl} field here on purpose: the host must come from a
     *     saved connector, so that editing this payload cannot aim the server
     *     at a host nobody reviewed.
     * @param queryParams appended and URL-encoded
     * @param headers request headers as typed on the Headers tab
     * @param secrets credential values for this one call — the API key, the
     *     bearer token. They are sent as headers, used in memory, and never
     *     written to the database or the log. They live in this separate field
     *     rather than mixed into {@code headers} so that "never persist this"
     *     is visible in the type rather than a convention someone has to know.
     * @param body the request body, verbatim
     */
    public record ProbeRequest(
            @NotBlank String method,
            @Size(max = 2000) String path,
            Map<String, String> queryParams,
            Map<String, String> headers,
            Map<String, String> secrets,
            @Size(max = 256 * 1024) String body) {}

    /**
     * @param status the HTTP status. Not the same question as "did it work" —
     *     see the note on the Response pane about APIs that return 200 with a
     *     failure in the body.
     * @param latencyMs wall clock, including DNS and TLS
     * @param sizeBytes bytes of body actually read
     * @param truncated true when the body was longer than the cap
     * @param headers a small allow-list of response headers, not all of them
     * @param body the response body as text
     */
    public record ProbeResponse(
            int status,
            long latencyMs,
            int sizeBytes,
            boolean truncated,
            Map<String, String> headers,
            String body) {}
}
