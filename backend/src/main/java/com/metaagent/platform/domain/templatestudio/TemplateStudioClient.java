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
 * Explicit connect+read timeout, no retry (bulk-import is already async/
 * polled via job_id — a failed POST just surfaces as "try again," no
 * retry-storm risk) and no circuit breaker (not in TECH-STACK.md, not
 * justified without repeated-incident evidence — EM, 2026-08-04).
 */
@Slf4j
@Component
public class TemplateStudioClient {

    private final RestClient restClient;

    public TemplateStudioClient(RestClient.Builder builder, @Value("${karix-mcp.base-url}") String baseUrl) {
        this.restClient = builder.clone()
                .baseUrl(baseUrl)
                .requestFactory(clientHttpRequestFactory())
                .build();
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
        String token = mintToken(esmeAddr, apiKey, wabaId);
        return restClient.post()
                .uri("/api/templates")
                .header("Authorization", "Bearer " + token)
                .body(payload)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new TemplateStudioException(
                            "Template creation failed. Check the template details and try again.",
                            resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .body(Map.class);
    }

    public void deleteTemplate(String esmeAddr, String apiKey, String wabaId, String templateId) {
        String token = mintToken(esmeAddr, apiKey, wabaId);
        restClient.delete()
                .uri("/api/templates/{id}", templateId)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new TemplateStudioException(
                            "Template deletion failed.", resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .toBodilessEntity();
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> bulkImport(String esmeAddr, String apiKey, String wabaId, String filename, byte[] fileBytes) {
        String token = mintToken(esmeAddr, apiKey, wabaId);
        MultipartBodyBuilder multipart = new MultipartBodyBuilder();
        multipart.part("file", fileBytes).filename(filename);

        return restClient.post()
                .uri("/api/bulk-import")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(multipart.build())
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new TemplateStudioException(
                            "Bulk import upload failed. Check the file and try again.",
                            resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .body(Map.class);
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> getBulkImportStatus(String esmeAddr, String apiKey, String wabaId, String jobId) {
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
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> listTemplates(String esmeAddr, String apiKey, String wabaId, String status) {
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
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTemplate(String esmeAddr, String apiKey, String wabaId, String templateId) {
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
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> editTemplate(String esmeAddr, String apiKey, String wabaId, String templateId, Map<String, Object> payload) {
        String token = mintToken(esmeAddr, apiKey, wabaId);
        return restClient.post()
                .uri("/api/templates/{id}/edit", templateId)
                .header("Authorization", "Bearer " + token)
                .body(payload)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new TemplateStudioException(
                            "Template edit failed. Check the template details and try again.",
                            resp.getStatusCode().value(), readBodyBestEffort(resp));
                })
                .body(Map.class);
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> uploadMedia(String esmeAddr, String apiKey, String wabaId, String filename,
                                           String contentType, String category, byte[] fileBytes) {
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
    }

    // karix-mcp always returns a JSON object at this endpoint — Map.class is
    // a raw-type cast, safe by contract with the karix-mcp REST API.
    @SuppressWarnings("unchecked")
    public Map<String, Object> getAuditLog(String esmeAddr, String apiKey, String wabaId, String pathPrefix) {
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
    }

    private static String readBodyBestEffort(org.springframework.http.client.ClientHttpResponse resp) {
        try {
            return new String(resp.getBody().readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }
}
