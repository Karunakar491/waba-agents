package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.id.TsidGenerator;
import com.metaagent.platform.common.security.BackgroundCallContext;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

/**
 * Runs phone-number/agent-status sync asynchronously, on its own thread,
 * after login — never blocks the login response (TASK-055). Separated from
 * WabaService to allow Spring's @Async proxy to apply correctly (a
 * self-invoked @Async method on the same class silently runs synchronously
 * — same pattern already established in WebsiteCrawlService/EvalRollupWorker).
 *
 * Best-effort: a Meta failure here just means the cache stays whatever it
 * was (empty on first login, or last-known-good after that) — the Dashboard
 * falls back to a live call if the cache is empty. Never throws.
 */
@Slf4j
@Service
public class PhoneNumberSyncService {

    private static final int MAX_ATTEMPTS = 3;

    private final WabaService wabaService;
    private final PhoneNumberSnapshotRepository snapshotRepository;
    private final TransactionTemplate requiresNewTransaction;

    public PhoneNumberSyncService(WabaService wabaService,
                                   PhoneNumberSnapshotRepository snapshotRepository,
                                   PlatformTransactionManager transactionManager) {
        this.wabaService = wabaService;
        this.snapshotRepository = snapshotRepository;
        this.requiresNewTransaction = new TransactionTemplate(transactionManager);
        this.requiresNewTransaction.setPropagationBehavior(Propagation.REQUIRES_NEW.value());
    }

    /**
     * TASK-056 bug, caught live via an actual repro (not by review, and NOT
     * fixed by the first three attempts): login and WABA-connect both
     * trigger this method — firing close together for the same account
     * raced and crashed.
     *
     * Fix #1 wrapped the body in a `synchronized(lockFor(accountId))` block
     * (mirroring AgentDeployService's per-agentId lock) — did NOT work. The
     * synchronized block is INSIDE the method body, but @Transactional wraps
     * AROUND the whole method call, so the JVM monitor releases when the
     * method body returns, which happens BEFORE the surrounding transaction
     * actually commits. A JVM lock can't serialize against a DB transaction
     * boundary it lives inside of.
     *
     * Fix #2 was a per-phone find-or-create-then-saveAndFlush, with a
     * try/catch(DataIntegrityViolationException) that re-fetched and retried
     * as an update on conflict — did NOT work either. Once saveAndFlush()
     * throws, the Hibernate persistence context for that transaction is left
     * unusable (per JPA spec, a PersistenceException invalidates the
     * EntityManager) — the "retry" ran against the same broken
     * session/transaction and just re-threw the identical duplicate-key
     * error. Confirmed live: the log showed the duplicate-entry error TWICE
     * per failing call before the outer catch logged "Phone sync failed".
     *
     * Fix #3 was a single atomic native `INSERT ... ON DUPLICATE KEY UPDATE`
     * per phone (see PhoneNumberSnapshotRepository.upsert) — this DID fix
     * the duplicate-key crash (no more DataIntegrityViolationException), but
     * live-testing with genuinely concurrent requests against freshly
     * cleared rows surfaced a DIFFERENT, legitimate failure: MySQL InnoDB
     * itself throws "Deadlock found when trying to get lock; try
     * restarting transaction" when multiple sessions concurrently INSERT
     * new rows into a table with a unique secondary index (uq_account_phone)
     * — a well-documented InnoDB gap-lock phenomenon, not a logic bug. The
     * upsert SQL itself is correct and stays as-is.
     *
     * Fix #4 (this one): MySQL's own deadlock detector guarantees this is
     * transient — the recommended handling (Spring's own docs: catch
     * ConcurrencyFailureException, the superclass of the deadlock exception
     * translation, and retry the transaction) is a bounded retry, not
     * another rewrite of the write logic. Runs the whole write (upsert loop
     * + stale-row cleanup) inside a manually-driven REQUIRES_NEW
     * TransactionTemplate so each retry gets a genuinely fresh transaction —
     * a `@Transactional` method retried by looping inside itself would just
     * reuse the same (already-doomed) transaction.
     */
    @Async
    public void syncForAccount(Long accountId) {
        // Set for this async method's own thread only — every Meta call made
        // downstream (listAllPhonesForAccountId, reconcileStatus, etc.) can
        // now be attributed in api_call_log instead of logging accountId=NULL.
        // See BackgroundCallContext's own javadoc.
        BackgroundCallContext.set(accountId);
        try {
            WabaDtos.AccountPhonesResponse live = wabaService.listAllPhonesForAccountId(accountId);
            boolean partial = !live.unavailableWabaLabels().isEmpty();

            for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    requiresNewTransaction.executeWithoutResult(status -> writeSnapshot(accountId, live, partial));
                    break;
                } catch (ConcurrencyFailureException e) {
                    if (attempt == MAX_ATTEMPTS) {
                        throw e;
                    }
                    log.warn("Phone sync: accountId={} deadlock on attempt {}/{}, retrying", accountId, attempt, MAX_ATTEMPTS);
                }
            }

