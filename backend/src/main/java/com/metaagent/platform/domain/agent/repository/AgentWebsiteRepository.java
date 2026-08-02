package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentWebsite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentWebsiteRepository extends JpaRepository<AgentWebsite, Long> {
    List<AgentWebsite> findAllByAgentId(Long agentId);
    /** Batched lookup for the aggregate Files library page's Websites tab. */
    List<AgentWebsite> findAllByAgentIdIn(Collection<Long> agentIds);
    Optional<AgentWebsite> findByIdAndAgentId(Long id, Long agentId);
    void deleteAllByAgentId(Long agentId);
}
