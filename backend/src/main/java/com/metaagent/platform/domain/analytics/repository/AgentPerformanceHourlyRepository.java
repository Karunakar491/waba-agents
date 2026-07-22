package com.metaagent.platform.domain.analytics.repository;

import com.metaagent.platform.domain.analytics.entity.AgentPerformanceHourly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AgentPerformanceHourlyRepository extends JpaRepository<AgentPerformanceHourly, Long> {

    List<AgentPerformanceHourly> findAllByAgentIdAndHourBetween(Long agentId, LocalDateTime start, LocalDateTime end);

    List<AgentPerformanceHourly> findAllByAccountIdAndHourBetween(Long accountId, LocalDateTime start, LocalDateTime end);

    // Used by hourly rollup: fetch distinct (agent_id, account_id) active in a time window
    @Query(value = "SELECT DISTINCT agent_id, account_id FROM conversations WHERE last_message_at >= :start AND last_message_at < :end", nativeQuery = true)
    List<Object[]> findActiveAgentAccountPairs(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Used by hourly rollup: message direction counts for one agent in a time window
    @Query(value = "SELECT direction, COUNT(*) FROM messages WHERE agent_id = :agentId AND received_at >= :start AND received_at < :end GROUP BY direction", nativeQuery = true)
    List<Object[]> countMessagesByDirection(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Used by hourly rollup: conversations opened for one agent in a time window
    @Query(value = "SELECT COUNT(*) FROM conversations WHERE agent_id = :agentId AND started_at >= :start AND started_at < :end", nativeQuery = true)
    int countConversationsOpened(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Used by hourly rollup: conversations closed for one agent in a time window
    @Query(value = "SELECT COUNT(*) FROM conversations WHERE agent_id = :agentId AND closed_at >= :start AND closed_at < :end", nativeQuery = true)
    int countConversationsClosed(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Used by hourly rollup: average response time from webhook_events for sent events
    @Query(value = "SELECT AVG(processing_ms) FROM webhook_events WHERE agent_id = :agentId AND processed_at >= :start AND processed_at < :end AND status = 'sent'", nativeQuery = true)
    Double avgResponseMs(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Used by hourly rollup: failed event count from webhook_raw
    @Query(value = "SELECT COUNT(*) FROM webhook_raw WHERE agent_id = :agentId AND processed_at >= :start AND processed_at < :end AND status = 'FAILED'", nativeQuery = true)
    int countFailedWebhookEvents(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Used by getAgentSummaryMetrics: average avg_response_ms across hourly rows for an agent
    @Query(value = "SELECT AVG(avg_response_ms) FROM agent_performance_hourly WHERE agent_id = :agentId AND hour >= :start AND hour <= :end", nativeQuery = true)
    Double avgResponseMsForAgent(@Param("agentId") Long agentId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
