package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentInsightsSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgentInsightsSnapshotRepository extends JpaRepository<AgentInsightsSnapshot, Long> {
    Optional<AgentInsightsSnapshot> findByAgentId(Long agentId);
}
