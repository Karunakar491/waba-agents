package com.metaagent.platform.domain.persona.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.persona.dto.BusinessProfileDtos.SaveRequest;
import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
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
 * Integration tests for BusinessProfileDeployService — Wave 1b (2026-08-03):
 * business_info backfill (real Meta-side data with zero local row, same bug
 * class already fixed for Skills/FAQs/Files/Websites) and the null-wipe fix
 * on a documented full-replace endpoint. Real MySQL via Testcontainers.
 * MetaApiClient is @MockBean — never calls real Meta APIs.
 */
class BusinessProfileDeployServiceTest extends IntegrationTestBase {

    @Autowired
    private BusinessProfileDeployService service;

    @Autowired
    private BusinessProfileRepository repository;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Test Company")
                .email("persona-svc-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        repository.deleteAll();
        agentRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // getLive() backfill (EL-approved after fixing a real concurrency bug:
    // the first draft rejected this fix because two concurrent getLive()
    // calls on the same never-backfilled number could each save their own
    // DEPLOYED row — an Optional lookup on that number would then throw
    // IncorrectResultSizeDataAccessException forever after).
    // -------------------------------------------------------------------------

    @Test
    void should_backfill_from_live_meta_data_when_no_local_row_exists() {
        String phoneNumberId = "700000101";
        boundAgent(phoneNumberId);
        when(metaApiClient.get(contains("/agent_config/business_info"), eq(Map.class)))
                .thenReturn(Map.of(
                        "payment_method", "Cash, UPI",
                        "business_description", "We sell cakes.",
                        "contact_info", Map.of("email", "hi@example.com")));

        BusinessProfile live = service.getLive(phoneNumberId);

        assertThat(live).isNotNull();
        assertThat(live.getPaymentMethod()).isEqualTo("Cash, UPI");
        assertThat(live.getBusinessDescription()).isEqualTo("We sell cakes.");
        assertThat(live.getContactEmail()).isEqualTo("hi@example.com");
        assertThat(live.getStatus()).isEqualTo(BusinessProfile.Status.DEPLOYED);
        assertThat(live.getAccountId()).isEqualTo(accountId);
    }

    @Test
    void should_return_null_without_saving_anything_when_meta_has_no_business_info() {
        String phoneNumberId = "700000102";
        boundAgent(phoneNumberId);
        when(metaApiClient.get(contains("/agent_config/business_info"), eq(Map.class)))
                .thenReturn(Map.of());

        BusinessProfile live = service.getLive(phoneNumberId);

        assertThat(live).isNull();
        assertThat(repository.findAll()).isEmpty();
    }

    @Test
    void should_never_create_a_second_deployed_row_for_the_same_phone_number() {
        String phoneNumberId = "700000103";
        boundAgent(phoneNumberId);
        when(metaApiClient.get(contains("/agent_config/business_info"), eq(Map.class)))
                .thenReturn(Map.of("business_description", "Real live data."));

        // Sequential calls simulate the race the EL review flagged: the
        // second call must find the row created by the first (re-checked
        // inside the same per-phone-number lock) rather than saving a
        // second DEPLOYED row for this number.
        BusinessProfile first = service.getLive(phoneNumberId);
        BusinessProfile second = service.getLive(phoneNumberId);

        assertThat(first.getId()).isEqualTo(second.getId());
        assertThat(repository.findAllByPhoneNumberIdAndStatusOrderByArchivedAtDesc(phoneNumberId, BusinessProfile.Status.ARCHIVED))
                .isEmpty();
        long deployedCount = repository.findAll().stream()
                .filter(p -> phoneNumberId.equals(p.getPhoneNumberId()) && p.getStatus() == BusinessProfile.Status.DEPLOYED)
                .count();
        assertThat(deployedCount).isEqualTo(1);
        // Second call must not have re-hit Meta — it found the row inside the lock.
        verify(metaApiClient, times(1)).get(contains("/agent_config/business_info"), eq(Map.class));
    }

    // -------------------------------------------------------------------------
    // deploy() — putBusinessInfo empty-payload guard
    // -------------------------------------------------------------------------

    @Test
    void should_reject_deploying_a_draft_with_no_fields_filled_in() {
        String phoneNumberId = "700000104";
        boundAgent(phoneNumberId);
        BusinessProfile emptyDraft = service.createDraft(new SaveRequest(null, null, null, null, null, null, null, null));
        when(metaApiClient.get(contains("/agent_config/business_info"), eq(Map.class)))
                .thenReturn(Map.of());

        assertThatThrownBy(() -> service.deploy(emptyDraft.getId(), phoneNumberId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("no fields filled in");

        verify(metaApiClient, never()).put(anyString(), anyMap(), any());
    }

    @Test
    void should_deploy_a_partially_filled_draft_without_sending_nulls() {
        String phoneNumberId = "700000105";
        boundAgent(phoneNumberId);
        BusinessProfile draft = service.createDraft(new SaveRequest(
                "UPI only", null, null, null, null, null, null, null));
        when(metaApiClient.get(contains("/agent_config/business_info"), eq(Map.class)))
                .thenReturn(Map.of());
        when(metaApiClient.put(contains("/agent_config/business_info"), anyMap(), eq(Map.class)))
                .thenReturn(Map.of("success", true));

        service.deploy(draft.getId(), phoneNumberId);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<Map<String, Object>> captor = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(metaApiClient).put(anyString(), captor.capture(), eq(Map.class));
        Map<String, Object> sent = captor.getValue();
        assertThat(sent).containsEntry("payment_method", "UPI only");
        assertThat(sent).doesNotContainKey("return_policy");
        assertThat(sent).doesNotContainKey("business_description");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** PhoneNumberAccessGuard requires an Agent row owning this phone number. */
    private void boundAgent(String phoneNumberId) {
        agentRepository.save(Agent.builder()
                .accountId(accountId)
                .phoneNumberId(phoneNumberId)
                .displayName("Test Agent")
                .enabled(true)
                .status(Agent.Status.active)
                .build());
    }

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
