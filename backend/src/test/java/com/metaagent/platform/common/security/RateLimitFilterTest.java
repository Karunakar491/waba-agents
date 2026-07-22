package com.metaagent.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pure unit tests for RateLimitFilter.
 *
 * No Spring context — constructed directly so @Value fields are set via ReflectionTestUtils.
 * StringRedisTemplate and ValueOperations are Mockito mocks.
 * MockHttpServletRequest / MockHttpServletResponse from spring-test.
 */
@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    private RateLimitFilter filter;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(redis, objectMapper);
        // @Value defaults
        ReflectionTestUtils.setField(filter, "enabled", true);
        ReflectionTestUtils.setField(filter, "registerLimit", 10);
        ReflectionTestUtils.setField(filter, "registerWindow", 3600L);
        ReflectionTestUtils.setField(filter, "loginLimit", 20);
        ReflectionTestUtils.setField(filter, "loginWindow", 900L);
        ReflectionTestUtils.setField(filter, "refreshLimit", 30);
        ReflectionTestUtils.setField(filter, "refreshWindow", 60L);
        ReflectionTestUtils.setField(filter, "generateDefaultsLimit", 10);
        ReflectionTestUtils.setField(filter, "generateDefaultsWindow", 3600L);

        // lenient: passthrough tests never touch Redis and assert verifyNoInteractions
        lenient().when(redis.opsForValue()).thenReturn(valueOps);
    }

    // -------------------------------------------------------------------------
    // Non-matching path — no Redis interaction
    // -------------------------------------------------------------------------

    @Test
    void non_matching_path_passes_through_without_redis_call() throws Exception {
        MockHttpServletRequest request = post("/api/v1/agents");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull(); // chain was continued
        verifyNoInteractions(redis);
    }

    // -------------------------------------------------------------------------
    // GET requests pass through — filter only applies to POST
    // -------------------------------------------------------------------------

    @Test
    void get_requests_pass_through_without_redis_call() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
        verifyNoInteractions(redis);
    }

    // -------------------------------------------------------------------------
    // Under limit — chain continues
    // -------------------------------------------------------------------------

    @Test
    void under_limit_allows_request_through() throws Exception {
        when(valueOps.increment(anyString())).thenReturn(5L); // well under limit of 20
        when(redis.getExpire(anyString())).thenReturn(800L);

        MockHttpServletRequest request = post("/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    // -------------------------------------------------------------------------
    // Over limit — 429 with Retry-After and JSON body
    // -------------------------------------------------------------------------

    @Test
    void over_limit_returns_429_with_retry_after_and_json_error_body() throws Exception {
        when(valueOps.increment(anyString())).thenReturn(21L); // exceeds loginLimit=20
        when(redis.getExpire(anyString())).thenReturn(600L);

        MockHttpServletRequest request = post("/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isEqualTo("600");
        String body = response.getContentAsString();
        assertThat(body).contains("\"success\":false");
        // chain must NOT be continued
        assertThat(chain.getRequest()).isNull();
    }

    // -------------------------------------------------------------------------
    // Redis throws — fails open (chain continues)
    // -------------------------------------------------------------------------

    @Test
    void redis_exception_fails_open_and_continues_chain() throws Exception {
        when(valueOps.increment(anyString())).thenThrow(new RuntimeException("Redis unavailable"));

        MockHttpServletRequest request = post("/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    // -------------------------------------------------------------------------
    // Refresh keyed by refresh_token cookie hash
    // -------------------------------------------------------------------------

    @Test
    void refresh_keyed_by_refresh_token_cookie_hash_when_cookie_present() throws Exception {
        when(valueOps.increment(anyString())).thenReturn(1L);

        MockHttpServletRequest request = post("/api/v1/auth/refresh");
        request.setCookies(new jakarta.servlet.http.Cookie("refresh_token", "my-refresh-token-value"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        // Verify redis key starts with "rl:refresh:tok:" — token-based not IP-based
        verify(valueOps).increment(argThat(key -> key.startsWith("rl:refresh:tok:")));
    }

    // -------------------------------------------------------------------------
    // First increment sets expiry
    // -------------------------------------------------------------------------

    @Test
    void first_increment_sets_expiry_on_key() throws Exception {
        when(valueOps.increment(anyString())).thenReturn(1L); // first request

        MockHttpServletRequest request = post("/api/v1/auth/register");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        // expire must be called when count == 1
        verify(redis).expire(anyString(), eq(Duration.ofSeconds(3600L)));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private MockHttpServletRequest post(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        // RateLimitFilter matches on getServletPath(), which MockHttpServletRequest
        // does not derive from the request URI
        request.setServletPath(path);
        return request;
    }
}
