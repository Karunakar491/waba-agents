package com.metaagent.platform.domain.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.user.repository.UserRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP-level integration tests for AuthController.
 *
 * - Real MySQL and Redis via Testcontainers (from IntegrationTestBase)
 * - MockMvc for HTTP assertions — no port-level networking overhead
 * - Each test uses a unique email — no shared state between tests
 */
@AutoConfigureMockMvc
class AuthControllerTest extends IntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Returns a unique email address per test invocation. */
    private String uniqueEmail() {
        return "test+" + UUID.randomUUID() + "@example.com";
    }

    private String registerBody(String email) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "companyName", "Test Co",
                "email", email,
                "password", "Password1!"
        ));
    }

    private String loginBody(String email) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", "Password1!"
        ));
    }

    /**
     * Registers a fresh user and returns the email used.
     * Asserts 200 so callers can rely on the user existing.
     */
    private String registerUser() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isOk());
        return email;
    }

    /**
     * Logs in with the given email and returns the full MvcResult.
     * Callers extract cookies / body as needed.
     */
    private MvcResult loginUser(String email) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(email)))
                .andExpect(status().isOk())
                .andReturn();
    }

    /**
     * Extracts the value of a named Set-Cookie header from the response.
     * Returns the full header string so callers can assert on attributes.
     */
    private String getSetCookieHeader(MockHttpServletResponse response, String cookieName) {
        return response.getHeaders("Set-Cookie").stream()
                .filter(h -> h.startsWith(cookieName + "="))
                .findFirst()
                .orElse(null);
    }

    /**
     * Extracts the cookie value (the part before the first ";") from a Set-Cookie header.
     */
    private String extractCookieValue(String setCookieHeader) {
        if (setCookieHeader == null) return null;
        String nameValue = setCookieHeader.split(";")[0]; // "name=value"
        int eq = nameValue.indexOf('=');
        return eq >= 0 ? nameValue.substring(eq + 1) : null;
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    @Test
    void should_register_user_and_return_200_when_credentials_are_valid() throws Exception {
        String email = uniqueEmail();

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isOk());

        assertThat(userRepository.findByEmail(email)).isPresent();
    }

    @Test
    void should_return_400_when_register_request_is_missing_email() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "companyName", "Test Co",
                "password", "Password1!"
                // email intentionally omitted
        ));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // -------------------------------------------------------------------------
    // Login — cookie assertions
    // -------------------------------------------------------------------------

    @Test
    void should_return_200_and_set_access_token_cookie_when_credentials_are_correct() throws Exception {
        String email = registerUser();

        MvcResult result = loginUser(email);
        String setCookie = getSetCookieHeader(result.getResponse(), "access_token");

        assertThat(setCookie).isNotNull();
        assertThat(setCookie).containsIgnoringCase("HttpOnly");
    }

    @Test
    void should_return_200_and_set_refresh_token_cookie_when_credentials_are_correct() throws Exception {
        String email = registerUser();

        MvcResult result = loginUser(email);
        String setCookie = getSetCookieHeader(result.getResponse(), "refresh_token");

        assertThat(setCookie).isNotNull();
        assertThat(setCookie).containsIgnoringCase("HttpOnly");
    }

    @Test
    void should_not_return_tokens_in_response_body() throws Exception {
        String email = registerUser();

        MvcResult result = loginUser(email);
        String body = result.getResponse().getContentAsString();

        assertThat(body).doesNotContain("accessToken");
        assertThat(body).doesNotContain("refreshToken");
    }

    @Test
    void should_return_400_when_password_is_wrong() throws Exception {
        String email = registerUser();

        String wrongPasswordBody = objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", "WrongPassword!"
        ));

        // BusinessException("Invalid email or password") → GlobalExceptionHandler → 400 BAD_REQUEST
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongPasswordBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    void should_return_400_when_user_does_not_exist() throws Exception {
        String nonExistentEmail = uniqueEmail();

        String body = objectMapper.writeValueAsString(Map.of(
                "email", nonExistentEmail,
                "password", "Password1!"
        ));

        // BusinessException("Invalid email or password") → GlobalExceptionHandler → 400 BAD_REQUEST
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // -------------------------------------------------------------------------
    // Protected endpoint access
    // -------------------------------------------------------------------------

    @Test
    void should_return_401_when_accessing_protected_endpoint_without_cookie() throws Exception {
        mockMvc.perform(get("/api/v1/agents"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void should_return_200_when_accessing_protected_endpoint_with_valid_access_token_cookie() throws Exception {
        String email = registerUser();

        MvcResult loginResult = loginUser(email);
        String setCookieHeader = getSetCookieHeader(loginResult.getResponse(), "access_token");
        String tokenValue = extractCookieValue(setCookieHeader);

        assertThat(tokenValue).isNotBlank();

        mockMvc.perform(get("/api/v1/agents")
                        .cookie(new jakarta.servlet.http.Cookie("access_token", tokenValue)))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(401));
    }

    // -------------------------------------------------------------------------
    // Logout
    // -------------------------------------------------------------------------

    @Test
    void should_clear_auth_cookies_on_logout() throws Exception {
        String email = registerUser();

        MvcResult loginResult = loginUser(email);

        String accessSetCookie  = getSetCookieHeader(loginResult.getResponse(), "access_token");
        String refreshSetCookie = getSetCookieHeader(loginResult.getResponse(), "refresh_token");

        String accessValue  = extractCookieValue(accessSetCookie);
        String refreshValue = extractCookieValue(refreshSetCookie);

        assertThat(accessValue).isNotBlank();
        assertThat(refreshValue).isNotBlank();

        MvcResult logoutResult = mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(new jakarta.servlet.http.Cookie("access_token", accessValue))
                        .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshValue)))
                .andExpect(status().isOk())
                .andReturn();

        String clearedAccessCookie = getSetCookieHeader(logoutResult.getResponse(), "access_token");

        assertThat(clearedAccessCookie).isNotNull();
        assertThat(clearedAccessCookie).containsIgnoringCase("Max-Age=0");
    }
}
