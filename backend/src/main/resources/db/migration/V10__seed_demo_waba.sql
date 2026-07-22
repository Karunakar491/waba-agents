-- Seed the demo account WABA so the bind-phone flow works out of the box.
-- Account 867344590959546368 = Karix Demo (demo@karix.online)
-- WABA 494227720434920 = Karix BSP WABA (real Meta WABA verified 2026-07-22)
INSERT IGNORE INTO waba (id, account_id, waba_id, label, status, created_at, updated_at)
VALUES (
    867344591100000001,
    867344590959546368,
    '494227720434920',
    'Karix Demo WABA',
    'active',
    NOW(),
    NOW()
);
