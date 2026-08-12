package com.metaagent.platform.domain.templatestudio;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Single point of contact for karix-mcp's Template Studio REST API
 * (/api/templates, /api/bulk-import). Mints a fresh JWT per call via
 * karix-mcp's own POST /oauth/token (client_credentials grant, per-WABA
 * esme_addr/api_key) — karix-mcp is ALREADY correctly multi-tenant this
 * way (auth.py's issue_token takes esme_addr/api_key/waba_id fresh per
 * request, confirmed 2026-08-04); no karix-mcp change needed, no token
 * caching added for v1 (kept simple per EM — revisit only if token-minting
 * volume becomes a real cost).
 *
 * Circuit-breaker-lite added 2026-08-07: the 2026-08-04 EM decision above
 * to skip a circuit breaker was scoped to bulk-import specifically (already
 * async/polled, no retry-storm risk) — karix-mcp's role has since grown to
 * cover synchronous, user-facing Iris chat calls too (create_template/
 * edit_template/list_templates/send_test_template), a different risk
 * profile that decision didn't consider. Tonight's audit found karix-mcp is
 * now a hard single point of failure for two features with zero automated
 * failure detection. Deliberately NOT resilience4j (not in TECH-STACK.md,
 * and a full library is disproportionate to the actual gap) — a simple
 * in-memory consecutive-failure counter that fails fast once karix-mcp is
 * clearly down, rather than every caller waiting out the full connect+read
 * timeout on a doomed request.
 */
@Slf4j
@Component
public class TemplateStudioClient {

    private static final int CIRCUIT_FAILURE_THRESHOLD = 5;
    private static final Duration CIRCUIT_COOLDOWN = Duration.ofSeconds(30);

    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong circuitOpenUntilMillis = new AtomicLong(0);

    private final RestClient restClient;

    public TemplateStudioClient(RestClient.Builder builder, @Value("${karix-mcp.base-url}") String baseUrl) {
        this.restClient = builder.clone()
                .baseUrl(baseUrl)
                .requestFactory(clientHttpRequestFactory())
                .build();
    }

    /**
     * Wraps every public method below. Fails fast with a clear message once
     * karix-mcp has failed {@value #CIRCUIT_FAILURE_THRESHOLD} times in a
     * row, for {@value #CIRCUIT_COOLDOWN} — instead of every caller in that
     * window separately waiting out the full connect+read timeout only to
     * hit the same outage. A single subsequent success closes the circuit.
     */
    private <T> T withCircuitBreaker(Supplier<T> call) {
        long openUntil = circuitOpenUntilMillis.get();
        if (System.currentTimeMillis() < openUntil) {
            throw new TemplateStudioException(
                    "Karix is currently unavailable — too many recent failures. Try again shortly.", 503, null);
        }
        try {
            T result = call.get();
            consecutiveFailures.set(0);
            return result;
        } catch (RuntimeException e) {
            if (consecutiveFailures.incrementAndGet() >= CIRCUIT_FAILURE_THRESHOLD) {
                circuitOpenUntilMillis.set(System.currentTimeMillis() + CIRCUIT_COOLDOWN.toMillis());
                log.warn("karix-mcp circuit opened after {} consecutive failures, cooling down {}s",
                        CIRCUIT_FAILURE_THRESHOLD, CIRCUIT_COOLDOWN.toSeconds());
            }
            throw e;
        }
    }

