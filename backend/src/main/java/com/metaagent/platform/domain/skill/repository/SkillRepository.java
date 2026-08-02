package com.metaagent.platform.domain.skill.repository;

import com.metaagent.platform.domain.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {
    List<Skill> findAllByWabaId(Long wabaId);
    Optional<Skill> findByIdAndWabaId(Long id, Long wabaId);
}
