package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.security.BackgroundCallContext;
import com.metaagent.platform.domain.agent.entity.Agent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Skills/FAQs/Files/Websites backfill+reconcile for a whole account's worth
 * of agents, run in parallel (same bounded metaSyncExecutor WabaService uses
 * for its own Dashboard fan-out). Two entry points, same underlying fan-out:
 *
 *   - syncForAccount(accountId): @Async, fire-and-forget from login —
 *     mirrors PhoneNumberSyncService's own login-trigger shape exactly (own
 *     class, so Spring's @Async proxy applies — a self-invoked @Async method
 *     on the same class silently runs synchronously, same reason every other
 *     @Async service in this codebase is its own class).
 *   - syncAgentsInParallel(agents): the actual fan-out, NOT @Async itself —
 *     GlobalSyncScheduler's tier-2 already runs on its own @Scheduled thread
 *     (not a request thread), so it calls this directly rather than through
 *     another @Async wrapper.
 *
 * Before this, agent details only ever refreshed reactively (someone opening
 * that one agent's own page) or on GlobalSyncScheduler's hourly tier-2 tick —
 * up to an hour of staleness for an account that just logged in and expects
 * to see current data immediately. This closes that gap for the login path
 * specifically, same "never block, best-effort" contract as
 * PhoneNumberSyncService: a Meta failure here just means the reactive/hourly
 * paths remain the fallback, exactly as before this existed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentDetailSyncService {

    private final AgentAccessService agentAccessService;
    private final AgentService agentService;
    @Qualifier("metaSyncExecutor")
    private final ThreadPoolTaskExecutor metaSyncExecutor;

    @Async
    public void syncForAccount(Long accountId) {
        try {
            List<Agent> agents = agentAccessService.listAccessible(accountId);
            syncAgentsInParallel(agents);
        } catch (Exception e) {
            log.warn("Login agent-detail sync failed for accountId={}: {}", accountId, e.getMessage());
        }
    }

    public void syncAgentsInParallel(Collection<Agent> agents) {
        List<CompletableFuture<Void>> futures = agents.stream()
                .map(agent -> CompletableFuture.runAsync(() -> {
                    BackgroundCallContext.set(agent.getAccountId());
                    try {
                        agentService.syncAgentDetails(agent, agent.getAccountId());
                    } catch (Exception e) {
                        log.warn("Agent-detail sync failed for agentId={}: {}", agent.getId(), e.getMessage());
                    } finally {
                        BackgroundCallContext.clear();
                    }
                }, metaSyncExecutor))
                .toList();
        futures.forEach(CompletableFuture::join);
    }
}
