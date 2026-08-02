package com.metaagent.platform.domain.reports.service;

import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.audit.ApiCallLog;
import com.metaagent.platform.infrastructure.meta.audit.ApiCallLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Thin proxy to Meta's agent-eval API. No local persistence — Meta's own
 * job_id/summary_id is the source of truth; we just re-poll through it on
 * demand. New domain (not AgentDeployService) because eval results are
 * cross-agent/aggregate content, the first real content in the platform's
 * Reports section.
 */
@Service
@RequiredArgsConstructor
public class ReportsService {

    private final AgentAccessService agentAccessService;
    private final MetaApiClient metaApiClient;
    private final ConversationRepository conversationRepository;
    private final ApiCallLogRepository apiCallLogRepository;

    public record ConversationsReport(long totalConversations, double successRate, Map<String, Long> byChannel) {}

    /**
     * Success = closed and never needed a human handoff. Cheapest honest
     * definition answerable from the schema today — no new column, no new
     * "outcome" concept invented for a metric nobody's precisely defined yet.
     */
    public ConversationsReport getConversationsReport(LocalDateTime from, LocalDateTime to) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        List<Conversation> conversations = conversationRepository.findAllByAccountId(accountId, PageRequest.of(0, 5000))
                .stream()
                .filter(c -> (from == null || !c.getStartedAt().isBefore(from)) && (to == null || !c.getStartedAt().isAfter(to)))
                .toList();

        long total = conversations.size();
        long successful = conversations.stream()
                .filter(c -> c.getStatus() == Conversation.Status.closed && !c.isNeedsHuman())
                .count();
        double successRate = total == 0 ? 0.0 : (double) successful / total;

        Map<String, Long> byChannel = conversations.stream()
                .collect(java.util.stream.Collectors.groupingBy(c -> c.getChannel().name(), java.util.stream.Collectors.counting()));

        return new ConversationsReport(total, successRate, byChannel);
    }

    public List<ApiCallLog> getApiCallLog(int limit) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return apiCallLogRepository.findAllByAccountIdOrderByCalledAtDesc(accountId, PageRequest.of(0, Math.min(limit, 200)));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> listEvalCases(Long agentId) {
        String phoneNumberId = phoneNumberIdFor(agentId);
        return metaApiClient.get("/" + phoneNumberId + "/agent-eval/cases", Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> runEval(Long agentId, String evalCaseIds, Map<String, Object> body) {
        String phoneNumberId = phoneNumberIdFor(agentId);
        String path = "/" + phoneNumberId + "/agent-eval/run?eval_case_ids=" + evalCaseIds;
        return metaApiClient.post(path, body, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> pollEvalRun(Long agentId, String jobId) {
        String phoneNumberId = phoneNumberIdFor(agentId);
        return metaApiClient.get("/" + phoneNumberId + "/agent-eval/run?job_id=" + jobId, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getEvalDetails(Long agentId, String evalIds) {
        String phoneNumberId = phoneNumberIdFor(agentId);
        return metaApiClient.get("/" + phoneNumberId + "/agent-eval/details?eval_ids=" + evalIds, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getEvalSummary(Long agentId, String summaryIds) {
        String phoneNumberId = phoneNumberIdFor(agentId);
        return metaApiClient.get("/" + phoneNumberId + "/agent-eval/summary?summary_ids=" + summaryIds, Map.class);
    }

    private String phoneNumberIdFor(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Agent agent = agentAccessService.getAccessible(agentId, accountId);
        if (agent.getPhoneNumberId() == null) {
            throw new com.metaagent.platform.common.exception.BusinessException("Connect a phone number before running evaluations.");
        }
        return agent.getPhoneNumberId();
    }
}
