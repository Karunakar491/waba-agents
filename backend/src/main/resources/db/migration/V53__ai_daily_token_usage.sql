-- 2026-08-19. Daily counter for Iris's OpenAI mini-tier budget switch: use
-- gpt-5.4-mini while the account's combined daily usage on OpenAI's shared
-- free mini-tier bucket (10,000,000 tokens/day) is under budget, gpt-5-mini
-- once it's exhausted for the day. One row per account per day, incremented
-- via a single atomic upsert (see AiDailyTokenUsageRepository.increment) --
-- never read-then-write, so concurrent Iris turns can't lose an increment.
CREATE TABLE ai_daily_token_usage (
    account_id BIGINT NOT NULL,
    usage_date DATE NOT NULL,
    tokens_used BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, usage_date)
);
