package com.metaagent.platform.domain.businessevent.repository;

import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BusinessEventFireRepository extends JpaRepository<BusinessEventFire, Long> {

    /** The agent's own history list, newest first. */
    Page<BusinessEventFire> findByAgentIdOrderByCreatedAtDesc(Long agentId, Pageable pageable);

    /** The same list narrowed to one verdict — the history table's filter. */
    Page<BusinessEventFire> findByAgentIdAndOutcomeOrderByCreatedAtDesc(Long agentId,
                                                                       BusinessEventFire.Outcome outcome,
                                                                       Pageable pageable);

    /** Tenant-scoped single lookup — the account id is always checked, never assumed. */
    Optional<BusinessEventFire> findByIdAndAccountId(Long id, Long accountId);

    /** Idempotency check: has this caller already fired this exact thing? */
    Optional<BusinessEventFire> findByAgentIdAndIdempotencyKey(Long agentId, String idempotencyKey);

    /**
     * The scheduled poller's work queue: fires Meta accepted, that carry an id
     * we can ask about, that have not reached a terminal state, that still have
     * attempts left, and that are due another check.
     *
     * <p>Oldest first so a backlog drains in order, and {@link Pageable} caps a
     * single run — one poll cycle must not try to drain a week of backlog.
     *
     * <p>ACCEPTED comes in as a bound parameter rather than an inline JPQL enum
     * literal, which needs a fully-qualified nested-class name and breaks
     * silently at startup if it is spelled wrong.
     */
    @Query("""
            select f from BusinessEventFire f
            where f.outcome = :accepted
              and f.metaAgentEventId is not null
              and f.terminalAt is null
              and f.pollAttempts < :maxAttempts
              and (f.lastPolledAt is null or f.lastPolledAt < :dueBefore)
            order by f.createdAt asc
            """)
    List<BusinessEventFire> findDueForPoll(@Param("accepted") BusinessEventFire.Outcome accepted,
                                           @Param("maxAttempts") short maxAttempts,
                                           @Param("dueBefore") LocalDateTime dueBefore,
                                           Pageable pageable);

    /**
     * The "31 sent · 2 didn't" line on the agent page. One derived count per
     * case rather than a grouped projection — the caller needs two or three
     * specific numbers, not a map, and this reads without explanation.
     */
    long countByAgentIdAndCreatedAtAfterAndOutcome(Long agentId,
                                                   LocalDateTime since,
                                                   BusinessEventFire.Outcome outcome);

    /** Total in the same window, so "sent" can be shown against a denominator. */
    long countByAgentIdAndCreatedAtAfter(Long agentId, LocalDateTime since);

    /**
     * Accepted but delivered nothing — the ones that look like a success and
     * are not. Needs both fields precisely because they are separate columns.
     */
    long countByAgentIdAndCreatedAtAfterAndOutcomeAndMetaStatus(Long agentId,
                                                                LocalDateTime since,
                                                                BusinessEventFire.Outcome outcome,
                                                                BusinessEventFire.MetaStatus metaStatus);

    /**
     * Actually reached the customer. Meta reports arrival as either
     * {@code sent} or {@code success} depending on how far its own pipeline
     * got, so "reached" needs both — one of them alone undercounts.
     */
    long countByAgentIdAndCreatedAtAfterAndOutcomeAndMetaStatusIn(Long agentId,
                                                                  LocalDateTime since,
                                                                  BusinessEventFire.Outcome outcome,
                                                                  Collection<BusinessEventFire.MetaStatus> metaStatuses);
}
