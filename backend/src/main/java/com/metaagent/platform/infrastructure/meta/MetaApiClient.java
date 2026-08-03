package com.metaagent.platform.infrastructure.meta;

import com.metaagent.platform.common.security.BackgroundCallContext;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.infrastructure.meta.audit.ApiCallLogWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;

/**
 * Single point of contact for all Meta Business API calls.
 * No other class may call Meta APIs directly.
 *
 * Every call is logged (async, best-effort — see ApiCallLogWriter) to
 * api_call_log for debugging real Meta failures per account. The bearer
 * token is never part of what's logged — it's a default header baked in at
 * construction time, never a per-request payload field.
 */
@Slf4j
@Component
public class MetaApiClient {

    private final RestClient restClient;
    private final RestClient graphRestClient;
    private final ApiCallLogWriter apiCallLogWriter;

    public MetaApiClient(
            RestClient.Builder builder,
            @Value("${meta.api.base-url}") String baseUrl,
            @Value("${meta.api.token}") String token,
            @Value("${meta.api.version}") String version,
            @Value("${meta.graph.base-url}") String graphBaseUrl,
            @Value("${meta.graph.version}") String graphVersion,
            ApiCallLogWriter apiCallLogWriter
    ) {
        this.restClient = builder.clone()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("X-API-Version", version)
                .build();
        this.graphRestClient = builder.clone()
                .baseUrl(graphBaseUrl + "/" + graphVersion)
                .defaultHeader("Authorization", "Bearer " + token)
                .build();
        this.apiCallLogWriter = apiCallLogWriter;
    }

    /**
     * Appends Meta's agent_id query param once one is recorded for this phone
     * number's agent — required by agent_config/settings, agent_config/skills,
     * and agent_connectors(+tools) once an agent_id exists, to scope the write
     * to the correct agent rather than an ambiguous default. Confirmed via a
     * real Meta 400 on skills/connectors when this was missing (2026-07-28).
     * FAQ/website/file endpoints do NOT need this (confirmed working without it)
     * — do not apply this defensively to those.
     */
    public static String scopedPath(String basePath, String metaAgentId) {
        if (metaAgentId == null) {
            return basePath;
        }
        return basePath + (basePath.contains("?") ? "&" : "?") + "agent_id=" + metaAgentId;
    }

    /**
     * agent_config/settings GET returns one entry per configured channel
     * (settings.md) — a phone number can have email/instagram/whatsapp/etc
     * entries in the same array. Never assume index 0 is WhatsApp; a
     * multi-channel number would silently read/reconcile the wrong
     * channel's state. Returns null if no entry matches.
     */
    @SuppressWarnings("unchecked")
    public static java.util.Map<String, Object> findChannelEntry(java.util.List<?> settings, String channel) {
        if (settings == null) {
            return null;
        }
        for (Object o : settings) {
            if (o instanceof java.util.Map<?, ?> m && channel.equals(m.get("channel"))) {
                return (java.util.Map<String, Object>) m;
            }
        }
        return null;
    }

    /** Graph API (graph.facebook.com) — for standard WhatsApp Business API endpoints. */
    public <T> T graphGet(String path, Class<T> responseType) {
        return timed("GET", path, null, () -> graphRestClient.get()
                .uri(path)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .toEntity(responseType));
    }

    public <T> T get(String path, Class<T> responseType) {
        return timed("GET", path, null, () -> restClient.get()
                .uri(path)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .toEntity(responseType));
    }

    public <T> T post(String path, Object body, Class<T> responseType) {
        return timed("POST", path, body, () -> restClient.post()
                .uri(path)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .toEntity(responseType));
    }

    public <T> T put(String path, Object body, Class<T> responseType) {
        return timed("PUT", path, body, () -> restClient.put()
                .uri(path)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .toEntity(responseType));
    }

    public void delete(String path) {
        timed("DELETE", path, null, () -> restClient.delete()
                .uri(path)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .toBodilessEntity());
    }

    // -------------------------------------------------------------------------
    // Private — call logging
    // -------------------------------------------------------------------------

    /** Best-effort read of an error response body for the api_call_log debug trail — never lets a read failure mask the original status. */
    private static String readBodyBestEffort(org.springframework.http.client.ClientHttpResponse resp) {
        try {
            return new String(resp.getBody().readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** Runs the call, logs method/path/status/timing/body (best-effort, async), returns the body. */
    private <T> T timed(String method, String path, Object requestBody, java.util.function.Supplier<ResponseEntity<T>> call) {
        long start = System.currentTimeMillis();
        Long accountId = tryGetAccountId();
        try {
            ResponseEntity<T> entity = call.get();
            apiCallLogWriter.record(accountId, method, path, entity.getStatusCode().value(),
                    System.currentTimeMillis() - start, requestBody, entity.getBody(), null);
            return entity.getBody();
        } catch (MetaApiException e) {
            apiCallLogWriter.record(accountId, method, path, e.getStatusCode(), System.currentTimeMillis() - start,
                    requestBody, e.getResponseBody(), e.getMessage());
            throw e;
        } catch (Exception e) {
            apiCallLogWriter.record(accountId, method, path, null, System.currentTimeMillis() - start,
                    requestBody, null, e.getMessage());
            throw e;
        }
    }

    /** Real requests: SecurityContext. Background/scheduled threads: BackgroundCallContext
     * (set explicitly by that job for its own thread's duration) — see its own javadoc. */
    private Long tryGetAccountId() {
        try {
            return SecurityContextHelper.getRequiredAccountId();
        } catch (Exception e) {
            return BackgroundCallContext.get();
        }
    }
}
