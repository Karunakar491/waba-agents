package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentFaq;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentFaqRepository extends JpaRepository<AgentFaq, Long> {
    List<AgentFaq> findAllByAgentId(Long agentId);
    Optional<AgentFaq> findByIdAndAgentId(Long id, Long agentId);
    void deleteAllByAgentId(Long agentId);

    /** Sweep target for SkillUnpublishSweepJob: soft-unpublished past its grace window, still live on Meta. */
    List<AgentFaq> findAllByStatusAndUnpublishedAtBeforeAndMetaFaqIdIsNotNull(
            AgentFaq.Status status, LocalDateTime cutoff);
}
