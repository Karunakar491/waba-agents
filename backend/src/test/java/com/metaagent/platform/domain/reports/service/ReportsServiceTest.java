package com.metaagent.platform.domain.reports.service;

import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration tests for ReportsService.
 *
 * Real MySQL via Testcontainers (from IntegrationTestBase).
 * MetaApiClient is @MockBean — never calls real Meta APIs.
 */
class ReportsServiceTest extends IntegrationTestBase {

    @Autowired
    private ReportsService reportsService;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Test Company")
                .email("reports-test-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        agentRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Eval id URL-encoding — ids can contain characters (e.g. "&", "#") that
    // break the query string if concatenated raw.
    // -------------------------------------------------------------------------

    @Test
    void should_url_encode_eval_case_ids_when_running_eval() {
        Agent agent = agentRepository.save(draftAgent("900000001"));
        when(metaApiClient.post(anyString(), any(), eq(Map.class))).thenReturn(Map.of("job_id", "job-1"));

        String unsafeId = "case&1#pfbid";
        reportsService.runEval(agent.getId(), unsafeId, Map.of());

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).post(pathCaptor.capture(), any(), eq(Map.class));

        String path = pathCaptor.getValue();
        assertThat(path).contains("eval_case_ids=case%261%23pfbid");
        assertThat(path).doesNotContain("case&1#pfbid");
    }

    @Test
    void should_url_encode_eval_ids_when_getting_eval_details() {
        Agent agent = agentRepository.save(draftAgent("900000002"));
        when(metaApiClient.get(anyString(), eq(Map.class))).thenReturn(Map.of());

        String unsafeId = "eval&2#x";
        reportsService.getEvalDetails(agent.getId(), unsafeId);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).get(pathCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("eval_ids=eval%262%23x");
    }

    @Test
    void should_url_encode_summary_ids_when_getting_eval_summary() {
        Agent agent = agentRepository.save(draftAgent("900000003"));
        when(metaApiClient.get(anyString(), eq(Map.class))).thenReturn(Map.of());

        String unsafeId = "summary&3#y";
        reportsService.getEvalSummary(agent.getId(), unsafeId);

        ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
        verify(metaApiClient).get(pathCaptor.capture(), eq(Map.class));

        assertThat(pathCaptor.getValue()).contains("summary_ids=summary%263%23y");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Agent draftAgent(String phoneNumberId) {
        return Agent.builder()
                .accountId(accountId)
                .phoneNumberId(phoneNumberId)
                .displayName("Test Agent")
                .enabled(false)
                .status(Agent.Status.draft)
                .build();
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
