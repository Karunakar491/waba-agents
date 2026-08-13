package com.metaagent.platform.domain.skill.repository;

import com.metaagent.platform.domain.skill.entity.AgentSkillAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AgentSkillAttachmentRepository extends JpaRepository<AgentSkillAttachment, Long> {
    List<AgentSkillAttachment> findAllByAgentId(Long agentId);

    @Modifying
    void deleteAllByAgentId(Long agentId);
    /** Batched lookup for the aggregate Skills table — every attachment (deployed or not) for a set of Library skills. */
    List<AgentSkillAttachment> findAllBySkillIdIn(List<Long> skillIds);
    Optional<AgentSkillAttachment> findByAgentIdAndSkillId(Long agentId, Long skillId);
    Optional<AgentSkillAttachment> findByIdAndAgentId(Long id, Long agentId);

    /** Single-query set of skill ids "Deployed" (live somewhere, per any attachment ever synced —
     * a pending edit on a still-running skill must not make it look undeployed). Used by
     * SkillLibraryService.listSkills to avoid an N+1 per-skill lookup. */
    @Query("select distinct a.skillId from AgentSkillAttachment a where a.skillId in :skillIds and a.deployedAt is not null")
    List<Long> findDeployedSkillIds(@Param("skillIds") List<Long> skillIds);
}
