-- Figma 8.4 (Agents: Create — Business Persona, node 206:2): the "Based on
-- '<preset>' — edit freely" textarea. This is the operator's edited sample
-- reply, i.e. the exact wording the agent uses as its starting style. It has
-- no existing home: `tone` holds the preset LABEL (50 chars), `system_prompt`
-- holds the business description, and `behavior_rules` holds the Skills-step
-- rules. Additive and nullable — existing agents migrate as-is, no backfill,
-- and rolling the code back leaves the column harmlessly unread.
ALTER TABLE agent
    ADD COLUMN persona_sample_reply TEXT NULL;
