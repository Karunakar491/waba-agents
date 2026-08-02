package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentFileRepository extends JpaRepository<AgentFile, Long> {
    List<AgentFile> findAllByAgentId(Long agentId);
    /** Batched lookup for the aggregate Files library page. */
    List<AgentFile> findAllByAgentIdIn(Collection<Long> agentIds);
    Optional<AgentFile> findByIdAndAgentId(Long id, Long agentId);
    void deleteAllByAgentId(Long agentId);
}
