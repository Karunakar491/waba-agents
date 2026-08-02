package com.metaagent.platform.domain.conversation.repository;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByAgentIdAndExternalId(Long agentId, String externalId);
    List<Conversation> findAllByAgentIdAndAccountId(Long agentId, Long accountId, Pageable pageable);
    List<Conversation> findAllByAccountId(Long accountId, Pageable pageable);
    Optional<Conversation> findByIdAndAccountId(Long id, Long accountId);

    /** Bulk delete for agent deletion cascade — messages must already be deleted first (FK). */
    @Modifying
    @Query("DELETE FROM Conversation c WHERE c.agentId = :agentId")
    void deleteAllByAgentId(@Param("agentId") Long agentId);

    /** Per-agent conversation totals for the Agents list table — one query, no N+1. */
    @Query("select c.agentId as agentId, count(c) as total from Conversation c where c.accountId = :accountId group by c.agentId")
    List<AgentConversationCount> countByAgentIdForAccount(@Param("accountId") Long accountId);

    /** Account-wide totals for the Dashboard summary — all conversations, any status. */
    long countByAccountId(Long accountId);

    /** Account-wide "active" count for the Dashboard summary — open conversations only. */
    long countByAccountIdAndStatus(Long accountId, Conversation.Status status);

    interface AgentConversationCount {
        Long getAgentId();
        Long getTotal();
    }
}
