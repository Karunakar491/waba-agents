-- Meta reviews every skill and can refuse it. We never recorded the verdict.
--
-- BizAIOmniChannelSkillsResponse.status is `active`, `pending_review` or
-- `blocked` (docs/meta-api/sources/2026-09-24-skills-official.md). A blocked
-- skill "did not pass the review and the agent never applies it" — and our
-- screens showed it as saved and fine, so a business owner believed their
-- agent behaved a way it never would.
--
-- Deliberately NOT called `status`: agent_skill.status already exists and
-- means published/draft, which is our own publish lifecycle and a different
-- thing entirely. Two columns, two names, no ambiguity about which is being
-- read.
--
-- Additive and nullable: NULL means "we have not heard from Meta about this
-- one", which is the honest state for every row that predates this column and
-- for any row whose create response did not carry a status. Rolling back to
-- the previous jar leaves the column unread and harmless.
--
-- metadata_json is Meta's free key-value map on a skill. We have never sent or
-- read it; storing it means a future save can round-trip whatever is there
-- instead of dropping it, which is the same class of loss as the business
-- profile blanking.

ALTER TABLE agent_skill
    ADD COLUMN meta_review_status VARCHAR(32) NULL,
    ADD COLUMN meta_review_checked_at DATETIME NULL,
    ADD COLUMN metadata_json TEXT NULL;
