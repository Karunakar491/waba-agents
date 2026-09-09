package com.metaagent.platform.domain.connector.service;

import com.metaagent.platform.domain.connector.dto.ConnectorProbeDtos;
import com.metaagent.platform.domain.connector.entity.Connector;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import com.metaagent.platform.common.exception.BusinessException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Makes one real HTTP call so an operator can see whether their action works,
 * before a customer's message is the thing that finds out.
 *
 * <h2>Why this exists at all</h2>
 *
 * The Response tab used to say testing was impossible because "Meta makes the
 * call, not us". That was wrong, and it was mine. Meta making the call at
 * runtime says nothing about whether we can make one for verification. Until
 * this existed, the first proof an action worked was a failed conversation.
 *
 * <h2>What it will not do</h2>
 *
 * <ul>
 *   <li><b>The base URL comes from the stored connector, never from the
 *       request.</b> The operator sends a path; the host is ours to decide. So
 *       editing the payload in devtools cannot point this at a new host — it
 *       can only reach hosts someone already saved as a connector, which is
 *       itself a screened, audited act.</li>
 *   <li><b>No redirects.</b> A 302 to 169.254.169.254 is the entire attack, and
 *       a redirect chain re-opens every check made before the first hop.</li>
 *   <li><b>Nothing is stored.</b> Not the credential, not the response. The
 *       credential arrives per call because credential values are deliberately
 *       never persisted, and the response body is returned to the caller and
 *       dropped.</li>
 *   <li><b>Nothing is logged but the outcome.</b> No URL with a query string,
 *       no headers, no body — in either direction. A credential in a query
 *       parameter must not reach the log by way of this feature, and neither
 *       must a customer record in a response.</li>
 * </ul>
 *
 * <h2>The one gap, stated rather than hidden</h2>
 *
 * {@link OutboundTargetGuard} returns the address it screened so the caller can
 * connect to <em>that</em> address rather than re-resolving the name — which is
 * how DNS rebinding is closed. This class does not use it that way, and cannot
 * with the JDK's HTTP client: connecting to a literal IP makes TLS present the
 * IP as its SNI name, so certificate validation fails for every https target.
 * Pinning the address while keeping the original SNI needs a client with a
 * pluggable DNS resolver (Apache HttpClient 5), which is a new dependency and
 * therefore a decision for the founder rather than for me.
 *
 * <p>So the residual risk is a host whose DNS answers publicly when screened
 * and privately a moment later, for a hostname an operator had already saved as
 * a connector. Far smaller than an unguarded fetch, not zero. The address is
 * screened immediately before the call to keep the window at its shortest, and
 * this comment is here so the next person does not read the guard's signature
 * and assume the pinning is in place.
 */
@Slf4j
@Service
public class ConnectorProbeService {

    /*
     * Every refusal here throws BusinessException, not ResponseStatusException.
     *
     * It threw ResponseStatusException for one deploy, and the reasons never
     * reached anybody: GlobalExceptionHandler has no handler for it, so it fell
     * through to the catch-all and an operator blocking on
     * "that host points inside our own network" was shown "Internal server
     * error". Caught by probing 169.254.169.254 on the deployed box and reading
     * what came back, not by reading the code — which is the whole argument for
     * verifying against production rather than against a diff.
     */

    /** Anything past this is not worth reading in a response pane. */
    private static final int MAX_BODY_BYTES = 256 * 1024;
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    /**
     * Response headers worth showing. An allow-list rather than everything,
     * because a full header dump is where Set-Cookie lands, and a session
     * cookie for a customer's API has no business on our screen or in the
     * browser's memory.
     */
    private static final List<String> SHOWN_HEADERS = List.of(
            "content-type", "content-length", "date", "server",
            "x-request-id", "x-correlation-id", "retry-after");

    private final ConnectorLibraryService connectorLibraryService;
    private final OutboundTargetGuard guard;
    private final boolean enabled;

