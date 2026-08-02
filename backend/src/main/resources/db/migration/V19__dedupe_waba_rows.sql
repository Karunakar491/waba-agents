-- Merges legacy duplicate `waba` rows that represent the same real Meta WABA
-- (same waba.waba_id, different internal row per account that ever
-- registered it — pre-dates the canonical-row dedup logic added to
-- WabaService.create() on 2026-07-28) into one canonical row (lowest id —
-- mirrors WabaService.findFirstByWabaIdOrderByIdAsc, no new precedence
-- invented). Root cause: an account with legitimate access to a WABA saw
-- "No agent deployed" on a number a real, live agent (MDH Assistant) was
-- actually deployed on, because PhoneNumberAccessGuard.hasAccess() checks
-- agent.waba_id against waba_account_access for one exact row id, and the
-- viewing account's grant was to a *different* row for the same real WABA.
-- Confirmed via live DB query 2026-07-29: 7 rows for real waba_id
-- 494227720434920, one agent + six access grants needing repoint.
--
-- All statements are WHERE-scoped to "non-canonical duplicate", so
-- re-running this migration after a partial failure is a no-op — nothing
-- left to move or delete once a full run completes. See TASKS.md TASK-049.

-- Canonical row per real waba_id: lowest id in each duplicate group.
CREATE TEMPORARY TABLE waba_canonical AS
SELECT waba_id AS real_waba_id, MIN(id) AS canonical_id
FROM waba
GROUP BY waba_id
HAVING COUNT(*) > 1;

-- 1. Repoint waba_account_access -> canonical, skipping any row that would
--    collide with the uq_waba_account (waba_id, account_id) unique
--    constraint (the canonical row already grants that account).
--    NOTE: the NOT EXISTS below is a start-of-statement snapshot, not
--    per-row-live — safe only because each duplicate row in the known data
--    grants a DISTINCT account. If two duplicates in the same group ever
--    shared the same account, this statement (not just the delete after it)
--    would need re-checking for an intra-statement collision.
UPDATE waba_account_access waa
JOIN waba w ON w.id = waa.waba_id
JOIN waba_canonical wc ON wc.real_waba_id = w.waba_id
SET waa.waba_id = wc.canonical_id
WHERE waa.waba_id <> wc.canonical_id
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT waba_id, account_id FROM waba_account_access) existing
      WHERE existing.waba_id = wc.canonical_id AND existing.account_id = waa.account_id
  );

-- Drop any leftover grants to a duplicate row that couldn't be repointed
-- above — redundant now, since the canonical row already grants that account.
DELETE waa FROM waba_account_access waa
JOIN waba w ON w.id = waa.waba_id
JOIN waba_canonical wc ON wc.real_waba_id = w.waba_id
WHERE waa.waba_id <> wc.canonical_id;

-- 2. Repoint agent.waba_id -> canonical.
UPDATE agent a
JOIN waba w ON w.id = a.waba_id
JOIN waba_canonical wc ON wc.real_waba_id = w.waba_id
SET a.waba_id = wc.canonical_id
WHERE a.waba_id <> wc.canonical_id;

-- 3. Repoint client.waba_id -> canonical (fk_client_waba, ON DELETE RESTRICT
--    by default — must happen before step 4 or the delete below fails loudly).
UPDATE client c
JOIN waba w ON w.id = c.waba_id
JOIN waba_canonical wc ON wc.real_waba_id = w.waba_id
SET c.waba_id = wc.canonical_id
WHERE c.waba_id <> wc.canonical_id;

-- 4. Now safe to delete the orphaned duplicate waba rows — nothing
--    references them anymore.
DELETE w FROM waba w
JOIN waba_canonical wc ON wc.real_waba_id = w.waba_id
WHERE w.id <> wc.canonical_id;

DROP TEMPORARY TABLE waba_canonical;
