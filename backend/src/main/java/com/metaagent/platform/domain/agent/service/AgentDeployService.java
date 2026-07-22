package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.AgentTestRequest;
import com.metaagent.platform.domain.agent.dto.AgentTestResponse;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Manages the live/paused state of a Meta Business Agent.
 *
 * Deploy sequence (from Meta API spec):
 *   1. Verify phone number eligibility
 *   2. PUT /agent_config/settings with rollout.enabled = true  ← Meta starts responding
 *   3. Mark agent ACTIVE in our DB
 *
 * Pause sequence:
 *   1. PUT /agent_config/settings with rollout.enabled = false ← Meta stops responding
 *   2. Mark agent PAUSED in our DB
 *
 * Rule: Meta API first, DB second. DB reflects confirmed external state only.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentDeployService {

    private final AgentRepository agentRepository;
    private final MetaApiClient metaApiClient;

    @Transactional
    public Agent deploy(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);

        if (agent.getStatus() == Agent.Status.active) {
            throw new BusinessException("Agent is already active");
        }

        if (agent.getStatus() == Agent.Status.deleted) {
            throw new BusinessException("Cannot deploy a deleted agent");
        }

        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException("Connect a phone number before deploying this agent.");
        }

        // Step 1: Enable on Meta — Meta AI starts responding to customers
        putSettings(agent.getPhoneNumberId(), true);
        log.info("Agent deployed on Meta: agentId={} phoneNumberId={}", agentId, agent.getPhoneNumberId());

        // Step 2: Reflect confirmed state in DB
        agent.setStatus(Agent.Status.active);
        agent.setDeployedAt(LocalDateTime.now());
        return agentRepository.save(agent);
    }

    @Transactional
    public Agent pause(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);

        if (agent.getStatus() == Agent.Status.paused || agent.getStatus() == Agent.Status.draft) {
            throw new BusinessException("Agent is not currently active");
        }

        // Step 1: Disable on Meta — Meta AI stops responding
        putSettings(agent.getPhoneNumberId(), false);
        log.info("Agent paused on Meta: agentId={} phoneNumberId={}", agentId, agent.getPhoneNumberId());

        // Step 2: Reflect confirmed state in DB
        agent.setStatus(Agent.Status.paused);
        return agentRepository.save(agent);
    }

    /**
     * Proxy a test message to Meta's agent_test API and return the response.
     * Agent must be active (rollout enabled) for Meta to respond.
     * No state written — pure read-through proxy with a 10s timeout enforced by the HTTP client.
     */
    @SuppressWarnings("unchecked")
    public AgentTestResponse test(Long agentId, AgentTestRequest request) {
        Agent agent = loadOwnedAgent(agentId);

        if (agent.getStatus() != Agent.Status.active) {
            throw new BusinessException("Deploy your agent first to test it.");
        }

        String path = "/" + agent.getPhoneNumberId() + "/agent_test";
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("user_msg", request.userMsg());
        if (request.conversationId() != null) {
            payload.put("conversation_id", request.conversationId());
        }

        Map<?, ?> raw;
        try {
            raw = metaApiClient.post(path, payload, Map.class);
        } catch (Exception e) {
            throw new BusinessException("Meta test API failed: " + e.getMessage());
        }

        if (raw == null) {
            throw new BusinessException("Empty response from Meta test API.");
        }

        List<String> quickReplies = raw.get("quick_replies") instanceof List<?> list
                ? list.stream().map(Object::toString).toList()
                : List.of();

        return new AgentTestResponse(
                (String) raw.get("message_id"),
                (String) raw.get("agent_response"),
                (String) raw.get("conversation_id"),
                (String) raw.get("handoff_reason"),
                (String) raw.get("no_response_reason"),
                quickReplies
        );
    }

    // -------------------------------------------------------------------------
    // Connectors — thin proxies, no DB writes
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    public Map<String, Object> listConnectors(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_connectors";
        return metaApiClient.get(path, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createConnector(Long agentId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_connectors";
        return metaApiClient.post(path, payload, Map.class);
    }

    public void deleteConnector(Long agentId, String connectorId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId;
        metaApiClient.delete(path);
    }

    // -------------------------------------------------------------------------
    // Tools — thin proxies, no DB writes
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    public Map<String, Object> listTools(Long agentId, String connectorId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools";
        return metaApiClient.get(path, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createTool(Long agentId, String connectorId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools";
        return metaApiClient.post(path, payload, Map.class);
    }

    public void deleteTool(Long agentId, String connectorId, String toolId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools/" + toolId;
        metaApiClient.delete(path);
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private void requirePhoneNumberId(Agent agent) {
        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException("Connect a phone number first to use connectors.");
        }
    }

    private void putSettings(String phoneNumberId, boolean enabled) {
        String path = "/" + phoneNumberId + "/agent_config/settings";

        // Settings PUT is a full replace — always send all fields
        Map<String, Object> payload = Map.of(
                "rollout", Map.of("enabled", enabled),
                "handoff", Map.of("enabled", false),
                "followup", Map.of("enabled", false),
                "ai_audience", "EVERYONE"
        );

        try {
            metaApiClient.put(path, payload, Map.class);
        } catch (Exception e) {
            throw new BusinessException(
                    "Meta settings update failed — agent state unchanged: " + e.getMessage());
        }
    }

    private Agent loadOwnedAgent(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return agentRepository.findByIdAndAccountId(agentId, accountId)
                .orElseThrow(() -> new NotFoundException("Agent not found"));
    }
}
