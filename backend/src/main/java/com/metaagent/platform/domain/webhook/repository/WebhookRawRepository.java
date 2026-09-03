package com.metaagent.platform.domain.webhook.repository;

import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WebhookRawRepository extends JpaRepository<WebhookRaw, Long>, JpaSpecificationExecutor<WebhookRaw> {

    /**
     * Founder-caught gap (2026-08-07): no way existed to view logged webhooks
     * at all from the UI. Capped at 100 most recent -- this is a debug/audit
     * view, not a paginated log browser.
     */
    List<WebhookRaw> findTop100ByAccountIdOrderByReceivedAtDesc(Long accountId);

    /**
     * Atomic CAS claim — only one consumer wins when status is PENDING.
     * Returns 1 if claimed, 0 if already PROCESSING or PROCESSED (duplicate delivery).
     */
    @Modifying
    @Query("UPDATE WebhookRaw w SET w.status = 'PROCESSING' WHERE w.id = :id AND w.status = 'PENDING'")
    int claimForProcessing(@Param("id") Long id);

    /**
     * Retention cleanup — account-attributed rows, PROCESSED/FAILED, older than the
     * given cutoff (30 days). Keyed on processedAt since these always pass through
     * markProcessed/markFailed, which set it.
     */
    @Modifying
    @Query("DELETE FROM WebhookRaw w WHERE w.accountId IS NOT NULL AND w.status IN ('PROCESSED', 'FAILED') AND w.processedAt < :cutoff")
    int deleteAttributedBefore(@Param("cutoff") LocalDateTime cutoff);

    /**
     * Retention cleanup — unattributed rows (no matching agent, or signature
     * verification failure), older than the given cutoff (48 hours). Keyed on
     * receivedAt, not processedAt: these never go through the processing pipeline,
     * so processedAt is always null for them.
     */
    @Modifying
    @Query("DELETE FROM WebhookRaw w WHERE w.accountId IS NULL AND w.receivedAt < :cutoff")
    int deleteUnattributedBefore(@Param("cutoff") LocalDateTime cutoff);

    /** Bulk delete for agent deletion cascade — agentId is nullable on this table but always set once an agent is bound. */
    @Modifying
    @Query("DELETE FROM WebhookRaw w WHERE w.agentId = :agentId")
    void deleteAllByAgentId(@Param("agentId") Long agentId);
}
