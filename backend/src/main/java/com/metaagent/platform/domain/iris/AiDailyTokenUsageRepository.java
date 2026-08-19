package com.metaagent.platform.domain.iris;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface AiDailyTokenUsageRepository extends JpaRepository<AiDailyTokenUsage, AiDailyTokenUsage.Key> {

    Optional<AiDailyTokenUsage> findByAccountIdAndUsageDate(Long accountId, LocalDate usageDate);

    /**
     * Single atomic upsert — no read-then-write window, so concurrent Iris
     * turns for the same account on the same day can never lose an
     * increment (EM-required, 2026-08-19 daily-budget tier switch).
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO ai_daily_token_usage (account_id, usage_date, tokens_used) " +
            "VALUES (:accountId, :usageDate, :tokens) " +
            "ON DUPLICATE KEY UPDATE tokens_used = tokens_used + :tokens",
            nativeQuery = true)
    void increment(@Param("accountId") Long accountId, @Param("usageDate") LocalDate usageDate, @Param("tokens") long tokens);
}
