package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentConnector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentConnectorRepository extends JpaRepository<AgentConnector, Long> {

    Optional<AgentConnector> findByAgentIdAndMetaConnectorId(Long agentId, String metaConnectorId);

    List<AgentConnector> findAllByAgentId(Long agentId);

    /** Batched — the WABA rollup would otherwise do one query per agent. */
    List<AgentConnector> findAllByAgentIdIn(Collection<Long> agentIds);

    @Modifying
    void deleteAllByAgentId(Long agentId);
}
