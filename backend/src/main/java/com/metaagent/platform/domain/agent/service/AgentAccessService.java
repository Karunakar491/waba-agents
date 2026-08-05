package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Single place that answers "can this account touch this Agent" — every
 * caller across domains (AgentService, AgentDeployService, ReportsService,
 * AnalyticsService) goes through here instead of querying AgentRepository
 * with account_id directly, so the 2026-07-28 decoupling decision (access
 * via waba_account_access, not Agent.accountId) lives in one place.
 *
 * A bound agent (wabaId set) is accessible to any account with a
 * waba_account_access grant on that WABA. An unbound draft (wabaId null)
 * is accessible only to its original creator — nothing to share yet.
 */
@Service
@RequiredArgsConstructor
public class AgentAccessService {

    private final AgentRepository agentRepository;
    private final WabaAccessGuard wabaAccessGuard;
    private final WabaAccountAccessRepository wabaAccountAccessRepository;

    public Agent getAccessible(Long agentId, Long accountId) {
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new NotFoundException("Agent not found"));
        if (!hasAccess(agent, accountId)) {
            throw new NotFoundException("Agent not found");
        }
        withSharedCount(agent);
        return agent;
    }

    public List<Agent> listAccessible(Long accountId) {
        List<Agent> agents = agentRepository.findAllAccessibleByAccount(accountId);
        agents.forEach(this::withSharedCount);
        return agents;
    }

    private boolean hasAccess(Agent agent, Long accountId) {
        if (agent.getWabaId() != null) {
            return wabaAccessGuard.hasAccess(agent.getWabaId(), accountId);
        }
        return accountId.equals(agent.getAccountId());
    }

    private void withSharedCount(Agent agent) {
        if (agent.getWabaId() != null) {
            agent.setSharedAccountCount((int) wabaAccountAccessRepository.countByWabaId(agent.getWabaId()));
        }
    }
}
