package com.metaagent.platform.domain.analytics.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.analytics.entity.AgentPerformanceHourly;
import com.metaagent.platform.domain.analytics.entity.ConversationSession;
import com.metaagent.platform.domain.analytics.entity.WebhookEvent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.analytics.repository.AgentPerformanceHourlyRepository;
import com.metaagent.platform.domain.analytics.repository.ConversationSessionRepository;
import com.metaagent.platform.domain.analytics.repository.WebhookEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final AgentRepository agentRepository;
    private final WebhookEventRepository webhookEventRepository;
    private final ConversationSessionRepository conversationSessionRepository;
    private final AgentPerformanceHourlyRepository agentPerformanceHourlyRepository;

    /**
     * RabbitMQ event listener for message.sent events
     */
    @RabbitListener(queues = "analytics-ingest")
    @Transactional
    public void handleAnalyticsLog(Map<String, Object> event) {
        log.info("Received RabbitMQ analytics log event: {}", event);
        try {
            Long accountId = ((Number) event.get("accountId")).longValue();
            Long agentId = ((Number) event.get("agentId")).longValue();
            Long conversationId = ((Number) event.get("conversationId")).longValue();
            String eventType = (String) event.get("eventType");
            String channel = (String) event.get("channel");
            long receivedAtMs = ((Number) event.get("receivedAt")).longValue();
            long processedAtMs = ((Number) event.get("processedAt")).longValue();
            int processingMs = ((Number) event.get("processingMs")).intValue();
            String status = (String) event.get("status");

            LocalDateTime receivedAt = LocalDateTime.ofInstant(Instant.ofEpochMilli(receivedAtMs), ZoneId.systemDefault());
            LocalDateTime processedAt = LocalDateTime.ofInstant(Instant.ofEpochMilli(processedAtMs), ZoneId.systemDefault());

            // 1. Write WebhookEvent
            WebhookEvent webhookEvent = WebhookEvent.builder()
                    .accountId(accountId)
                    .agentId(agentId)
                    .conversationId(conversationId)
                    .eventType(eventType)
                    .channel(channel)
                    .receivedAt(receivedAt)
                    .processedAt(processedAt)
                    .processingMs(processingMs)
                    .status(status)
                    .build();
            webhookEventRepository.save(webhookEvent);

            // 2. Upsert Conversation Session
            ConversationSession session = conversationSessionRepository.findByConversationId(conversationId)
                    .orElseGet(() -> ConversationSession.builder()
                            .accountId(accountId)
                            .agentId(agentId)
                            .conversationId(conversationId)
                            .channel(channel)
                            .startedAt(receivedAt)
                            .messageCount(0)
                            .resolved(false)
                            .build());

            session.setMessageCount(session.getMessageCount() + 1);
            conversationSessionRepository.save(session);

        } catch (Exception e) {
            log.error("Failed to parse and record analytics event: {}", e.getMessage());
        }
    }

    /**
     * Scheduled hourly rollup task (HH:05 aggregates prior hour)
     */
    @Scheduled(cron = "0 5 * * * *")
    @Transactional
    public void performHourlyRollup() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime rollupHour = now.minusHours(1).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endHour = rollupHour.plusHours(1);

        log.info("Executing hourly analytics rollup for hour: {}", rollupHour);

        try {
            List<Object[]> agents = agentPerformanceHourlyRepository.findActiveAgentAccountPairs(rollupHour, endHour);
            for (Object[] row : agents) {
                Long agentId = ((Number) row[0]).longValue();
                Long accountId = ((Number) row[1]).longValue();

                int received = 0;
                int sent = 0;
                List<Object[]> msgCounts = agentPerformanceHourlyRepository.countMessagesByDirection(agentId, rollupHour, endHour);
                for (Object[] msgRow : msgCounts) {
                    String direction = (String) msgRow[0];
                    int count = ((Number) msgRow[1]).intValue();
                    if ("inbound".equals(direction)) received = count;
                    else if ("outbound".equals(direction)) sent = count;
                }

                int opened = agentPerformanceHourlyRepository.countConversationsOpened(agentId, rollupHour, endHour);
                int closed = agentPerformanceHourlyRepository.countConversationsClosed(agentId, rollupHour, endHour);

                Double avgResponseVal = agentPerformanceHourlyRepository.avgResponseMs(agentId, rollupHour, endHour);
                double avgResponse = avgResponseVal != null ? avgResponseVal : 0.0;

                int errors = agentPerformanceHourlyRepository.countFailedWebhookEvents(agentId, rollupHour, endHour);

                AgentPerformanceHourly perf = AgentPerformanceHourly.builder()
                        .accountId(accountId)
                        .agentId(agentId)
                        .hour(rollupHour)
                        .messagesReceived(received)
                        .messagesSent(sent)
                        .conversationsOpened(opened)
                        .conversationsClosed(closed)
                        .avgResponseMs(avgResponse)
                        .p95ResponseMs(avgResponse)
                        .errors(errors)
                        .build();
                agentPerformanceHourlyRepository.save(perf);
            }
        } catch (Exception e) {
            log.error("Failed to execute hourly rollup aggregation: {}", e.getMessage(), e);
        }
    }

    /**
     * Compute Resolution Rate and details for a given agent.
     * Verifies the agent belongs to the caller's account before returning data.
     */
    public Map<String, Object> getAgentSummaryMetrics(Long agentId, LocalDateTime startTime, LocalDateTime endTime) {
        verifyAgentOwnership(agentId);
        Map<String, Object> summary = new HashMap<>();

        try {
            Object[] result = conversationSessionRepository.resolutionStats(agentId, startTime, endTime);
            long resolved = result[0] != null ? ((Number) result[0]).longValue() : 0L;
            long total = result[1] != null ? ((Number) result[1]).longValue() : 0L;
            double rate = total > 0 ? (resolved * 100.0) / total : 0.0;

            summary.put("totalConversations", total);
            summary.put("resolvedConversations", resolved);
            summary.put("resolutionRate", rate);

            Double avgResponseVal = agentPerformanceHourlyRepository.avgResponseMsForAgent(agentId, startTime, endTime);
            double avgResponse = avgResponseVal != null ? avgResponseVal : 0.0;
            summary.put("avgResponseTimeMs", avgResponse);

        } catch (Exception e) {
            log.error("Failed to compute agent summary metrics for agentId={}: {}", agentId, e.getMessage());
            summary.put("totalConversations", 0L);
            summary.put("resolvedConversations", 0L);
            summary.put("resolutionRate", 0.0);
            summary.put("avgResponseTimeMs", 0.0);
        }

        return summary;
    }

    public List<AgentPerformanceHourly> getHourlyAnalytics(Long agentId, LocalDateTime start, LocalDateTime end) {
        verifyAgentOwnership(agentId);
        return agentPerformanceHourlyRepository.findAllByAgentIdAndHourBetween(agentId, start, end);
    }

    /**
     * Tenant isolation: the agent must belong to the caller's account before any
     * analytics query runs. Fails closed — NotFoundException (not Forbidden) so
     * agent existence is not leaked across tenants.
     */
    private void verifyAgentOwnership(Long agentId) {
        Long callerAccountId = SecurityContextHelper.getRequiredAccountId();
        agentRepository.findByIdAndAccountId(agentId, callerAccountId)
                .orElseThrow(() -> new NotFoundException("Agent not found"));
    }
}
