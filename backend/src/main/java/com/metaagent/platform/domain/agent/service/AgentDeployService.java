package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.AgentTestRequest;
import com.metaagent.platform.domain.agent.dto.AgentTestResponse;
import com.metaagent.platform.domain.agent.dto.ConnectorDtos;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import com.metaagent.platform.infrastructure.meta.ThreadControlClient;
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
    private final AgentAccessService agentAccessService;
    private final WabaAccountAccessRepository wabaAccountAccessRepository;
    private final MetaApiClient metaApiClient;
    private final ThreadControlClient threadControlClient;

    // Per-agentId lock — two accounts on a shared WABA could otherwise call
    // deploy/pause/deleteFromMeta on the same Agent concurrently. Copy of the
    // pattern already proven in BusinessProfileDeployService/AgentService;
    // not yet extracted to a shared utility.
    private final java.util.concurrent.ConcurrentHashMap<Long, Object> agentLocks = new java.util.concurrent.ConcurrentHashMap<>();

    private Object lockFor(Long agentId) {
        return agentLocks.computeIfAbsent(agentId, k -> new Object());
    }

    @Transactional
    public Agent deploy(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        synchronized (lockFor(agentId)) {
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
            putSettings(agent, true);
            log.info("Agent deployed on Meta: agentId={} phoneNumberId={}", agentId, agent.getPhoneNumberId());

            // Step 2: Reflect confirmed state in DB
            agent.setStatus(Agent.Status.active);
            agent.setDeployedAt(LocalDateTime.now());
            agent.setUpdatedBy(accountId);
            return agentRepository.save(agent);
        }
    }

    @Transactional
    public Agent pause(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        synchronized (lockFor(agentId)) {
            Agent agent = loadOwnedAgent(agentId);

            if (agent.getStatus() == Agent.Status.paused || agent.getStatus() == Agent.Status.draft) {
                throw new BusinessException("Agent is not currently active");
            }

            // Step 1: Disable on Meta — Meta AI stops responding
            putSettings(agent, false);
            log.info("Agent paused on Meta: agentId={} phoneNumberId={}", agentId, agent.getPhoneNumberId());

            // Step 2: Reflect confirmed state in DB
            agent.setStatus(Agent.Status.paused);
            agent.setUpdatedBy(accountId);
            return agentRepository.save(agent);
        }
    }

    /**
     * Read-through — lets an operator see current rollout/handoff/followup state
     * without cross-referencing our own DB against what may have drifted on
     * Meta's side. Meta returns a JSON array here (confirmed in settings.md and
     * already handled correctly by WabaService.deployPreflight) — not a single
     * object like most other GETs in this file.
     */
    public List<?> getSettings(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/settings", agent.getMetaAgentId());
        try {
            return metaApiClient.get(path, List.class);
        } catch (MetaApiException e) {
            // Not deployed yet — nothing configured on Meta's side, not an error.
            if (e.isNotFound()) {
                return List.of();
            }
            throw e;
        }
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

    /** Meta returns a bare JSON array here (confirmed 2026-07-28 via api_call_log), not an object — List.class, not Map.class. */
    @SuppressWarnings("unchecked")
    public List<Object> listConnectors(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors", agent.getMetaAgentId());
        return metaApiClient.get(path, List.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createConnector(Long agentId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors", agent.getMetaAgentId());
        return metaApiClient.post(path, payload, Map.class);
    }

    public void deleteConnector(Long agentId, String connectorId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId, agent.getMetaAgentId());
        metaApiClient.delete(path);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getConnector(Long agentId, String connectorId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId, agent.getMetaAgentId());
        return metaApiClient.get(path, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> updateConnector(Long agentId, String connectorId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId, agent.getMetaAgentId());
        return metaApiClient.put(path, payload, Map.class);
    }

    /** Minimal slice of Meta's logs query surface (start/end/tool/limit) — the debugging read, not the analytics/stats surface (deferred, see project memory). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getConnectorLogs(Long agentId, String connectorId, String startTime, String endTime, String toolId, Integer limit) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);

        List<String> params = new java.util.ArrayList<>();
        if (startTime != null) params.add("start_time=" + startTime);
        if (endTime != null) params.add("end_time=" + endTime);
        if (toolId != null) params.add("tool_id=" + toolId);
        if (limit != null) params.add("limit=" + limit);

        String basePath = "/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/logs"
                + (params.isEmpty() ? "" : "?" + String.join("&", params));
        String path = MetaApiClient.scopedPath(basePath, agent.getMetaAgentId());
        return metaApiClient.get(path, Map.class);
    }

    /**
     * TASK-064 aggregate view: every connector live on any agent on this WABA.
     * PM+EM gate (2026-07-30): live fan-out (Option A), no local mirror table —
     * reuses the same per-agent try/catch-404-as-empty pattern already proven
     * in WabaService.deployPreflight. One agent's Meta failure never fails the
     * whole table — it's just skipped with a warning log.
     */
    @SuppressWarnings("unchecked")
    public List<ConnectorDtos.ConnectorRow> listConnectorsForWaba(Long wabaId, Long accountId) {
        if (!wabaAccountAccessRepository.existsByWabaIdAndAccountId(wabaId, accountId)) {
            throw new BusinessException("You don't have access to this WABA's connectors.");
        }
        List<Agent> agents = agentRepository.findAllByWabaId(wabaId).stream()
                .filter(a -> a.getPhoneNumberId() != null)
                .toList();

        List<ConnectorDtos.ConnectorRow> rows = new java.util.ArrayList<>();
        for (Agent agent : agents) {
            List<Object> connectors;
            try {
                String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors", agent.getMetaAgentId());
                connectors = metaApiClient.get(path, List.class);
            } catch (MetaApiException e) {
                if (e.isNotFound()) continue; // no connectors configured on this number yet
                log.warn("Aggregate connectors fetch failed for agentId={}: {}", agent.getId(), e.getMessage());
                continue;
            } catch (Exception e) {
                log.warn("Aggregate connectors fetch failed for agentId={}: {}", agent.getId(), e.getMessage());
                continue;
            }
            if (connectors == null) continue;
            for (Object entry : connectors) {
                if (entry instanceof Map<?, ?> m) {
                    Object id = m.get("id");
                    Object name = m.get("name");
                    rows.add(new ConnectorDtos.ConnectorRow(
                            id != null ? id.toString() : null,
                            name != null ? name.toString() : "Unnamed connector",
                            String.valueOf(agent.getId()),
                            agent.getDisplayName(),
                            agent.getPhoneNumberId()
                    ));
                }
            }
        }
        return rows;
    }

    // -------------------------------------------------------------------------
    // Tools — thin proxies, no DB writes
    // -------------------------------------------------------------------------

    /** Meta returns a bare JSON array here (confirmed 2026-07-28 via api_call_log), not an object — List.class, not Map.class. */
    @SuppressWarnings("unchecked")
    public List<Object> listTools(Long agentId, String connectorId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools", agent.getMetaAgentId());
        return metaApiClient.get(path, List.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createTool(Long agentId, String connectorId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools", agent.getMetaAgentId());
        return metaApiClient.post(path, payload, Map.class);
    }

    public void deleteTool(Long agentId, String connectorId, String toolId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools/" + toolId, agent.getMetaAgentId());
        metaApiClient.delete(path);
    }

    /**
     * Test-executes a tool against its real external API — the actual
     * validation mechanism for a connector, not just another CRUD verb (PM
     * gate 2026-07-28: elevated to P0 alongside the rest of this pass).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> runTool(Long agentId, String connectorId, String toolId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools/" + toolId + "/run", agent.getMetaAgentId());
        return metaApiClient.post(path, payload, Map.class);
    }

    /**
     * Removes the agent config from Meta (DELETE .../delete_agent) and resets
     * this agent back to draft/unconnected. Backend-enforced guardrail (not
     * just a UI confirm dialog): only callable while PAUSED — this fires
     * against a real client's live WhatsApp number, so "already stopped
     * responding" must be true before we let it be decommissioned.
     * Distinct from AgentService.deleteAgent(), which soft-deletes our own
     * row and never calls Meta at all.
     */
    @Transactional
    public Agent deleteFromMeta(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        synchronized (lockFor(agentId)) {
            Agent agent = loadOwnedAgent(agentId);

            if (agent.getStatus() != Agent.Status.paused) {
                throw new BusinessException("Pause the agent before removing it from Meta.");
            }
            if (agent.getPhoneNumberId() == null) {
                throw new BusinessException("This agent isn't connected to a phone number.");
            }

            String path = "/" + agent.getPhoneNumberId() + "/delete_agent";
            try {
                metaApiClient.delete(path);
            } catch (Exception e) {
                throw new BusinessException("Meta delete_agent call failed — agent state unchanged: " + e.getMessage());
            }

            log.info("Agent removed from Meta: agentId={} phoneNumberId={}", agentId, agent.getPhoneNumberId());

            agent.setPhoneNumberId(null);
            agent.setWabaId(null);
            agent.setMetaAgentId(null);
            agent.setStatus(Agent.Status.draft);
            agent.setDeployedAt(null);
            agent.setUpdatedBy(accountId);
            return agentRepository.save(agent);
        }
    }

    // -------------------------------------------------------------------------
    // Agent Event — fire-and-forget business-event trigger, thin proxy
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    public Map<String, Object> triggerEvent(Long agentId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_event";
        return metaApiClient.post(path, payload, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getEventStatus(Long agentId, String agentEventId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = "/" + agent.getPhoneNumberId() + "/agent_event/" + agentEventId;
        return metaApiClient.get(path, Map.class);
    }

    /**
     * Releases thread control back to Meta Business Agent — the AI resumes
     * responding to NEW messages on this number. No DB state to update; this
     * is a pure proxy to Meta's Thread Control API.
     */
    public void releaseThreadControl(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        threadControlClient.release(agent.getPhoneNumberId());
        log.info("Thread control released: agentId={} phoneNumberId={}", agentId, agent.getPhoneNumberId());
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private void requirePhoneNumberId(Agent agent) {
        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException("Connect a phone number first to use connectors.");
        }
    }

    @SuppressWarnings("unchecked") // Meta returns dynamic JSON — Map<String,Object> matches BizAIOmniChannelSettingsResponse
    private void putSettings(Agent agent, boolean enabled) {
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/settings", agent.getMetaAgentId());

        // Settings PUT is a full replace — always send all fields.
        // Handoff is a real per-agent setting (settings.md handoff.{enabled,message}) —
        // never hardcode this off; it reflects the operator's configured toggle.
        Map<String, Object> handoff = agent.getHandoffMessage() != null
                ? Map.of("enabled", agent.isHandoffEnabled(), "message", agent.getHandoffMessage())
                : Map.of("enabled", agent.isHandoffEnabled());

        Map<String, Object> payload = Map.of(
                "rollout", Map.of("enabled", enabled),
                "handoff", handoff,
                "followup", Map.of("enabled", false),
                "ai_audience", "EVERYONE"
        );

        Map<String, Object> response;
        try {
            response = metaApiClient.put(path, payload, Map.class);
        } catch (Exception e) {
            throw new BusinessException(
                    "Meta settings update failed — agent state unchanged: " + e.getMessage());
        }

        // Write-once: never overwrite an already-recorded agent_id.
        if (agent.getMetaAgentId() == null && response != null && response.get("agent_id") != null) {
            agent.setMetaAgentId(response.get("agent_id").toString());
            agentRepository.save(agent);
        }
    }

    private Agent loadOwnedAgent(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return agentAccessService.getAccessible(agentId, accountId);
    }
}
