-- Founder-confirmed (2026-08-13): WABA 867344591100000001 ("TEST WABA (real
-- Karix account 494227720434920)") is not a real onboarded client — it's the
-- same demo/test seed row V39/V40/V41 previously soft-deactivated. Founder
-- asked this time for a real delete, not another deactivate toggle.
--
-- V39's own comment flagged why a naive DELETE would fail or orphan: client,
-- connector, iris_session, phone_esme_mapping, skill all carry a RESTRICT FK
-- to waba.id; agent.waba_id and waba_account_access.waba_id carry none. This
-- migration deletes every dependent row first, in FK-safe order, scoped only
-- to this one WABA id (and the agent ids / phone numbers under it) — no
-- unscoped DELETE anywhere in this file.
--
-- Verified counts before writing this (2026-08-13, via read-only SELECT):
-- 6 agents, 6 business_profile rows, 3 iris_session (+ their iris_message
-- children), 3 phone_esme_mapping, 1 waba_account_access. client/connector/
-- skill under this waba_id are all 0 — those DELETEs are included anyway for
-- correctness/safety, they are simply no-ops here.

-- 1. iris_session children
DELETE FROM iris_message
WHERE session_id IN (SELECT id FROM iris_session WHERE waba_id = 867344591100000001);

DELETE FROM iris_session WHERE waba_id = 867344591100000001;

-- 2. agent_website children (must precede agent_website itself)
DELETE FROM agent_website_page
WHERE website_id IN (
    SELECT aw.id FROM agent_website aw
    WHERE aw.agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001)
);

-- 3. Everything hanging directly off the agents on this WABA
DELETE FROM agent_skill_attachment WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM connector_deployment   WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM agent_connector        WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM agent_faq              WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM agent_file             WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM agent_skill            WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM agent_ui_skill         WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM agent_website          WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
-- messages.conversation_id -> conversations.id is ON DELETE RESTRICT, so
-- messages must go before conversations (caught live, 2026-08-13: first
-- attempt at this migration failed on this exact FK and rolled back cleanly).
DELETE FROM messages               WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM conversations          WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);
DELETE FROM webhook_raw            WHERE agent_id IN (SELECT id FROM agent WHERE waba_id = 867344591100000001);

-- 4. Business Persona rows deployed to these agents' phone numbers.
-- agent.phone_number_id and business_profile.phone_number_id were created
-- under different server collation defaults (utf8mb4_0900_ai_ci vs
-- utf8mb4_unicode_ci) — caught live, 2026-08-13: second attempt failed with
-- "Illegal mix of collations" until this explicit COLLATE was added.
DELETE FROM business_profile
WHERE phone_number_id COLLATE utf8mb4_unicode_ci IN (
    SELECT phone_number_id COLLATE utf8mb4_unicode_ci FROM agent
    WHERE waba_id = 867344591100000001 AND phone_number_id IS NOT NULL
);

-- 5. The agents themselves
DELETE FROM agent WHERE waba_id = 867344591100000001;

-- 6. Everything else scoped directly to the WABA (client/connector/skill are
--    0 rows today per the verified counts above — kept for correctness).
DELETE FROM client              WHERE waba_id = 867344591100000001;
DELETE FROM connector           WHERE waba_id = 867344591100000001;
DELETE FROM skill               WHERE waba_id = 867344591100000001;
DELETE FROM phone_esme_mapping  WHERE waba_id = 867344591100000001;
DELETE FROM waba_account_access WHERE waba_id = 867344591100000001;

-- 7. The WABA row itself, last.
DELETE FROM waba WHERE id = 867344591100000001;
