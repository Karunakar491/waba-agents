package com.metaagent.platform.domain.webhook.repository;

import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface WebhookRawRepository extends JpaRepository<WebhookRaw, Long> {

    /**
     * Atomic CAS claim — only one consumer wins when status is PENDING.
     * Returns 1 if claimed, 0 if already PROCESSING or PROCESSED (duplicate delivery).
     */
    @Modifying
    @Query("UPDATE WebhookRaw w SET w.status = 'PROCESSING' WHERE w.id = :id AND w.status = 'PENDING'")
    int claimForProcessing(@Param("id") Long id);

    /**
     * Retention cleanup — delete PROCESSED/FAILED rows older than the given cutoff.
     */
    @Modifying
    @Query("DELETE FROM WebhookRaw w WHERE w.status IN ('PROCESSED', 'FAILED') AND w.processedAt < :cutoff")
    int deleteProcessedBefore(@Param("cutoff") LocalDateTime cutoff);
}
