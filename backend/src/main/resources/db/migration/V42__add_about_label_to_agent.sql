-- Figma 8.1 "Agents: List" — About column is a short, human-written label
-- distinct from systemPrompt (which is the longer instructional prompt used
-- to drive the agent's behavior, not a user-facing summary). Additive-only:
-- new nullable column, no rename/drop of any existing column.
ALTER TABLE agent ADD COLUMN about_label VARCHAR(255) NULL;
