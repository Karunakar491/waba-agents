-- Figma 8.13 "Skills Library" — every skill card carries two tag chips
-- (industry, use case). That data already exists on skill_template but was
-- dropped on the one-way copy into skill, so a copied skill lost its
-- provenance and the grid had nothing real to render.
--
-- Additive-only, mirroring V42: two new nullable columns, no rename, no drop.
-- Existing rows stay NULL and simply render without tags — no backfill, no
-- production data touched.
ALTER TABLE skill ADD COLUMN industry VARCHAR(64) NULL;
ALTER TABLE skill ADD COLUMN use_case VARCHAR(64) NULL;
