package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.common.security.BackgroundCallContext;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Asks Meta what became of each accepted announcement.
 *
 * <p>Meta answers a fire with "accepted" and nothing else. Whether the customer
 * was actually told is a separate question with a separate answer, and
 * {@code skipped} — accepted, delivered nothing, customer never told — is the
 * one that matters most and is invisible without this job.
 *
 * <p>Not {@code @Transactional}: each row is its own Meta call followed by its
 * own save, and one row's failure must not roll back the rows already polled.
 * Same reasoning as {@code SkillUnpublishSweepJob}, whose shape this copies.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BusinessEventStatusPollJob {

    /** One cycle's cap. A week of backlog drains over many cycles, never in one. */
    private static final int BATCH_SIZE = 100;

    /**
     * After this many tries Meta is not going to change its mind, and a row that
     * polls forever is a row that costs us a Meta call every 20 seconds for the
     * life of the system.
     */
    private static final short MAX_ATTEMPTS = 20;

    /**
     * A 404 can be Meta not having registered the id yet, so one is not proof of
     * a ghost. Three consecutive ones is.
     */
    private static final int NOT_FOUND_GIVE_UP = 3;

    /**
     * Backoff by attempt number: quick at first because most events settle in
     * seconds, then long because anything still moving after half an hour is not
     * going to settle on our schedule. Capped at 24h.
     */
    private static final long[] BACKOFF_SECONDS = {5, 15, 60, 300, 1800};
    private static final long HOURLY_SECONDS = 3600;
    private static final long MAX_BACKOFF_SECONDS = 86400;

    private final BusinessEventFireRepository fireRepository;
    private final AgentRepository agentRepository;
    private final AgentEventClient agentEventClient;

    /** Kill switch — flip to false and restart to stop polling Meta without a redeploy. */
    @Value("${business-events.status-poll.enabled:true}")
    private boolean pollEnabled;

    @Scheduled(fixedDelay = 20000)
    public void poll() {
        if (!pollEnabled) {
            return;
        }
        List<BusinessEventFire> due = fireRepository.findDueForPoll(
                BusinessEventFire.Outcome.ACCEPTED,
                MAX_ATTEMPTS,
                LocalDateTime.now(),
                PageRequest.of(0, BATCH_SIZE));

        for (BusinessEventFire fire : due) {
            // Per-row: one poisonous row must never starve the rest of the batch.
            try {
                pollOne(fire);
            } catch (Exception e) {
                log.warn("Business event status poll failed for one fire, continuing batch. fireId={} error={}",
                        fire.getId(), e.toString());
            }
        }
    }

    /**
     * The query asks only that a row is due; the backoff schedule itself is
     * applied here, because it depends on {@code pollAttempts} and JPQL cannot
     * express "due at a different interval per attempt count" without raw SQL.
     */
    private void pollOne(BusinessEventFire fire) {
        if (!isDue(fire)) {
            return;
        }

        Agent agent = agentRepository.findById(fire.getAgentId()).orElse(null);
        if (agent == null || agent.getPhoneNumberId() == null) {
            // The agent lost its number, so this id can never be asked about
            // again. Stop, and say what we know rather than what we guessed.
            markTerminal(fire, BusinessEventFire.MetaStatus.unknown,
                    "The agent's WhatsApp number was disconnected, so WhatsApp can no longer be asked what happened to this.");
            return;
        }

        fire.setPollAttempts((short) (fire.getPollAttempts() + 1));
        fire.setLastPolledAt(LocalDateTime.now());

        // So the api_call_log row lands on the right account's Reports page —
        // this is a scheduled thread, so there is no SecurityContext to read.
        BackgroundCallContext.set(fire.getAccountId());
        try {
            AgentEventClient.StatusResponse status =
                    agentEventClient.fetchStatus(agent.getPhoneNumberId(), fire.getMetaAgentEventId());
            apply(fire, status);
        } catch (MetaApiException e) {
            if (e.isNotFound()) {
                applyNotFound(fire);
            } else {
                // Not terminal: a 500 or a rate limit is Meta being unavailable,
                // not Meta answering. The next cycle tries again.
                log.warn("Business event status poll: Meta returned {} for fireId={}", e.getStatusCode(), fire.getId());
            }
        } finally {
            BackgroundCallContext.clear();
        }

        if (fire.getPollAttempts() >= MAX_ATTEMPTS && fire.getTerminalAt() == null) {
            markTerminal(fire, BusinessEventFire.MetaStatus.unknown,
                    "WhatsApp never gave a final answer for this one after " + MAX_ATTEMPTS + " checks, so we stopped asking.");
            return;
        }
        fireRepository.save(fire);
    }

    private boolean isDue(BusinessEventFire fire) {
        if (fire.getLastPolledAt() == null) {
            return true;
        }
        return fire.getLastPolledAt().plusSeconds(backoffSeconds(fire.getPollAttempts())).isBefore(LocalDateTime.now());
    }

    /** 5s, 15s, 60s, 5m, 30m, then hourly, capped at 24h. */
    static long backoffSeconds(short attempts) {
        if (attempts < BACKOFF_SECONDS.length) {
            return BACKOFF_SECONDS[Math.max(attempts, 0)];
        }
        long stepsPastTheTable = attempts - BACKOFF_SECONDS.length + 1;
        return Math.min(stepsPastTheTable * HOURLY_SECONDS, MAX_BACKOFF_SECONDS);
    }

    private void apply(BusinessEventFire fire, AgentEventClient.StatusResponse response) {
        if (response == null) {
            return;
        }
        // Meta answered, so any earlier 404 was Meta not being ready, not a ghost.
        notFoundStreak.remove(fire.getId());
        BusinessEventFire.MetaStatus status = toStatus(response.status());
        fire.setMetaStatus(status);
        fire.setMetaSkippedReason(truncate(response.skippedReason(), 512));
        fire.setMetaErrorMessage(truncate(response.errorMessage(), 512));

        if (isTerminal(status)) {
            fire.setTerminalAt(LocalDateTime.now());
        }
    }

    /**
     * A 404 is usually Meta not having the id ready yet, so it is counted rather
     * than acted on. Three in a row is a ghost, and a ghost must not be polled
     * until MAX_ATTEMPTS runs out.
     *
     * <p>The streak is held in memory, not a column: it is read only by the next
     * poll of the same row, it is at most two entries per ghost (the third ends
     * the row and removes it), and the worst a restart can do is spend a couple
     * more Meta calls on a row that is already terminal-bound. A column for that
     * would be a second migration over V63 for a counter with three values.
     */
    private final java.util.concurrent.ConcurrentHashMap<Long, Integer> notFoundStreak =
            new java.util.concurrent.ConcurrentHashMap<>();

    private void applyNotFound(BusinessEventFire fire) {
        int consecutive = notFoundStreak.merge(fire.getId(), 1, Integer::sum);
        fire.setMetaErrorMessage("WhatsApp did not recognise this announcement's id (check "
                + consecutive + " of " + NOT_FOUND_GIVE_UP + ").");
        if (consecutive >= NOT_FOUND_GIVE_UP) {
            markTerminal(fire, BusinessEventFire.MetaStatus.unknown,
                    "WhatsApp does not recognise this announcement's id, so it can never tell us what happened to it.");
        }
    }

    private void markTerminal(BusinessEventFire fire, BusinessEventFire.MetaStatus status, String message) {
        notFoundStreak.remove(fire.getId());
        fire.setMetaStatus(status);
        fire.setMetaErrorMessage(truncate(message, 512));
        fire.setTerminalAt(LocalDateTime.now());
        fireRepository.save(fire);
    }

    /** sent / success / failed / skipped are all final answers — Meta will not revise them. */
    private static boolean isTerminal(BusinessEventFire.MetaStatus status) {
        return status == BusinessEventFire.MetaStatus.sent
                || status == BusinessEventFire.MetaStatus.success
                || status == BusinessEventFire.MetaStatus.failed
                || status == BusinessEventFire.MetaStatus.skipped;
    }

    /** An unrecognised value is recorded as unknown, never thrown — Meta may add a state tomorrow. */
    static BusinessEventFire.MetaStatus toStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return BusinessEventFire.MetaStatus.unknown;
        }
        for (BusinessEventFire.MetaStatus candidate : BusinessEventFire.MetaStatus.values()) {
            if (candidate.name().equalsIgnoreCase(raw.trim())) {
                return candidate;
            }
        }
        return BusinessEventFire.MetaStatus.unknown;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
