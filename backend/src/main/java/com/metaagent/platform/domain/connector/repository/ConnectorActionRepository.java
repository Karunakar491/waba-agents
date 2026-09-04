package com.metaagent.platform.domain.connector.repository;

import com.metaagent.platform.domain.connector.entity.ConnectorAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConnectorActionRepository extends JpaRepository<ConnectorAction, Long> {

    /**
     * Internal use only — callers MUST have already established that the caller
     * owns this connector, the same contract as ConnectorRepository. Ordered by
     * name so the page does not reshuffle between loads.
     */
    List<ConnectorAction> findAllByConnectorIdOrderByNameAsc(Long connectorId);

    /**
     * Scoped by connector as well as id: an id alone would let a caller who owns
     * connector A read an action belonging to connector B by guessing.
     */
    Optional<ConnectorAction> findByIdAndConnectorId(Long id, Long connectorId);

    boolean existsByConnectorIdAndName(Long connectorId, String name);
}