    public ConnectorProbeService(
            ConnectorLibraryService connectorLibraryService,
            OutboundTargetGuard guard,
            @Value("${connectors.probe.enabled:true}") boolean enabled) {
        this.connectorLibraryService = connectorLibraryService;
        this.guard = guard;
        this.enabled = enabled;
    }

    /**
     * The kill switch. Default on because the feature is the point, but one
     * key in the server's application.yml plus a restart removes the outbound
     * capability entirely without a code rollback:
     * {@code connectors.probe.enabled: false}.
     */
    private void requireEnabled() {
        if (!enabled) {
            throw new BusinessException("Sending a test request is turned off on this deployment.");
        }
    }

    public ConnectorProbeDtos.ProbeResponse probe(Long connectorId, ConnectorProbeDtos.ProbeRequest request) {
        requireEnabled();

        // The same check every other connector endpoint makes, borrowed rather
        // than reimplemented — a probe that scoped access its own way would be
        // the one door into another tenant's connector.
        Connector connector = connectorLibraryService.loadOwned(connectorId);

        URI uri = resolve(connector.getBaseUrl(), request.path(), request.queryParams());

        OutboundTargetGuard.Target target;
        try {
            target = guard.screen(uri);
        } catch (OutboundTargetGuard.BlockedTargetException e) {
            throw new BusinessException(e.getMessage());
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(TIMEOUT);
        applyHeaders(builder, request);
        applyMethodAndBody(builder, request);

        // Built per call rather than shared, so one probe cannot reuse a
        // connection that a previous probe opened to a different tenant's host.
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(TIMEOUT)
                .build();

        long startedAt = System.nanoTime();
        HttpResponse<InputStream> response = send(client, builder.build());
        try (InputStream stream = response.body()) {
            return read(response, stream, startedAt);
        } catch (ProbeFailure e) {
            throw new BusinessException(e.getMessage());
        } catch (IOException e) {
            log.warn("Probe to {} could not be read: {}", target.host(), e.getClass().getSimpleName());
            throw new BusinessException("The response could not be read.");
        }
    }

    private static class ProbeFailure extends RuntimeException {
        ProbeFailure(String message) {
            super(message);
        }
    }

    /**
     * The response is passed along rather than held in a field.
     *
     * <p>It was a field for one draft, so that {@code read} could reach the
     * status code after consuming the body. This is a singleton bean: two
     * operators probing at the same moment would have overwritten each other's
     * response and each been shown the other's status and headers. Nothing here
     * holds per-call state.
     */
    private HttpResponse<InputStream> send(HttpClient client, HttpRequest httpRequest) {
        try {
            return client.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());
        } catch (java.net.http.HttpTimeoutException e) {
            throw new ProbeFailure("The API did not answer within " + TIMEOUT.toSeconds() + " seconds.");
        } catch (IOException e) {
            // The class name only. The message can carry the resolved address
            // and, for a TLS failure, parts of the certificate.
            throw new ProbeFailure("Could not reach the API (" + e.getClass().getSimpleName() + ").");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProbeFailure("The request was interrupted.");
        }
    }

