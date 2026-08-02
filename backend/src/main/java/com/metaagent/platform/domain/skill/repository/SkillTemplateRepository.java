package com.metaagent.platform.domain.skill.repository;

import com.metaagent.platform.domain.skill.entity.SkillTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillTemplateRepository extends JpaRepository<SkillTemplate, Long> {
    // findAll() + in-memory filter is fine at this content volume (EM gate 2026-07-29)
    // — no need for dynamic query building for a handful of seed templates.
}
