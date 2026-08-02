-- TASK-059 (EL REJECT fix): TTL gate so FAQ reconciliation doesn't call Meta
-- on every single getFaqs() read (that would reintroduce the "always live,
-- never cached" anti-pattern this project has been moving away from).
ALTER TABLE agent
    ADD COLUMN faq_reconciled_at DATETIME NULL AFTER deployed_at;
