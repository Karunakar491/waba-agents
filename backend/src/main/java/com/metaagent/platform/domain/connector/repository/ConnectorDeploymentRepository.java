package com.metaagent.platform.domain.connector.repository;

import com.metaagent.platform.domain.connector.entity.ConnectorDeployment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConnectorDeploymentRepository extends JpaRepository<ConnectorDeployment, Long> {

    Optional<ConnectorDeployment> findByConnectorIdAndAgentId(Long connectorId, Long agentId);

    /** Batched — the library rollup would otherwise do one query per connector. */
    List<ConnectorDeployment> findAllByConnectorIdIn(Collection<Long> connectorIds);

    List<ConnectorDeployment> findAllByAgentIdIn(Collection<Long> agentIds);

    List<ConnectorDeployment> findAllByConnectorId(Long connectorId);

    @Modifying
    void deleteAllByAgentId(Long agentId);
}
