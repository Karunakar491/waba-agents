package com.metaagent.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.user.entity.AccountModule;
import com.metaagent.platform.domain.user.repository.AccountModuleRepository;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
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
 * HTTP-level coverage for ModuleAccessFilter — the gate EL flagged as
 * untested. Registration seeds BUSINESS_AGENTS=true (SecurityService), so
 * the "deny" cases explicitly flip the row off rather than deleting it,
 * proving the filter (not just the missing-row default) does the blocking.
 */
@AutoConfigureMockMvc
class ModuleAccessFilterTest extends IntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private AccountModuleRepository accountModuleRepository;
    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    @Test
    void should_allow_gated_request_when_module_enabled() throws Exception {
        String accessToken = registerAndLogin();

        mockMvc.perform(get("/api/v1/agents").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isOk());
    }

    @Test
    void should_reject_gated_request_with_403_when_module_disabled() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        AccountModule row = accountModuleRepository.findByAccountIdAndModule(account.getId(), AccountModule.Module.BUSINESS_AGENTS).orElseThrow();
        row.setEnabled(false);
        accountModuleRepository.save(row);

        String accessToken = loginAndGetAccessToken(email);

        mockMvc.perform(get("/api/v1/agents").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void should_deny_when_account_module_row_missing_entirely() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        accountModuleRepository.findByAccountIdAndModule(account.getId(), AccountModule.Module.BUSINESS_AGENTS)
                .ifPresent(accountModuleRepository::delete);

        String accessToken = loginAndGetAccessToken(email);

        mockMvc.perform(get("/api/v1/agents").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void should_exempt_entitlements_endpoint_even_when_module_disabled() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        AccountModule row = accountModuleRepository.findByAccountIdAndModule(account.getId(), AccountModule.Module.BUSINESS_AGENTS).orElseThrow();
        row.setEnabled(false);
        accountModuleRepository.save(row);
        String accessToken = loginAndGetAccessToken(email);

        mockMvc.perform(get("/api/v1/modules/entitlements").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isOk());
    }

    @Test
    void should_allow_unauthenticated_auth_endpoints_regardless_of_module_state() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "nobody@example.com", "password", "wrong"))))
                .andExpect(status().isUnauthorized()); // rejected for bad credentials, NOT the module filter (403 vs 401)
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String uniqueEmail() {
        return "test+" + UUID.randomUUID() + "@example.com";
    }

    private void registerUser(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "companyName", "Test Co", "email", email, "password", "Password1!"))))
                .andExpect(status().isOk());
    }

    private String registerAndLogin() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        return loginAndGetAccessToken(email);
    }

    private String loginAndGetAccessToken(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "Password1!"))))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpServletResponse response = result.getResponse();
        String setCookie = response.getHeaders("Set-Cookie").stream()
                .filter(h -> h.startsWith("access_token="))
                .findFirst()
                .orElseThrow();
        String nameValue = setCookie.split(";")[0];
        return nameValue.substring(nameValue.indexOf('=') + 1);
    }
}
