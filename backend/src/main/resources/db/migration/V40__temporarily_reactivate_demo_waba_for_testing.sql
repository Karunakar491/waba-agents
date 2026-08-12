-- Temporary: V39 deactivated the demo WABA (867344591100000001), but it
-- turned out to be the only WABA on demo@karix.online, needed to finish
-- verifying the Iris create_template fix. Reactivating for that test only —
-- a follow-up migration (or a manual decision) should re-deactivate it once
-- the test is done, per the founder's original intent in V39.
UPDATE waba SET status = 'active', updated_at = NOW()
WHERE id = 867344591100000001 AND status <> 'active';
