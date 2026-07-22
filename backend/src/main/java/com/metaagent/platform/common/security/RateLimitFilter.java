package com.metaagent.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Fixed-window rate limiting on abuse-prone endpoints.
 * Counters live in Redis DB0 (cache) — see RedisConfig.
 * Fails open: if Redis is unavailable, requests pass and we log loudly —
 * availability of login/register beats rate limiting.
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    @Value("${ratelimit.enabled:true}")
    private boolean enabled;

    @Value("${ratelimit.register.limit:10}")
    private int registerLimit;
    @Value("${ratelimit.register.window-seconds:3600}")
    private long registerWindow;

    @Value("${ratelimit.login.limit:20}")
    private int loginLimit;
    @Value("${ratelimit.login.window-seconds:900}")
    private long loginWindow;

    @Value("${ratelimit.refresh.limit:30}")
    private int refreshLimit;
    @Value("${ratelimit.refresh.window-seconds:60}")
    private long refreshWindow;

    @Value("${ratelimit.generate-defaults.limit:10}")
    private int generateDefaultsLimit;
    @Value("${ratelimit.generate-defaults.window-seconds:3600}")
    private long generateDefaultsWindow;

    public RateLimitFilter(@Qualifier("cacheRedisTemplate") StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!enabled || !"POST".equals(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getServletPath();
        Rule rule = resolveRule(path, request);
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long retryAfterSeconds;
        try {
            Long count = redis.opsForValue().increment(rule.key);
            if (count == null) {
                filterChain.doFilter(request, response);
                return;
            }
            if (count == 1L) {
                redis.expire(rule.key, Duration.ofSeconds(rule.windowSeconds));
            }
            if (count <= rule.limit) {
                filterChain.doFilter(request, response);
                return;
            }
            Long ttl = redis.getExpire(rule.key);
            if (ttl == null || ttl < 0) {
                // Defensive: counter without TTL must not lock a client out forever
                redis.expire(rule.key, Duration.ofSeconds(rule.windowSeconds));
                ttl = rule.windowSeconds;
            }
            retryAfterSeconds = ttl;
        } catch (Exception e) {
            log.error("Rate limit check failed (failing open) for [{}]: {}", path, e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        reject(response, retryAfterSeconds);
    }

    private void reject(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        long retryMinutes = Math.max(1, (retryAfterSeconds + 59) / 60);
        ApiResponse<Void> body = ApiResponse.error(
                "Too many requests. Try again in " + retryMinutes + " minute" + (retryMinutes == 1 ? "" : "s") + ".");
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private Rule resolveRule(String path, HttpServletRequest request) {
        switch (path) {
            case "/api/v1/auth/register":
                return new Rule("rl:register:ip:" + clientIp(request), registerLimit, registerWindow);
            case "/api/v1/auth/login":
                return new Rule("rl:login:ip:" + clientIp(request), loginLimit, loginWindow);
            case "/api/v1/auth/refresh":
                // Key by refresh token when present — multi-tab users behind one IP
                // must not throttle each other. Fall back to IP for cookieless abuse.
                String subject = cookieValue(request, "refresh_token")
                        .map(t -> "tok:" + sha256Prefix(t))
                        .orElseGet(() -> "ip:" + clientIp(request));
                return new Rule("rl:refresh:" + subject, refreshLimit, refreshWindow);
            default:
                if (path.startsWith("/api/v1/agents/") && path.endsWith("/generate-defaults")) {
                    // Per-IP: this filter runs before authentication, and Claude cost
                    // abuse from one origin is what we are bounding.
                    return new Rule("rl:generate-defaults:ip:" + clientIp(request), generateDefaultsLimit, generateDefaultsWindow);
                }
                return null;
        }
    }

    private String clientIp(HttpServletRequest request) {
        // Assumes the nginx LB in front of us overwrites client-supplied X-Forwarded-For.
        // If the app is ever exposed directly, this header is spoofable.
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private Optional<String> cookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }

    private String sha256Prefix(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private record Rule(String key, int limit, long windowSeconds) {
    }
}
