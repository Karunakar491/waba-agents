package com.metaagent.platform.domain.scheduler;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.agent.service.AgentDetailSyncService;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.waba.service.PhoneNumberSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Closes the gap every domain's own reconciliation already had: each one
 * (PhoneNumberSyncService, Agent.reconcileStatus, AgentService's 4
 * ensure*Backfilled/reconcile* pairs) only ever fired reactively — on login,
 * on WABA-connect, or on someone opening one specific agent's own page. An
 * account nobody logs into, or an agent nobody ever clicks into, could drift
 * from Meta indefinitely (confirmed live 2026-08-02: 5 imported agents sat at
 * 0 FAQs/skills for however long, until this exact gap got found and closed
 * per-domain). This class is the missing clock — it doesn't replace any of
 * those reactive paths (still fire immediately for whoever's actually looking
 * at the screen), it just guarantees a ceiling on how stale anything can get
 * for accounts/agents nobody's touched recently.
 *
 * Two tiers, deliberately different cadence and cost:
 *   - Tier 1 (phone numbers + agent status): cheap, drives the Dashboard's
 *     "needs attention" view, runs every 20 minutes. Agent status is NOT a
 *     separate per-agent loop here — WabaService.listAllPhonesForAccountId
 *     (called by PhoneNumberSyncService.syncForAccount) already calls
 *     reconcileStatus for every bound agent it sees as a side effect of
 *     building the phone list. A first version of this class ran a second,
 *     separate reconcileStatus loop here too — confirmed live via
 *     api_call_log that every bound phone number's agent_config/settings was
 *     genuinely being fetched twice per tick. Removed; tier 1 is phone sync
 *     only now.
 *   - Tier 2 (Skills/FAQs/Files/Websites per agent): up to 4 Meta calls per
 *     agent per cycle — real cost at scale — runs hourly. No equivalent
 *     existing side effect covers these, so this tier does its own explicit
 *     per-agent loop.
 *
 * Every Meta call this class triggers (directly or via PhoneNumberSyncService)
 * runs with BackgroundCallContext set for the relevant accountId, so
 * api_call_log.account_id is populated instead of NULL — confirmed live that
 * background-thread calls were landing in the audit table correctly but
 * invisible on any account's own Reports > API Calls page (which filters by
 * account_id) before this was wired in.
 *
 * Tier 2's agents are deduped by id before its per-agent loop: a WABA shared
 * across N accounts (the 2026-07-28 decoupling's whole point) would otherwise
 * get the same agent synced N times per cycle via each account's own
 * listAccessible() call — wasted Meta calls, real rate-limit risk at scale.
 * Each agent is synced exactly once per cycle, using the agent's own stored
 * accountId (its creator stamp — informational only, see Agent.accountId's
 * own javadoc) for the backfill methods' account_id column, not whichever
 * account happened to be iterated when it was first seen.
 *
 * Per-account and per-agent try/catch throughout: one account's or one
 * agent's Meta failure (rate limit, bad test number, whatever) must never
 * stop the loop for everyone else, mirroring the same "never let one item's
 * failure break the batch" rule already established in EvalRollupWorker and
 * PhoneNumberSyncService's own partial-failure handling.
 *
 * AtomicBoolean overlap guards, not a distributed lock (ShedLock etc. isn't
 * in TECH-STACK.md and this runs on a single instance today) — if a cycle
 * ever runs longer than its own interval, the next scheduled fire skips
 * instead of overlapping.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GlobalSyncScheduler {

    private final BusinessAccountRepository businessAccountRepository;
    private final AgentAccessService agentAccessService;
    private final PhoneNumberSyncService phoneNumberSyncService;
    private final AgentDetailSyncService agentDetailSyncService;

    private final AtomicBoolean tier1Running = new AtomicBoolean(false);
    private final AtomicBoolean tier2Running = new AtomicBoolean(false);

    /** Every distinct agent visible to any account, id-deduped. See class javadoc. */
    private Map<Long, Agent> collectDistinctAccessibleAgents(List<BusinessAccount> accounts) {
        Map<Long, Agent> byId = new LinkedHashMap<>();
        for (BusinessAccount account : accounts) {
            try {
                for (Agent agent : agentAccessService.listAccessible(account.getId())) {
                    byId.putIfAbsent(agent.getId(), agent);
                }
            } catch (Exception e) {
                log.warn("Agent discovery failed for accountId={}: {}", account.getId(), e.getMessage());
            }
        }
        return byId;
    }

    @Scheduled(cron = "0 */20 * * * *")
    public void syncPhoneNumbersAndAgentStatus() {
        if (!tier1Running.compareAndSet(false, true)) {
            log.warn("Tier-1 sync (phone numbers + agent status) still running from last tick — skipping this one");
            return;
        }
        try {
            List<BusinessAccount> accounts = businessAccountRepository.findAll();
            log.info("Tier-1 sync starting: {} accounts", accounts.size());
            for (BusinessAccount account : accounts) {
                try {
                    // Fire-and-forget, @Async on PhoneNumberSyncService itself —
                    // per-account, not deduped, since phone snapshot rows are
                    // scoped per (account_id, phone_number_id), not shared.
                    // Also reconciles every bound agent's status as a side
                    // effect (WabaService.listAllPhonesForAccountId) — see
                    // class javadoc for why that's not duplicated here.
                    phoneNumberSyncService.syncForAccount(account.getId());
                } catch (Exception e) {
                    log.warn("Tier-1: phone sync failed for accountId={}: {}", account.getId(), e.getMessage());
                }
            }
            log.info("Tier-1 sync complete");
        } finally {
            tier1Running.set(false);
        }
    }

    @Scheduled(cron = "0 0 * * * *")
    public void syncAgentDetails() {
        if (!tier2Running.compareAndSet(false, true)) {
            log.warn("Tier-2 sync (agent details) still running from last tick — skipping this one");
            return;
        }
        try {
            List<BusinessAccount> accounts = businessAccountRepository.findAll();
            Map<Long, Agent> agents = collectDistinctAccessibleAgents(accounts);
            log.info("Tier-2 sync starting: {} distinct agents", agents.size());
            // Same parallel fan-out AgentDetailSyncService uses for the login
            // trigger — this method isn't @Async itself (already running on
            // this @Scheduled method's own thread, not a request thread), it
            // just reuses the per-agent parallel logic + per-agent try/catch.
            agentDetailSyncService.syncAgentsInParallel(agents.values());
            log.info("Tier-2 sync complete");
        } finally {
            tier2Running.set(false);
        }
    }
}
