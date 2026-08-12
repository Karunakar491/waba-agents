-- V40 temporarily reactivated this row to finish live-testing the Iris
-- create_template confirmation fix. Testing is done and confirmed working
-- (see 2026-08-12 session) -- returning to the founder's original intent
-- from V39: this demo seed row stays deactivated.
UPDATE waba SET status = 'disconnected', updated_at = NOW()
WHERE id = 867344591100000001 AND status <> 'disconnected';
