package com.metaagent.platform.domain.connector.repository;

import com.metaagent.platform.domain.connector.entity.Connector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConnectorRepository extends JpaRepository<Connector, Long> {

    /** Internal use only — callers MUST have already passed WabaAccessGuard for this wabaId. */
    List<Connector> findAllByWabaId(Long wabaId);
}
