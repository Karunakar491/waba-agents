package com.metaagent.platform.domain.iris;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * Daily token counter for the OpenAI mini-tier budget switch (2026-08-19) —
 * one row per account per day, incremented atomically as real turns happen
 * (see AiDailyTokenUsageRepository.incrementAndGet). Composite key
 * (account_id, usage_date) instead of a TSID surrogate: this table is a
 * pure counter, never referenced by id elsewhere, never returned to the
 * frontend by row identity.
 */
@Entity
@Table(name = "ai_daily_token_usage")
@IdClass(AiDailyTokenUsage.Key.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AiDailyTokenUsage {

    @Id
    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Id
    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Column(name = "tokens_used", nullable = false)
    private long tokensUsed;

    public static class Key implements Serializable {
        private Long accountId;
        private LocalDate usageDate;

        public Key() {}

        public Key(Long accountId, LocalDate usageDate) {
            this.accountId = accountId;
            this.usageDate = usageDate;
        }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof Key key)) return false;
            return accountId.equals(key.accountId) && usageDate.equals(key.usageDate);
        }

        @Override
        public int hashCode() {
            return accountId.hashCode() * 31 + usageDate.hashCode();
        }
    }
}
