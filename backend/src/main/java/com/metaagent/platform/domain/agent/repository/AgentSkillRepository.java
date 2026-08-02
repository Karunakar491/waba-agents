package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentSkillRepository extends JpaRepository<AgentSkill, Long> {
    List<AgentSkill> findAllByAgentId(Long agentId);
    /** Batched lookup for multiple agents at once — avoids an N+1 per-agent loop. */
    List<AgentSkill> findAllByAgentIdIn(Collection<Long> agentIds);
    Optional<AgentSkill> findByIdAndAgentId(Long id, Long agentId);
    void deleteAllByAgentId(Long agentId);
}
