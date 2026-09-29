package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentEvalCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentEvalCaseRepository extends JpaRepository<AgentEvalCase, Long> {
    List<AgentEvalCase> findAllByAgentId(Long agentId);
    Optional<AgentEvalCase> findByAgentIdAndMetaCaseId(Long agentId, String metaCaseId);
}
