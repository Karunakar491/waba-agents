package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentSkillRepository extends JpaRepository<AgentSkill, Long> {
    List<AgentSkill> findAllByAgentId(Long agentId);
    Optional<AgentSkill> findByIdAndAgentId(Long id, Long agentId);
}
