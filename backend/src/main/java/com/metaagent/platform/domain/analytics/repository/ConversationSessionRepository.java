package com.metaagent.platform.domain.analytics.repository;

import com.metaagent.platform.domain.analytics.entity.ConversationSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface ConversationSessionRepository extends JpaRepository<ConversationSession, Long> {

    Optional<ConversationSession> findByConversationId(Long conversationId);

    // Used by getAgentSummaryMetrics: resolution stats for a given agent and time range.
    // resolved = conversations that are closed OR have been open > 24h since last message.
    @Query(value = """
            SELECT
              COUNT(CASE WHEN last_message_at < NOW() - INTERVAL 24 HOUR AND status = 'open' THEN 1 END)
              + COUNT(CASE WHEN status = 'closed' THEN 1 END) AS resolved_count,
              COUNT(*) AS total_conversations
            FROM conversations
            WHERE agent_id = :agentId
              AND started_at >= :start AND started_at <= :end
            """, nativeQuery = true)
    Object[] resolutionStats(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
