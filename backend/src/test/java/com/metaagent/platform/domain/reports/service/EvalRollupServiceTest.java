package com.metaagent.platform.domain.reports.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Regression test for the 2026-08-05 fix: poll(jobId) had no account-ownership
 * check at all — any authenticated account could read another account's eval
 * results by guessing/observing a job UUID. Tracked in TASKS.md, closed
 * alongside the WabaAccessGuard extraction (same audit, same category of gap).
 */
class EvalRollupServiceTest {

    private MockedStatic<SecurityContextHelper> securityContext;

    @AfterEach
    void tearDown() {
        if (securityContext != null) {
            securityContext.close();
        }
    }

    private void mockAccountId(Long accountId) {
        securityContext = Mockito.mockStatic(SecurityContextHelper.class);
        securityContext.when(SecurityContextHelper::getRequiredAccountId).thenReturn(accountId);
    }

    private EvalRollupService newServiceWithNoAccessibleAgents() {
        AgentAccessService agentAccessService = Mockito.mock(AgentAccessService.class);
        Mockito.when(agentAccessService.listAccessible(Mockito.any())).thenReturn(List.of());
        return new EvalRollupService(new EvalRollupWorker(agentAccessService, null));
    }

    @Test
    void should_return_job_when_polling_account_owns_it() {
        EvalRollupService service = newServiceWithNoAccessibleAgents();
        mockAccountId(100L);
        String jobId = service.start();

        var response = service.poll(jobId);

        assertEquals(jobId, response.get("jobId"));
    }

    @Test
    void should_throw_not_found_when_polling_account_does_not_own_job() {
        EvalRollupService service = newServiceWithNoAccessibleAgents();
        mockAccountId(100L);
        String jobId = service.start();
        securityContext.close();

        mockAccountId(200L);

        assertThrows(NotFoundException.class, () -> service.poll(jobId));
    }

    @Test
    void should_throw_not_found_for_unknown_job_id() {
        EvalRollupService service = newServiceWithNoAccessibleAgents();
        mockAccountId(100L);

        assertThrows(NotFoundException.class, () -> service.poll("does-not-exist"));
    }
}
