package com.metaagent.platform.infrastructure.meta;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Single point of contact for all Meta Business API calls.
 * No other class may call Meta APIs directly.
 */
@Slf4j
@Component
public class MetaApiClient {

    private final RestClient restClient;
    private final RestClient graphRestClient;

    public MetaApiClient(
            RestClient.Builder builder,
            @Value("${meta.api.base-url}") String baseUrl,
            @Value("${meta.api.token}") String token,
            @Value("${meta.api.version}") String version,
            @Value("${meta.graph.base-url}") String graphBaseUrl,
            @Value("${meta.graph.version}") String graphVersion
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
    }

    /** Graph API (graph.facebook.com) — for standard WhatsApp Business API endpoints. */
    public <T> T graphGet(String path, Class<T> responseType) {
        return graphRestClient.get()
                .uri(path)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value());
                })
                .body(responseType);
    }

    public <T> T get(String path, Class<T> responseType) {
        return restClient.get()
                .uri(path)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value());
                })
                .body(responseType);
    }

    public <T> T post(String path, Object body, Class<T> responseType) {
        return restClient.post()
                .uri(path)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value());
                })
                .body(responseType);
    }

    public <T> T put(String path, Object body, Class<T> responseType) {
        return restClient.put()
                .uri(path)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value());
                })
                .body(responseType);
    }

    public void delete(String path) {
        restClient.delete()
                .uri(path)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new MetaApiException(resp.getStatusCode().value());
                })
                .toBodilessEntity();
    }
}
