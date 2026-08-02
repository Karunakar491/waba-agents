package com.metaagent.platform.domain.waba.repository;

import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PhoneNumberSnapshotRepository extends JpaRepository<PhoneNumberSnapshot, Long> {
    List<PhoneNumberSnapshot> findAllByAccountId(Long accountId);
    Optional<PhoneNumberSnapshot> findByAccountIdAndPhoneNumberId(Long accountId, String phoneNumberId);
    void deleteAllByAccountId(Long accountId);

    /**
     * Atomic upsert (TASK-056 fix #3) — a single MySQL statement that MySQL
     * itself serializes at the row level, so two overlapping syncs writing
     * the same (account_id, phone_number_id) can never race: whichever
     * commits second just becomes an UPDATE against the row the first one
     * inserted. Replaces the find-then-save(-then-retry-on-conflict) approach,
     * which broke because a failed saveAndFlush() leaves the Hibernate
     * persistence context for that transaction unusable — a caught
     * DataIntegrityViolationException can't be recovered from by continuing
     * to use the same EntityManager/transaction, so the "retry as update"
     * path just re-threw the identical duplicate-key error.
     */
    @Modifying
    @Query(value = """
            INSERT INTO phone_number_snapshot
                (id, account_id, phone_number_id, display_phone_number, verified_name,
                 waba_id, waba_label, has_agent, agent_id, agent_name, agent_status,
                 quality_rating, name_status, messaging_limit_tier, synced_at)
            VALUES
                (:id, :accountId, :phoneNumberId, :displayPhoneNumber, :verifiedName,
                 :wabaId, :wabaLabel, :hasAgent, :agentId, :agentName, :agentStatus,
                 :qualityRating, :nameStatus, :messagingLimitTier, :syncedAt)
            ON DUPLICATE KEY UPDATE
                display_phone_number = VALUES(display_phone_number),
                verified_name        = VALUES(verified_name),
                waba_id              = VALUES(waba_id),
                waba_label           = VALUES(waba_label),
                has_agent            = VALUES(has_agent),
                agent_id             = VALUES(agent_id),
                agent_name           = VALUES(agent_name),
                agent_status         = VALUES(agent_status),
                quality_rating       = VALUES(quality_rating),
                name_status          = VALUES(name_status),
                messaging_limit_tier = VALUES(messaging_limit_tier),
                synced_at            = VALUES(synced_at)
            """, nativeQuery = true)
    void upsert(@Param("id") long id,
                @Param("accountId") Long accountId,
                @Param("phoneNumberId") String phoneNumberId,
                @Param("displayPhoneNumber") String displayPhoneNumber,
                @Param("verifiedName") String verifiedName,
                @Param("wabaId") String wabaId,
                @Param("wabaLabel") String wabaLabel,
                @Param("hasAgent") boolean hasAgent,
                @Param("agentId") Long agentId,
                @Param("agentName") String agentName,
                @Param("agentStatus") String agentStatus,
                @Param("qualityRating") String qualityRating,
                @Param("nameStatus") String nameStatus,
                @Param("messagingLimitTier") String messagingLimitTier,
                @Param("syncedAt") LocalDateTime syncedAt);

    /** The row's real id after the upsert above — needed for the stale-row cleanup pass. */
    @Query("select p.id from PhoneNumberSnapshot p where p.accountId = :accountId and p.phoneNumberId = :phoneNumberId")
    Optional<Long> findIdByAccountIdAndPhoneNumberId(@Param("accountId") Long accountId, @Param("phoneNumberId") String phoneNumberId);
}
