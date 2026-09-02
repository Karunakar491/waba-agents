package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Plain Mockito unit test for WabaService.validate()'s Meta-response mapping
 * — deliberately NOT extending IntegrationTestBase (no Spring context, no
 * Testcontainers/Docker/MySQL required). validate()'s Meta-mapping logic
 * touches no database rows for the cases below (agentRepository is mocked
 * to always report "no agent bound"), so a real database buys nothing here.
 *
 * Exists specifically to cover the status field (root cause of the
 * 2026-08-25..09-01 production incident: a phone number still PENDING
 * registration on Meta's side was shown as a normal, selectable option, and
 * provisioning a BizAI agent on it always failed server-side on Meta's end
 * with a raw 500) in an environment where Docker/Testcontainers isn't
 * available — see WabaServiceTest for the Testcontainers-backed coverage of
 * the same validate() method (agent-binding, caching, full DB round-trip).
 */
class WabaServiceValidateStatusTest {

    private static final String PHONE_FIELDS =
            "id,display_phone_number,verified_name,quality_rating,name_status,messaging_limit_tier,status";

    private final MetaApiClient metaApiClient = mock(MetaApiClient.class);
    private final AgentRepository agentRepository = mock(AgentRepository.class);

    private final WabaService wabaService = new WabaService(
            mock(WabaRepository.class),
            mock(WabaAccountAccessRepository.class),
            mock(WabaAccessGuard.class),
            mock(WabaAgentReconciliationService.class),
            mock(PhoneNumberAccessGuard.class),
            agentRepository,
            mock(AgentService.class),
            mock(PhoneNumberSnapshotRepository.class),
            metaApiClient,
            mock(ThreadPoolTaskExecutor.class)
    );

    @BeforeEach
    void setUp() {
        when(agentRepository.findByPhoneNumberId(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(Optional.empty());

        TenantDetails tenantDetails = new TenantDetails(1L, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void threads_through_connected_status_for_a_ready_number() {
        String wabaId = "123456789";
        stubMeta(wabaId, Map.of(
                "id", "111222333",
                "display_phone_number", "+1 555 0100",
                "verified_name", "Test Business",
                "status", "CONNECTED"
        ));

        WabaDtos.ValidateResponse result = wabaService.validate(wabaId);

        assertThat(result.phoneNumbers().get(0).status()).isEqualTo("CONNECTED");
    }

    // Root cause of the 2026-08-25..09-01 production incident.
    @Test
    void threads_through_pending_status_for_a_not_yet_connected_number() {
        String wabaId = "123456789";
        stubMeta(wabaId, Map.of(
                "id", "111222333",
                "display_phone_number", "+1 555 0100",
                "verified_name", "Test Business",
                "status", "PENDING"
        ));

        WabaDtos.ValidateResponse result = wabaService.validate(wabaId);

        assertThat(result.phoneNumbers().get(0).status()).isEqualTo("PENDING");
    }

    // Meta omitting the field entirely must fail closed the same way a
    // recognized non-CONNECTED value does — never default to something a
    // caller could misread as ready.
    @Test
    void defaults_status_to_empty_string_when_meta_omits_the_field() {
        String wabaId = "123456789";
        stubMeta(wabaId, Map.of(
                "id", "111222333",
                "display_phone_number", "+1 555 0100",
                "verified_name", "Test Business"
        ));

        WabaDtos.ValidateResponse result = wabaService.validate(wabaId);

        assertThat(result.phoneNumbers().get(0).status()).isEqualTo("");
    }

    @Test
    void requests_status_field_explicitly_from_meta_graph_api() {
        String wabaId = "123456789";
        stubMeta(wabaId, Map.of(
                "id", "111222333",
                "display_phone_number", "+1 555 0100",
                "verified_name", "Test Business",
                "status", "CONNECTED"
        ));

        wabaService.validate(wabaId);

        // Verifies the exact query string includes status= — this is the
        // actual production bug: the field was never requested from Meta at
        // all, so the frontend had no way to know a number wasn't ready.
        org.mockito.Mockito.verify(metaApiClient).graphGet(
                eq("/" + wabaId + "/phone_numbers?fields=" + PHONE_FIELDS), eq(Map.class));
    }

    private void stubMeta(String wabaId, Map<String, Object> phone) {
        when(metaApiClient.graphGet(eq("/" + wabaId + "?fields=id,name"), eq(Map.class)))
                .thenReturn(Map.of("id", wabaId, "name", "Test WABA"));
        when(metaApiClient.graphGet(eq("/" + wabaId + "/phone_numbers?fields=" + PHONE_FIELDS), eq(Map.class)))
                .thenReturn(Map.of("data", List.of(phone)));
    }
}
