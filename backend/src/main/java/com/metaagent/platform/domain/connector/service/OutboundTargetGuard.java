package com.metaagent.platform.domain.connector.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;

/**
 * Decides whether the server is allowed to make an HTTP call to a URL an
 * operator supplied.
 *
 * This exists because "let the user type a URL and have the server fetch it" is
 * the textbook SSRF hole, and on this box it is not theoretical: an unguarded
 * fetch of {@code http://169.254.169.254/latest/meta-data/iam/security-credentials/}
 * hands out the instance's IAM credentials to whoever asked. Every other
 * private address is a door onto the VPC — the app server itself, the database,
 * the RabbitMQ management port.
 *
 * <h2>Why it returns an address instead of a boolean</h2>
 *
 * Checking the hostname and then letting the HTTP client resolve it again is a
 * DNS-rebinding hole: the name is allowed to answer twice, and the second
 * answer — the one the client actually connects to — can be {@code 127.0.0.1}.
 * So this resolves the name once, screens every address it got, and hands back
 * the specific address the caller must connect to. The caller connects to that
 * address and passes the original host in the {@code Host} header, so TLS and
 * virtual hosting still work.
 *
 * <h2>What it deliberately does not do</h2>
 *
 * It does not allow-list. An allow-list of customer APIs is a list we would have
 * to maintain for every client, and getting it wrong means refusing legitimate
 * work. Denying the address ranges that can only be internal is the check that
 * stays correct without maintenance.
 */
@Slf4j
@Component
public class OutboundTargetGuard {

    /** Refused, with the reason the operator sees. */
    public static class BlockedTargetException extends RuntimeException {
        public BlockedTargetException(String message) {
            super(message);
        }
    }

    /**
     * A screened target: the host to send, and the address to actually open.
     *
     * @param host the original hostname, for the {@code Host} header and TLS
     * @param address the one resolved address that passed screening
     */
    public record Target(String host, InetAddress address) {}

    /**
     * Screens a URL and returns where to connect.
     *
     * @throws BlockedTargetException if the scheme, host or any resolved
     *     address is one the server must not reach
     */
    public Target screen(URI uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            throw new BlockedTargetException(
                    "Only http and https can be called. Got: " + (scheme == null ? "no scheme" : scheme));
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new BlockedTargetException("That URL has no host in it.");
        }

        InetAddress[] resolved;
        try {
            resolved = InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            throw new BlockedTargetException("That host does not resolve: " + host);
        }
        if (resolved.length == 0) {
            throw new BlockedTargetException("That host does not resolve: " + host);
        }

        // EVERY address must pass, not just the one we pick. A name that
        // answers with one public and one private address is a rebinding
        // attempt, and taking the public one would be trusting the attacker to
        // hand us the safe half.
        List<String> blocked = new ArrayList<>();
        for (InetAddress address : resolved) {
            String reason = reasonBlocked(address);
            if (reason != null) {
                blocked.add(address.getHostAddress() + " (" + reason + ")");
            }
        }
        if (!blocked.isEmpty()) {
            // Logged without the path or any parameter, so a credential in a
            // query string cannot reach the log by way of a refusal.
            log.warn("Refused an outbound probe to {} — {}", host, String.join(", ", blocked));
            throw new BlockedTargetException(
                    "That host points inside our own network (" + String.join(", ", blocked)
                            + "), so it cannot be called from here.");
        }

        return new Target(host, resolved[0]);
    }

    /**
     * Why this address is off limits, or null if it is fine.
     *
     * <p>Java answers most of this correctly and the names are worth reading:
     * {@code isLoopbackAddress} covers 127/8 and ::1, {@code isSiteLocalAddress}
     * covers 10/8, 172.16/12 and 192.168/16, {@code isLinkLocalAddress} covers
     * 169.254/16 — which is the cloud metadata endpoint — and
     * {@code isAnyLocalAddress} covers 0.0.0.0 and ::.
     *
     * <p>Two it does not answer, and both are reachable here:
     * IPv6 unique-local ({@code fc00::/7}, what this VPC would use for internal
     * v6), and carrier-grade NAT ({@code 100.64/10}), which is where EKS and
     * some AWS internal services sit.
     *
     * <p>IPv4-mapped IPv6 ({@code ::ffff:127.0.0.1}) and decimal-integer forms
     * of an address ({@code 2130706433}) need no special case: both parse to a
     * 4-byte {@code Inet4Address}, so they are already screened by the checks
     * above rather than by their spelling.
     */
    private String reasonBlocked(InetAddress address) {
        if (address.isLoopbackAddress()) return "loopback";
        if (address.isAnyLocalAddress()) return "unspecified";
        if (address.isLinkLocalAddress()) return "link-local, the cloud metadata endpoint";
        if (address.isSiteLocalAddress()) return "private";
        if (address.isMulticastAddress()) return "multicast";

        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = bytes[0] & 0xFF;
            int second = bytes[1] & 0xFF;
            // 100.64.0.0/10 — carrier-grade NAT, used inside AWS.
            if (first == 100 && second >= 64 && second <= 127) return "carrier-grade NAT";
            // 192.0.0.0/24 and 198.18.0.0/15 are IETF protocol assignments,
            // not routable destinations for a customer API.
            if (first == 192 && second == 0 && (bytes[2] & 0xFF) == 0) return "IETF-reserved";
            if (first == 198 && (second == 18 || second == 19)) return "IETF benchmark range";
        } else if (bytes.length == 16) {
            // fc00::/7 — IPv6 unique-local. Java has no predicate for it.
            if ((bytes[0] & 0xFE) == 0xFC) return "IPv6 unique-local";
        }
        return null;
    }
}
