package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentUiSkillRepository extends JpaRepository<AgentUiSkill, Long> {
    List<AgentUiSkill> findAllByAgentId(Long agentId);
    Optional<AgentUiSkill> findByIdAndAgentId(Long id, Long agentId);
    void deleteAllByAgentId(Long agentId);
}
