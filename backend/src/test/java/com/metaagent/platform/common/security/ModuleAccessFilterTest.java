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
    // Iris shared-path gating (2026-08-18) — TEMPLATE_STUDIO OR BUSINESS_AGENTS
    // -------------------------------------------------------------------------

    @Test
    void should_allow_iris_when_only_template_studio_enabled() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        setModuleEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS, false);
        setModuleEnabled(account.getId(), AccountModule.Module.TEMPLATE_STUDIO, true);
        String accessToken = loginAndGetAccessToken(email);

        mockMvc.perform(get("/api/v1/templates/iris/sessions").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isOk());
    }

    @Test
    void should_allow_iris_when_only_business_agents_enabled() throws Exception {
        String accessToken = registerAndLogin(); // BUSINESS_AGENTS enabled by default, TEMPLATE_STUDIO not granted

        mockMvc.perform(get("/api/v1/templates/iris/sessions").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isOk());
    }

    @Test
    void should_allow_new_iris_path_when_only_business_agents_enabled() throws Exception {
        // /api/v1/iris is the permanent path (added 2026-08-18, IrisController
        // now answers both prefixes); must resolve identically to the old
        // /api/v1/templates/iris path above until the old path is removed.
        String accessToken = registerAndLogin();

        mockMvc.perform(get("/api/v1/iris/sessions").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isOk());
    }

    @Test
    void should_reject_new_iris_path_when_neither_module_enabled() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        setModuleEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS, false);
        String accessToken = loginAndGetAccessToken(email);

        mockMvc.perform(get("/api/v1/iris/sessions").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void should_reject_iris_when_neither_module_enabled() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        setModuleEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS, false);
        String accessToken = loginAndGetAccessToken(email);

        mockMvc.perform(get("/api/v1/templates/iris/sessions").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void should_still_require_template_studio_only_for_non_iris_template_paths() throws Exception {
        String accessToken = registerAndLogin(); // BUSINESS_AGENTS enabled, TEMPLATE_STUDIO not granted

        mockMvc.perform(get("/api/v1/templates").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void should_require_template_studio_for_bare_templates_path_no_trailing_slash() throws Exception {
        // Regression test for the bare-path fallthrough bug caught in EL review:
        // "/api/v1/templates" (no trailing slash) must not fall through to the
        // BUSINESS_AGENTS default — it must still require TEMPLATE_STUDIO, exactly
        // like every other /api/v1/templates/** path. No controller currently maps
        // this exact route, but the filter runs ahead of routing so its 403
        // decision (or lack thereof) is provable independent of a handler existing.
        String email = uniqueEmail();
        registerUser(email);
        BusinessAccount account = businessAccountRepository.findByEmail(email).orElseThrow();
        setModuleEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS, false);
        setModuleEnabled(account.getId(), AccountModule.Module.TEMPLATE_STUDIO, true);
        String accessToken = loginAndGetAccessToken(email);

        MvcResult result = mockMvc.perform(get("/api/v1/templates").cookie(new jakarta.servlet.http.Cookie("access_token", accessToken)))
                .andReturn();

        // TEMPLATE_STUDIO is enabled, so the filter must let this through (not 403).
        // Whether a controller handler exists for the bare path is a separate,
        // unrelated concern (would surface as 404, still proving the filter passed it).
        assertThat(result.getResponse().getStatus()).isNotEqualTo(403);
    }

    private void setModuleEnabled(Long accountId, AccountModule.Module module, boolean enabled) {
        AccountModule row = accountModuleRepository.findByAccountIdAndModule(accountId, module)
                .orElseGet(() -> accountModuleRepository.save(newModuleRow(accountId, module)));
        row.setEnabled(enabled);
        accountModuleRepository.save(row);
    }

    private AccountModule newModuleRow(Long accountId, AccountModule.Module module) {
        AccountModule row = new AccountModule();
        row.setAccountId(accountId);
        row.setModule(module);
        row.setEnabled(false);
        return row;
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
