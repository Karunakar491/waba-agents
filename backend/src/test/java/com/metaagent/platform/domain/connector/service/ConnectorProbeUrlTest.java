package com.metaagent.platform.domain.connector.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * How a connector's base URL and an action's path become one URL.
 *
 * <p>Worth its own test because the obvious implementation is wrong.
 * {@link java.net.URI#resolve} treats a leading slash as "replace everything
 * after the host", so a connector whose base URL carries a path of its own —
 * an Apps Script deployment, or IndiaMART's {@code /whatsapp/mba/index.php} —
 * silently loses it and the probe calls the wrong endpoint. The failure looks
 * like the customer's API being broken.
 *
 * <p>This does not cover the HTTP call itself. The guard refuses loopback, by
 * design, so a test server on {@code 127.0.0.1} cannot be probed — the pieces
 * are tested here and the whole is verified against a real API on the deployed
 * box, which is recorded in the job's proof.
 */
class ConnectorProbeUrlTest {

    private final ConnectorProbeService service =
            new ConnectorProbeService(null, new OutboundTargetGuard(), true);

    @Test
    @DisplayName("a base URL with a path of its own keeps it")
    void keepsTheBasePath() {
        var uri = service.resolve("https://wahelp.indiamart.com/whatsapp/mba/index.php", "", Map.of());

        assertThat(uri.toString()).isEqualTo("https://wahelp.indiamart.com/whatsapp/mba/index.php");
    }

    @Test
    @DisplayName("a query parameter joins a base URL that already ends in a file")
    void addsQueryToAFileBase() {
        var params = new LinkedHashMap<String, String>();
        params.put("action", "product-search");

        var uri = service.resolve("https://wahelp.indiamart.com/whatsapp/mba/index.php", "", params);

        assertThat(uri.toString())
                .isEqualTo("https://wahelp.indiamart.com/whatsapp/mba/index.php?action=product-search");
    }

    @Test
    @DisplayName("a path is appended to the base path, not substituted for it")
    void appendsRatherThanReplaces() {
        var uri = service.resolve("https://api.example.com/v2", "/orders/42", Map.of());

        assertThat(uri.toString()).isEqualTo("https://api.example.com/v2/orders/42");
    }

    @Test
    @DisplayName("a missing leading slash on the path is added")
    void addsTheMissingSlash() {
        var uri = service.resolve("https://api.example.com/v2", "orders", Map.of());

        assertThat(uri.toString()).isEqualTo("https://api.example.com/v2/orders");
    }

    @Test
    @DisplayName("a trailing slash on the base does not double up")
    void doesNotDoubleTheSlash() {
        var uri = service.resolve("https://api.example.com/v2/", "/orders", Map.of());

        assertThat(uri.toString()).isEqualTo("https://api.example.com/v2/orders");
    }

    @Test
    @DisplayName("a path that is only a query string joins with ? rather than /")
    void joinsABareQueryString() {
        var uri = service.resolve("https://api.example.com/index.php", "?action=search", Map.of());

        assertThat(uri.toString()).isEqualTo("https://api.example.com/index.php?action=search");
    }

    @Test
    @DisplayName("a second parameter joins with & when the path already brought a ?")
    void joinsWithAmpersand() {
        var params = new LinkedHashMap<String, String>();
        params.put("query", "biryani");

        var uri = service.resolve("https://api.example.com/index.php", "?action=search", params);

        assertThat(uri.toString()).isEqualTo("https://api.example.com/index.php?action=search&query=biryani");
    }

    @Test
    @DisplayName("parameter values are encoded, so a space or an ampersand cannot forge a parameter")
    void encodesValues() {
        var params = new LinkedHashMap<String, String>();
        params.put("query", "veg biryani & rice");
        params.put("city", "New Delhi");

        var uri = service.resolve("https://api.example.com/search", "", params);

        assertThat(uri.toString())
                .isEqualTo("https://api.example.com/search?query=veg+biryani+%26+rice&city=New+Delhi");
    }

    @Test
    @DisplayName("parameter order is the order they were given, so the URL is reproducible")
    void keepsParameterOrder() {
        var params = new LinkedHashMap<String, String>();
        params.put("action", "product-search");
        params.put("query", "biryani");
        params.put("city", "Delhi");

        var uri = service.resolve("https://api.example.com/x", "", params);

        assertThat(uri.getQuery()).isEqualTo("action=product-search&query=biryani&city=Delhi");
    }

    @Test
    @DisplayName("a connector with no base URL says so instead of building a broken URL")
    void refusesAnEmptyBase() {
        assertThatThrownBy(() -> service.resolve("   ", "/orders", Map.of()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("no base URL");
    }

    @Test
    @DisplayName("a base URL with a space in it is refused rather than silently mangled")
    void refusesAnUnparsableUrl() {
        assertThatThrownBy(() -> service.resolve("https://api.example.com/a b", "/orders", Map.of()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("valid URL");
    }
}
