package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentUiSkillRepository extends JpaRepository<AgentUiSkill, Long> {
    List<AgentUiSkill> findAllByAgentId(Long agentId);
    /** Batched lookup for multiple agents at once — avoids an N+1 per-agent loop (Skill Library rollup). */
    List<AgentUiSkill> findAllByAgentIdIn(Collection<Long> agentIds);
    Optional<AgentUiSkill> findByIdAndAgentId(Long id, Long agentId);
    void deleteAllByAgentId(Long agentId);
}