    private static org.springframework.http.client.ClientHttpRequestFactory clientHttpRequestFactory() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(15).toMillis());
        return factory;
    }

    /** POST /oauth/token (client_credentials) — mints a JWT scoped to this one WABA. */
    private String mintToken(String esmeAddr, String apiKey, String wabaId) {
        log.debug("Minting karix-mcp token: esmeAddr={} wabaId={}", esmeAddr, wabaId); // never log apiKey
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", esmeAddr);
        form.add("client_secret", apiKey);
        form.add("waba_id", wabaId);

        Map<?, ?> response = restClient.post()
                .uri("/oauth/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new TemplateStudioException(
                            "Could not authenticate with Karix — credentials may be invalid or expired. Contact Karix to verify.",
                            resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .body(Map.class);

        Object token = response != null ? response.get("access_token") : null;
        if (token == null) {
            throw new TemplateStudioException("Karix authentication succeeded but returned no token.", 502, null);
        }
        return token.toString();
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> createTemplate(String esmeAddr, String apiKey, String wabaId, Map<String, Object> payload) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            Map<String, Object> body = restClient.post()
                    .uri("/api/templates")
                    .header("Authorization", "Bearer " + token)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String responseBody = readBodyBestEffort(resp);
                        log.warn("karix-mcp createTemplate failed: wabaId={} status={} body={}", wabaId, resp.getStatusCode().value(), truncate(responseBody));
                        throw new TemplateStudioException(
                                "Template creation failed. Check the template details and try again.",
                                resp.getStatusCode().value(), responseBody);
                    })
                    .body(Map.class);
            // 2xx from karix-mcp isn't the same as Meta accepting the template —
            // Karix can return 200 with a rejection/pending status embedded in the
            // body (2026-08-12 audit finding: this was the one hop with NO log at
            // all on a "successful" HTTP call, the exact gap that would hide
            // "Iris said success but Meta shows nothing"). Log structural fields
            // only (id/status/keys) — never the full body, which can echo back
            // customer-supplied variable examples from the payload.
            log.info("karix-mcp createTemplate response: wabaId={} keys={} status={} id={}",
                    wabaId, body != null ? body.keySet() : null,
                    body != null ? body.get("status") : null,
                    body != null ? body.get("id") : null);
            return body;
        });
    }

    public void deleteTemplate(String esmeAddr, String apiKey, String wabaId, String templateId) {
        withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            restClient.delete()
                    .uri("/api/templates/{id}", templateId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String responseBody = readBodyBestEffort(resp);
                        log.warn("karix-mcp deleteTemplate failed: wabaId={} templateId={} status={} body={}",
                                wabaId, templateId, resp.getStatusCode().value(), truncate(responseBody));
                        throw new TemplateStudioException(
                                "Template deletion failed.", resp.getStatusCode().value(), responseBody);
                    })
                    .toBodilessEntity();
            log.info("karix-mcp deleteTemplate succeeded: wabaId={} templateId={}", wabaId, templateId);
            return null;
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> bulkImport(String esmeAddr, String apiKey, String wabaId, String filename, byte[] fileBytes) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            MultipartBodyBuilder multipart = new MultipartBodyBuilder();
            multipart.part("file", fileBytes).filename(filename);

            Map<String, Object> body = restClient.post()
                    .uri("/api/bulk-import")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(multipart.build())
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String responseBody = readBodyBestEffort(resp);
                        log.warn("karix-mcp bulkImport failed: wabaId={} filename={} status={} body={}",
                                wabaId, filename, resp.getStatusCode().value(), truncate(responseBody));
                        throw new TemplateStudioException(
                                "Bulk import upload failed. Check the file and try again.",
                                resp.getStatusCode().value(), responseBody);
                    })
                    .body(Map.class);
            log.info("karix-mcp bulkImport response: wabaId={} filename={} keys={} jobId={}",
                    wabaId, filename, body != null ? body.keySet() : null, body != null ? body.get("job_id") : null);
            return body;
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> getBulkImportStatus(String esmeAddr, String apiKey, String wabaId, String jobId) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            return restClient.get()
                    .uri("/api/bulk-import/{jobId}", jobId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new TemplateStudioException(
                                "Could not fetch bulk import status.", resp.getStatusCode().value(), readBodyBestEffort(resp));
                    })
                    .body(Map.class);
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> listTemplates(String esmeAddr, String apiKey, String wabaId, String status) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            return restClient.get()
                    .uri(uriBuilder -> {
                        var b = uriBuilder.path("/api/templates");
                        if (status != null && !status.isBlank()) {
                            b.queryParam("status", status);
                        }
                        return b.build();
                    })
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new TemplateStudioException(
                                "Could not fetch templates.", resp.getStatusCode().value(), readBodyBestEffort(resp));
                    })
                    .body(Map.class);
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTemplate(String esmeAddr, String apiKey, String wabaId, String templateId) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            return restClient.get()
                    .uri("/api/templates/{id}", templateId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new TemplateStudioException(
                                "Could not fetch template.", resp.getStatusCode().value(), readBodyBestEffort(resp));
                    })
                    .body(Map.class);
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> editTemplate(String esmeAddr, String apiKey, String wabaId, String templateId, Map<String, Object> payload) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            Map<String, Object> body = restClient.post()
                    .uri("/api/templates/{id}/edit", templateId)
                    .header("Authorization", "Bearer " + token)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String responseBody = readBodyBestEffort(resp);
                        log.warn("karix-mcp editTemplate failed: wabaId={} templateId={} status={} body={}",
                                wabaId, templateId, resp.getStatusCode().value(), truncate(responseBody));
                        throw new TemplateStudioException(
                                "Template edit failed. Check the template details and try again.",
                                resp.getStatusCode().value(), responseBody);
                    })
                    .body(Map.class);
            log.info("karix-mcp editTemplate response: wabaId={} templateId={} keys={} status={}",
                    wabaId, templateId, body != null ? body.keySet() : null, body != null ? body.get("status") : null);
            return body;
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> uploadMedia(String esmeAddr, String apiKey, String wabaId, String filename,
                                           String contentType, String category, byte[] fileBytes) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            MultipartBodyBuilder multipart = new MultipartBodyBuilder();
            multipart.part("file", fileBytes).filename(filename).contentType(MediaType.parseMediaType(
                    contentType != null && !contentType.isBlank() ? contentType : MediaType.APPLICATION_OCTET_STREAM_VALUE));
            multipart.part("category", category);

            return restClient.post()
                    .uri("/api/templates/media")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(multipart.build())
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new TemplateStudioException(
                                "Media upload failed. Check the file and try again.",
                                resp.getStatusCode().value(), readBodyBestEffort(resp));
                    })
                    .body(Map.class);
        });
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> getAuditLog(String esmeAddr, String apiKey, String wabaId, String pathPrefix) {
        return withCircuitBreaker(() -> {
            String token = mintToken(esmeAddr, apiKey, wabaId);
            return restClient.get()
                    .uri(uriBuilder -> {
                        var b = uriBuilder.path("/api/audit-log");
                        if (pathPrefix != null && !pathPrefix.isBlank()) {
                            b.queryParam("path_prefix", pathPrefix);
                        }
                        return b.build();
                    })
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new TemplateStudioException(
                                "Could not fetch audit log.", resp.getStatusCode().value(), readBodyBestEffort(resp));
                    })
                    .body(Map.class);
        });
    }

    /**
     * karix-mcp's own GET /health, unauthenticated. EM-caught gap (2026-08-07
     * audit): no health check for this now-critical-path dependency was
     * wired into the platform at all. Deliberately bypasses the circuit
     * breaker — this IS the check that should tell us the circuit is open.
     * Returns false on any failure rather than throwing, since a health
     * check that itself throws defeats the purpose.
     */
    public boolean isHealthy() {
        try {
            restClient.get().uri("/health").retrieve().toBodilessEntity();
            return true;
        } catch (Exception e) {
            log.warn("karix-mcp health check failed: {}", e.getMessage());
            return false;
        }
    }

    private static String readBodyBestEffort(org.springframework.http.client.ClientHttpResponse resp) {
        try {
            return new String(resp.getBody().readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    // Error bodies are logged for diagnosis, but capped — karix-mcp can echo
    // back submitted template content (including customer-supplied example
    // values) in a validation error, and a log line isn't the place for an
    // uncapped dump of that.
    private static final int LOG_BODY_MAX_CHARS = 500;

    private static String truncate(String body) {
        if (body == null) return null;
        return body.length() > LOG_BODY_MAX_CHARS ? body.substring(0, LOG_BODY_MAX_CHARS) + "...(truncated)" : body;
    }
}
