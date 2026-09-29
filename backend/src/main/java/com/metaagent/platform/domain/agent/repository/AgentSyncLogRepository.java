package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentSyncLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AgentSyncLogRepository extends JpaRepository<AgentSyncLog, Long> {

    /** Newest-first — callers take the first row per category for "last synced". */
    List<AgentSyncLog> findAllByAgentIdOrderBySyncedAtDesc(Long agentId);

    List<AgentSyncLog> findAllByAgentIdInOrderBySyncedAtDesc(Collection<Long> agentIds);
}
