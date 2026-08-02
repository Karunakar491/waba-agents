package com.metaagent.platform.infrastructure.meta;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Map;

/**
 * Dedicated client for Meta's Thread Control API (docs/meta-api/thread-control.md).
 *
 * Deliberately NOT part of MetaApiClient — this endpoint is a known Meta API
 * inconsistency: different base URL shape (api.facebook.com/business/whatsapp/
 * phone_numbers/{id}/thread_control, not /{entity_id}/...), different version
 * (1.0.0, not 2.0.0), and requires Bearer header PLUS access_token+oauth_token
 * query params (all three required). Folding this into MetaApiClient's single
 * contract would force conditional auth/base-url branching there.
 */
@Slf4j
@Component
public class ThreadControlClient {

    private final RestClient restClient;
    private final String token;

    public ThreadControlClient(
            RestClient.Builder builder,
            @Value("${meta.thread-control.base-url}") String baseUrl,
            @Value("${meta.thread-control.token}") String token,
            @Value("${meta.thread-control.version}") String version
    ) {
        this.token = token;
        // Same 5s connect / 10s read pattern as other Meta-facing clients — a hung
        // connection must never block a request thread indefinitely.
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = builder.clone()
                .requestFactory(requestFactory)
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("X-API-Version", version)
                .build();
    }

    /** Releases thread control back to Meta Business Agent for the given phone number. */
    public void release(String phoneNumberId) {
        Map<String, Object> body = Map.of(
                "messaging_product", "whatsapp",
                "action", "release"
        );

        try {
            restClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/" + phoneNumberId + "/thread_control")
                            .queryParam("access_token", token)
                            .queryParam("oauth_token", token)
                            .build())
                    .body(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new MetaApiException(resp.getStatusCode().value());
                    })
                    .toBodilessEntity();
        } catch (MetaApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Thread control release failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
            throw new MetaApiException(502);
        }
    }
}
