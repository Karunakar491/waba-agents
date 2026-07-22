package com.metaagent.platform.domain.analytics.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.analytics.entity.AgentPerformanceHourly;
import com.metaagent.platform.domain.analytics.repository.AgentPerformanceHourlyRepository;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration tests for AnalyticsService.
 *
 * Verifies ownership check (verifyAgentOwnership) fires BEFORE any query —
 * closing the empty-data bypass bug where a cross-tenant call with no analytics
 * data would silently succeed with a 200 and empty metrics.
 */
class AnalyticsServiceTest extends IntegrationTestBase {

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private AgentRepository agentRepository;

    @Autowired
    private AgentPerformanceHourlyRepository agentPerformanceHourlyRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    private Long tenantAAccountId;
    private Long tenantBAccountId;

    @BeforeEach
    void setUp() {
        BusinessAccount tenantA = businessAccountRepository.save(BusinessAccount.builder()
                .name("Tenant A")
                .email("analytics-a-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        tenantAAccountId = tenantA.getId();

        BusinessAccount tenantB = businessAccountRepository.save(BusinessAccount.builder()
                .name("Tenant B")
                .email("analytics-b-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        tenantBAccountId = tenantB.getId();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        agentPerformanceHourlyRepository.deleteAll();
        agentRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // getAgentSummaryMetrics — owner path
    // -------------------------------------------------------------------------

    @Test
    void owner_with_hourly_data_gets_summary_metrics() {
        Agent agent = agentRepository.save(draftAgent(tenantAAccountId));
        LocalDateTime hour = LocalDateTime.now().minusHours(2).withMinute(0).withSecond(0).withNano(0);
        agentPerformanceHourlyRepository.save(AgentPerformanceHourly.builder()
                .accountId(tenantAAccountId)
                .agentId(agent.getId())
                .hour(hour)
                .messagesReceived(10)
                .messagesSent(8)
                .conversationsOpened(3)
                .conversationsClosed(2)
                .avgResponseMs(250.0)
                .p95ResponseMs(400.0)
                .errors(0)
                .build());

        authenticateAs(tenantAAccountId);

        LocalDateTime start = hour.minusHours(1);
        LocalDateTime end = hour.plusHours(1);
        Map<String, Object> summary = analyticsService.getAgentSummaryMetrics(agent.getId(), start, end);

        assertThat(summary).containsKey("totalConversations");
        assertThat(summary).containsKey("resolutionRate");
        assertThat(summary).containsKey("avgResponseTimeMs");
    }

    @Test
    void owner_with_no_data_gets_zero_summary() {
        Agent agent = agentRepository.save(draftAgent(tenantAAccountId));
        authenticateAs(tenantAAccountId);

        LocalDateTime start = LocalDateTime.now().minusDays(7);
        LocalDateTime end = LocalDateTime.now();
        Map<String, Object> summary = analyticsService.getAgentSummaryMetrics(agent.getId(), start, end);

        // 200 path — must return map with zero values, not throw
        assertThat(summary).containsKey("totalConversations");
        assertThat(summary).containsKey("resolutionRate");
        Number total = (Number) summary.get("totalConversations");
        assertThat(total.longValue()).isEqualTo(0L);
        Number rate = (Number) summary.get("resolutionRate");
        assertThat(rate.doubleValue()).isEqualTo(0.0);
    }

    // -------------------------------------------------------------------------
    // Cross-tenant ownership checks
    // -------------------------------------------------------------------------

    @Test
    void cross_tenant_getAgentSummaryMetrics_throws_NotFoundException_even_when_no_analytics_data() {
        // Tenant A owns the agent — no analytics rows at all (empty-data bypass bug scenario)
        Agent tenantAAgent = agentRepository.save(draftAgent(tenantAAccountId));
        authenticateAs(tenantBAccountId); // Tenant B tries to read Tenant A's agent

        LocalDateTime start = LocalDateTime.now().minusDays(7);
        LocalDateTime end = LocalDateTime.now();

        assertThatThrownBy(() -> analyticsService.getAgentSummaryMetrics(tenantAAgent.getId(), start, end))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Agent not found");
    }

    @Test
    void cross_tenant_getHourlyAnalytics_throws_NotFoundException() {
        Agent tenantAAgent = agentRepository.save(draftAgent(tenantAAccountId));
        authenticateAs(tenantBAccountId);

        LocalDateTime start = LocalDateTime.now().minusDays(7);
        LocalDateTime end = LocalDateTime.now();

        assertThatThrownBy(() -> analyticsService.getHourlyAnalytics(tenantAAgent.getId(), start, end))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Agent not found");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Agent draftAgent(Long accountId) {
        return Agent.builder()
                .accountId(accountId)
                .displayName("Analytics Test Agent")
                .enabled(false)
                .status(Agent.Status.draft)
                .build();
    }

    private void authenticateAs(Long accountId) {
        TenantDetails tenantDetails = new TenantDetails(accountId, 1L, "ROLE_USER");
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
