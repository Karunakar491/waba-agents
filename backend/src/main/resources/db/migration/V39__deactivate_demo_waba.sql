-- The demo WABA seeded by V10 (id 867344591100000001) was a placeholder
-- record, not a real onboarded account. Soft-deactivate rather than delete:
-- client/skill/phone_esme_mapping/waba_karix_credential/iris_session all
-- hold RESTRICT foreign keys to waba.id with no ON DELETE clause, so a hard
-- delete would either fail loudly or (for the non-FK-protected agent.waba_id
-- and waba_account_access rows) orphan silently. status='disconnected' is
-- an existing, previously-unused enum value on this column.
UPDATE waba SET status = 'disconnected', updated_at = NOW()
WHERE id = 867344591100000001 AND status <> 'disconnected';
