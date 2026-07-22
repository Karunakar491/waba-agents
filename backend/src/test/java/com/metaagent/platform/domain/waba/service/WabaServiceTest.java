package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration tests for WabaService.
 *
 * Real MySQL via Testcontainers. MetaApiClient is @MockBean (from IntegrationTestBase).
 */
class WabaServiceTest extends IntegrationTestBase {

    @Autowired
    private WabaService wabaService;

    @Autowired
    private WabaRepository wabaRepository;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("WABA Test Co")
                .email("waba-svc-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        agentRepository.deleteAll();
        wabaRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // validate() — happy path
    // -------------------------------------------------------------------------

    @Test
    void validate_returns_waba_details_and_phone_list_when_meta_responds_ok() {
        String wabaId = "123456789";
        when(metaApiClient.get(eq("/" + wabaId + "?fields=id,name"), eq(Map.class)))
                .thenReturn(Map.of("id", wabaId, "name", "Test WABA"));
        when(metaApiClient.get(eq("/" + wabaId + "/phone_numbers"), eq(Map.class)))
                .thenReturn(Map.of("data", List.of(
                        Map.of("id", "111222333",
                               "display_phone_number", "+1 555 0100",
                               "verified_name", "Test Business")
                )));

        WabaDtos.ValidateResponse result = wabaService.validate(wabaId);

        assertThat(result.wabaId()).isEqualTo(wabaId);
        assertThat(result.wabaName()).isEqualTo("Test WABA");
        assertThat(result.phoneNumbers()).hasSize(1);
        assertThat(result.phoneNumbers().get(0).phoneNumberId()).isEqualTo("111222333");
        assertThat(result.phoneNumbers().get(0).alreadyConnected()).isFalse();
    }

    @Test
    void validate_marks_phone_as_connected_when_agent_uses_it() {
        String wabaId = "123456789";
        // Persist an agent using this phone
        agentRepository.save(Agent.builder()
                .accountId(accountId)
                .displayName("Bound Agent")
                .phoneNumberId("111222333")
                .enabled(true)
                .status(Agent.Status.active)
                .build());

        when(metaApiClient.get(eq("/" + wabaId + "?fields=id,name"), eq(Map.class)))
                .thenReturn(Map.of("id", wabaId, "name", "Test WABA"));
        when(metaApiClient.get(eq("/" + wabaId + "/phone_numbers"), eq(Map.class)))
                .thenReturn(Map.of("data", List.of(
                        Map.of("id", "111222333",
                               "display_phone_number", "+1 555 0100",
                               "verified_name", "Test Business")
                )));

        WabaDtos.ValidateResponse result = wabaService.validate(wabaId);

        WabaDtos.PhoneNumber phone = result.phoneNumbers().get(0);
        assertThat(phone.alreadyConnected()).isTrue();
        assertThat(phone.connectedAgentName()).isEqualTo("Bound Agent");
    }

    @Test
    void validate_throws_BusinessException_when_meta_returns_404() {
        String wabaId = "nonexistent";
        when(metaApiClient.get(contains("/" + wabaId), eq(Map.class)))
                .thenThrow(new MetaApiException(404));

        assertThatThrownBy(() -> wabaService.validate(wabaId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("doesn't exist on Meta");
    }

    @Test
    void validate_throws_BusinessException_when_meta_returns_403() {
        String wabaId = "forbidden";
        when(metaApiClient.get(contains("/" + wabaId), eq(Map.class)))
                .thenThrow(new MetaApiException(403));

        assertThatThrownBy(() -> wabaService.validate(wabaId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("managed by Karix");
    }

    // -------------------------------------------------------------------------
    // create() — persists with caller accountId
    // -------------------------------------------------------------------------

    @Test
    void create_persists_waba_with_caller_account_id() {
        String wabaId = "987654321";
        Waba waba = wabaService.create(wabaId, "My WABA");

        assertThat(waba.getId()).isNotNull();
        assertThat(waba.getAccountId()).isEqualTo(accountId);
        assertThat(waba.getWabaId()).isEqualTo(wabaId);
        assertThat(waba.getLabel()).isEqualTo("My WABA");
        assertThat(waba.getStatus()).isEqualTo(Waba.Status.active);

        // Persisted
        assertThat(wabaRepository.findById(waba.getId())).isPresent();
    }

    @Test
    void create_is_idempotent_when_same_waba_registered_twice() {
        String wabaId = "987654321";
        Waba first = wabaService.create(wabaId, "First Label");
        Waba second = wabaService.create(wabaId, "Second Label");

        // Same row updated — one record exists
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getLabel()).isEqualTo("Second Label");
        assertThat(wabaRepository.findAllByAccountId(accountId)).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // list() — returns only caller's WABAs
    // -------------------------------------------------------------------------

    @Test
    void list_returns_only_wabasfor_caller_account() {
        wabaRepository.save(Waba.builder().accountId(accountId).wabaId("aaa111").build());
        wabaRepository.save(Waba.builder().accountId(accountId).wabaId("bbb222").build());

        // Different account — must not appear
        BusinessAccount other = businessAccountRepository.save(BusinessAccount.builder()
                .name("Other Co").email("other-waba-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed").build());
        wabaRepository.save(Waba.builder().accountId(other.getId()).wabaId("ccc333").build());

        List<Waba> result = wabaService.list();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(Waba::getAccountId).containsOnly(accountId);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void authenticateAs(Long targetAccountId) {
        TenantDetails tenantDetails = new TenantDetails(targetAccountId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        authentication.setDetails(tenantDetails);

        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }
}