            if (partial) {
                log.warn("Phone sync: accountId={} partial — unavailable WABAs: {}; skipping stale-row cleanup this round", accountId, live.unavailableWabaLabels());
            }
        } catch (Exception e) {
            log.warn("Phone sync failed: accountId={} error={}", accountId, e.getMessage());
        } finally {
            BackgroundCallContext.clear();
        }
    }

    /**
     * EL REJECT on fix #4 (this method's prior version), caught cold on
     * review, not by any live test run so far: the stale-row cleanup below
     * deleted every existing row not present in THIS call's live result —
     * correct for a fully successful fetch, but silently wrong whenever
     * `live` is a PARTIAL result (one WABA's Meta call failed this round,
     * per `unavailableWabaLabels`). A transient one-WABA blip would
     * permanently wipe that WABA's cached rows instead of preserving
     * last-known-good data, contradicting this class's own documented
     * contract. Fixed by skipping cleanup entirely whenever this sync's
     * fetch was partial — a genuinely removed number just waits for the
     * next fully-successful sync to be pruned, which is the correct
     * trade-off (never delete on incomplete information).
     */
    private void writeSnapshot(Long accountId, WabaDtos.AccountPhonesResponse live, boolean partial) {
        LocalDateTime now = LocalDateTime.now();
        var keepPhoneNumberIds = new java.util.HashSet<String>();
        for (WabaDtos.AccountPhoneNumber phone : live.phoneNumbers()) {
            snapshotRepository.upsert(
                    TsidGenerator.nextId(),
                    accountId,
                    phone.phoneNumberId(),
                    phone.displayPhoneNumber(),
                    phone.verifiedName(),
                    phone.wabaId(),
                    phone.wabaLabel(),
                    phone.hasAgent(),
                    phone.agentId() != null ? Long.parseLong(phone.agentId()) : null,
                    phone.agentName(),
                    phone.agentStatus(),
                    phone.qualityRating(),
                    phone.nameStatus(),
                    phone.messagingLimitTier(),
                    now);
            keepPhoneNumberIds.add(phone.phoneNumberId());
        }

        if (partial) {
            return;
        }

        // Remove snapshot rows for numbers Meta no longer returned (e.g.
        // disconnected) — by phone_number_id, not a blanket delete, so it
        // never touches rows another overlapping sync just upserted. Only
        // safe to run when this sync's fetch was fully successful (see
        // javadoc above) — otherwise a temporarily-unreachable WABA's rows
        // would be mistaken for genuinely-removed numbers.
        for (PhoneNumberSnapshot existingRow : snapshotRepository.findAllByAccountId(accountId)) {
            if (!keepPhoneNumberIds.contains(existingRow.getPhoneNumberId())) {
                snapshotRepository.delete(existingRow);
            }
        }
    }
}
