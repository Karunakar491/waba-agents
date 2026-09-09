package com.metaagent.platform.domain.connector.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The guard is the whole reason the probe endpoint is safe to exist, so these
 * are the tests that matter most in this feature.
 *
 * Written as "what an attacker would type", not as "what the code branches on".
 * Every case here is a real technique: the AWS metadata address, the private
 * ranges that reach our own database, an address spelled as a decimal integer
 * so a naive string check misses it, and the IPv4-mapped IPv6 form.
 *
 * No network is used. Everything below is either a literal address or a name
 * the JDK resolves locally, so these run the same on a laptop and in CI.
 */
class OutboundTargetGuardTest {

    private final OutboundTargetGuard guard = new OutboundTargetGuard();

    @Test
    @DisplayName("the cloud metadata endpoint is refused — it hands out IAM credentials")
    void refusesTheMetadataEndpoint() {
        assertThatThrownBy(() -> guard.screen(
                        URI.create("http://169.254.169.254/latest/meta-data/iam/security-credentials/")))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class)
                .hasMessageContaining("metadata");
    }

    @ParameterizedTest
    @DisplayName("loopback is refused however it is spelled")
    @ValueSource(strings = {
            "http://127.0.0.1/",
            "http://127.0.0.1:8080/actuator/env",
            "http://2130706433/",         // 127.0.0.1 as a decimal integer
            "http://[::1]/",
            "http://[::ffff:127.0.0.1]/", // IPv4-mapped IPv6
            "http://localhost/",
    })
    void refusesLoopback(String url) {
        assertThatThrownBy(() -> guard.screen(URI.create(url)))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class);
    }

    @ParameterizedTest
    @DisplayName("the odd loopback spellings are refused, though the reason is platform-dependent")
    @ValueSource(strings = {
            "http://127.1/",       // BSD shorthand for 127.0.0.1
            "http://0x7f000001/",  // and the hex form
    })
    void refusesOddLoopbackSpellings(String url) {
        // These are asserted only as "refused", deliberately. On Linux the
        // resolver expands both to 127.0.0.1 and the range check catches them;
        // on Windows neither resolves and they are refused as an unknown host.
        // Asserting the *reason* would make this test pass on one platform and
        // fail on the other, and asserting a reason it does not have would be
        // worse: it would look like the range check was covering a case it was
        // not. Both outcomes are safe, which is what this pins down.
        assertThatThrownBy(() -> guard.screen(URI.create(url)))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class);
    }

    @ParameterizedTest
    @DisplayName("private ranges are refused — these reach our own app server and database")
    @ValueSource(strings = {
            "http://10.1.17.16:8080/",   // the app server itself
            "http://10.0.0.1/",
            "http://172.16.0.1/",
            "http://172.31.255.254/",
            "http://192.168.1.1/",
            "http://0.0.0.0/",
            "http://[fc00::1]/",         // IPv6 unique-local
            "http://[fd12:3456::1]/",
            "http://100.64.0.1/",        // carrier-grade NAT, used inside AWS
    })
    void refusesPrivateRanges(String url) {
        assertThatThrownBy(() -> guard.screen(URI.create(url)))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class);
    }

    @ParameterizedTest
    @DisplayName("only http and https — file:// and gopher:// are refused by scheme")
    @ValueSource(strings = {
            "file:///etc/passwd",
            "gopher://127.0.0.1:11211/",
            "ftp://example.com/",
            "jar:file:///tmp/x.jar!/",
    })
    void refusesOtherSchemes(String url) {
        assertThatThrownBy(() -> guard.screen(URI.create(url)))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class)
                .hasMessageContaining("http");
    }

    @Test
    @DisplayName("a URL with no host is refused rather than NPEing somewhere later")
    void refusesHostlessUrl() {
        assertThatThrownBy(() -> guard.screen(URI.create("http:///orders")))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class)
                .hasMessageContaining("no host");
    }

    @Test
    @DisplayName("a name that does not resolve says so, rather than being allowed through")
    void refusesUnresolvableHost() {
        assertThatThrownBy(() ->
                        guard.screen(URI.create("https://this-host-does-not-exist.invalid/orders")))
                .isInstanceOf(OutboundTargetGuard.BlockedTargetException.class)
                .hasMessageContaining("does not resolve");
    }

    @Test
    @DisplayName("a public address passes, and comes back with the address to connect to")
    void allowsAPublicAddress() {
        // A literal, so this asserts the screening logic without a DNS lookup.
        OutboundTargetGuard.Target target = guard.screen(URI.create("https://8.8.8.8/orders"));

        assertThat(target.host()).isEqualTo("8.8.8.8");
        assertThat(target.address().getHostAddress()).isEqualTo("8.8.8.8");
    }

    @Test
    @DisplayName("the port is not screened — a public host on an odd port is still public")
    void allowsAPublicAddressOnAnyPort() {
        assertThatCode(() -> guard.screen(URI.create("https://8.8.8.8:8443/orders")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("the refusal names the address, so an operator can see what their DNS points at")
    void refusalNamesTheAddress() {
        assertThatThrownBy(() -> guard.screen(URI.create("http://10.1.17.16/")))
                .hasMessageContaining("10.1.17.16")
                .hasMessageContaining("private");
    }
}
