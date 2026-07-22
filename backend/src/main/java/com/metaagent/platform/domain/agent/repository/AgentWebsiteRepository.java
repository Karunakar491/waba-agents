package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentWebsite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentWebsiteRepository extends JpaRepository<AgentWebsite, Long> {
    List<AgentWebsite> findAllByAgentId(Long agentId);
    Optional<AgentWebsite> findByIdAndAgentId(Long id, Long agentId);
}