    /**
     * Reads at most {@link #MAX_BODY_BYTES}, and says so when it truncated.
     *
     * <p>Streamed and counted rather than {@code ofByteArray}, because a
     * response body is a size the other end chooses: a handler that buffers all
     * of it lets any API we probe decide how much of this server's heap to use.
     */
    private ConnectorProbeDtos.ProbeResponse read(
            HttpResponse<InputStream> response, InputStream stream, long startedAt) throws IOException {
        byte[] buffer = new byte[MAX_BODY_BYTES + 1];
        int total = 0;
        int read;
        while (total < buffer.length && (read = stream.read(buffer, total, buffer.length - total)) != -1) {
            total += read;
        }
        boolean truncated = total > MAX_BODY_BYTES;
        int kept = Math.min(total, MAX_BODY_BYTES);

        long latencyMs = (System.nanoTime() - startedAt) / 1_000_000;
        String body = new String(buffer, 0, kept, StandardCharsets.UTF_8);

        Map<String, String> headers = new LinkedHashMap<>();
        response.headers().map().forEach((name, values) -> {
            if (SHOWN_HEADERS.contains(name.toLowerCase()) && !values.isEmpty()) {
                headers.put(name, values.get(0));
            }
        });

        // The outcome, and nothing from either payload.
        log.info("Probe finished: HTTP {} in {}ms, {} bytes{}",
                response.statusCode(), latencyMs, kept, truncated ? " (truncated)" : "");

        return new ConnectorProbeDtos.ProbeResponse(
                response.statusCode(), latencyMs, kept, truncated, headers, body);
    }

    /**
     * Joins the connector's base URL to the action's path.
     *
     * <p>The path is resolved as a suffix, not with {@link URI#resolve}, which
     * treats a leading slash as "replace everything after the host" — so a base
     * URL with a path of its own (an Apps Script deployment, or IndiaMART's
     * {@code /whatsapp/mba/index.php}) would silently lose it.
     */
    URI resolve(String baseUrl, String path, Map<String, String> queryParams) {
        String base = baseUrl == null ? "" : baseUrl.trim();
        if (base.isEmpty()) {
            throw new BusinessException("This connector has no base URL yet.");
        }
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);

        String suffix = path == null ? "" : path.trim();
        if (!suffix.isEmpty() && !suffix.startsWith("/") && !suffix.startsWith("?")) {
            suffix = "/" + suffix;
        }

        StringBuilder url = new StringBuilder(base).append(suffix);
        if (queryParams != null && !queryParams.isEmpty()) {
            char separator = url.indexOf("?") >= 0 ? '&' : '?';
            for (Map.Entry<String, String> entry : queryParams.entrySet()) {
                url.append(separator)
                        .append(encode(entry.getKey()))
                        .append('=')
                        .append(encode(entry.getValue()));
                separator = '&';
            }
        }

        try {
            return new URI(url.toString());
        } catch (URISyntaxException e) {
            throw new BusinessException("That base URL and path do not form a valid URL.");
        }
    }

    private String encode(String value) {
        return java.net.URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    /**
     * Request headers, from two places that must not be able to overwrite each
     * other silently.
     *
     * <p>Hop-by-hop and identity headers are refused rather than passed on:
     * {@code Host} would defeat the screening by sending one host and reaching
     * another, and {@code Content-Length} must match the body this method
     * builds, not one the caller claims.
     */
    private void applyHeaders(HttpRequest.Builder builder, ConnectorProbeDtos.ProbeRequest request) {
        List<String> refused = List.of("host", "content-length", "connection",
                "transfer-encoding", "upgrade", "expect");

        Map<String, String> merged = new LinkedHashMap<>();
        if (request.headers() != null) merged.putAll(request.headers());
        // Credentials last, so a typed header row cannot shadow the credential
        // the operator supplied for this call.
        if (request.secrets() != null) merged.putAll(request.secrets());

        merged.forEach((name, value) -> {
            if (name == null || name.isBlank() || value == null) return;
            if (refused.contains(name.trim().toLowerCase())) return;
            builder.header(name.trim(), value);
        });
    }

    private void applyMethodAndBody(HttpRequest.Builder builder, ConnectorProbeDtos.ProbeRequest request) {
        String method = request.method() == null ? "GET" : request.method().trim().toUpperCase();
        String body = request.body();
        boolean sendsBody = body != null && !body.isBlank()
                && (method.equals("POST") || method.equals("PUT") || method.equals("PATCH"));

        HttpRequest.BodyPublisher publisher = sendsBody
                ? HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)
                : HttpRequest.BodyPublishers.noBody();
        builder.method(method, publisher);
    }
}
