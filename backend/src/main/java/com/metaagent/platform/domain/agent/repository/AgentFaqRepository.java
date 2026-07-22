package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentFaq;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentFaqRepository extends JpaRepository<AgentFaq, Long> {
    List<AgentFaq> findAllByAgentId(Long agentId);
    Optional<AgentFaq> findByIdAndAgentId(Long id, Long agentId);
}
