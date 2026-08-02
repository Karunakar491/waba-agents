-- TASK-061 (P0): phone number health/quality — previously never requested
-- from Meta at all. quality_rating is the leading indicator before WhatsApp
-- restricts/bans a number.
ALTER TABLE phone_number_snapshot
    ADD COLUMN quality_rating VARCHAR(16) NULL AFTER agent_status,
    ADD COLUMN name_status VARCHAR(32) NULL AFTER quality_rating,
    ADD COLUMN messaging_limit_tier VARCHAR(32) NULL AFTER name_status;
