package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.AgentTestRequest;
import com.metaagent.platform.domain.agent.dto.AgentTestResponse;
import com.metaagent.platform.domain.agent.dto.ConnectorDtos;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import com.metaagent.platform.infrastructure.meta.ThreadControlClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
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
    private final WabaAccessGuard wabaAccessGuard;
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

    private static final java.util.Set<String> VALID_AI_AUDIENCE = java.util.Set.of("EVERYONE", "ALLOWLISTED_ONLY");

    /**
     * Sets ai_audience (settings.md) — the field that gates whether Meta
     * responds to EVERYONE or only ALLOWLISTED_ONLY numbers. Until now this
     * field was only ever read-and-preserved (Wave 1a) on deploy/pause/bind;
     * this is the first path that lets an operator actually change it —
     * needed for QA against known test numbers and client-controlled phased
     * rollouts (both real, founder-confirmed use cases, 2026-08-04).
     *
     * Same read-modify-write as putSettings(): preserve rollout/handoff/
     * followup exactly as they are, only replace ai_audience.
     */
    @Transactional
    public void updateAiAudience(Long agentId, String aiAudience) {
        if (!VALID_AI_AUDIENCE.contains(aiAudience)) {
            throw new BusinessException("ai_audience must be EVERYONE or ALLOWLISTED_ONLY");
        }
        synchronized (lockFor(agentId)) {
            Agent agent = loadOwnedAgent(agentId);
            requirePhoneNumberId(agent);
            String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/settings", agent.getMetaAgentId());

            // EL-caught: unlike putSettings(agent, enabled), this method has no
            // caller-supplied rollout truth — deploy()/pause() always know the
            // intended rollout state because THEY set it. Here, a failed live
            // read has nothing safe to fall back to: guessing rollout from
            // local Agent.status risks silently flipping a live agent's real
            // Meta state as a side effect of an audience-only change, which
            // contradicts this method's whole purpose (change ai_audience
            // ONLY). Abort instead of guessing.
            Map<String, Object> live = readLiveWhatsappSettings(agent.getPhoneNumberId(), agent.getMetaAgentId());
            if (live == null) {
                throw new BusinessException(
                        "Could not read current agent settings from Meta — ai_audience unchanged. Try again.");
            }
            Object rollout = live.get("rollout") != null
                    ? live.get("rollout") : Map.of("enabled", agent.getStatus() == Agent.Status.active);
            Object followup = live.get("followup");

            Map<String, Object> handoff = agent.getHandoffMessage() != null
                    ? Map.of("enabled", agent.isHandoffEnabled(), "message", agent.getHandoffMessage())
                    : Map.of("enabled", agent.isHandoffEnabled());

            Map<String, Object> payload = new HashMap<>();
            payload.put("rollout", rollout);
            payload.put("handoff", handoff);
            payload.put("followup", followup != null ? followup : Map.of("enabled", false));
            payload.put("ai_audience", aiAudience);

            try {
                metaApiClient.put(path, payload, Map.class);
            } catch (Exception e) {
                throw new BusinessException("Meta settings update failed — ai_audience unchanged: " + e.getMessage());
            }
        }
    }

    // -------------------------------------------------------------------------
    // Allowlist — agent_config/allowlist (allowlist.md). Meta's API is
    // add-one/list/delete-by-id, NOT full-replace like settings — do not
    // build a full-replace abstraction over it (unearned; Meta's own shape
    // already fits the UI's add/remove-one-at-a-time interaction).
    // -------------------------------------------------------------------------

    /** Meta returns a bare JSON array (allowlist.md) — List.class, matching listTools()'s pattern. */
    @SuppressWarnings("unchecked")
    public List<Object> getAllowlist(Long agentId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/allowlist", agent.getMetaAgentId());
        try {
            return metaApiClient.get(path, List.class);
        } catch (MetaApiException e) {
            if (e.isNotFound()) {
                return List.of();
            }
            throw e;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> addToAllowlist(Long agentId, String consumerPhoneNumber) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/allowlist", agent.getMetaAgentId());
        return metaApiClient.post(path, Map.of("consumer_phone_number", consumerPhoneNumber), Map.class);
    }

    public void removeFromAllowlist(Long agentId, String entryId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/allowlist/" + entryId, agent.getMetaAgentId());
        metaApiClient.delete(path);
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

    /** Rotates a connector's API key credentials without recreating the connector (connectors.md POST /{connector_id}/upsertApiKey). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> upsertConnectorApiKey(Long agentId, String connectorId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/upsertApiKey", agent.getMetaAgentId());
        return metaApiClient.post(path, payload, Map.class);
    }

    /** Rotates a connector's mTLS certificate without recreating the connector (connectors.md POST /{connector_id}/upsertCertificate). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> upsertConnectorCertificate(Long agentId, String connectorId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/upsertCertificate", agent.getMetaAgentId());
        return metaApiClient.post(path, payload, Map.class);
    }

    /** Rotates a connector's OAuth 2.0 credentials without recreating the connector (connectors.md POST /{connector_id}/upsertOAuth). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> upsertConnectorOAuth(Long agentId, String connectorId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/upsertOAuth", agent.getMetaAgentId());
        return metaApiClient.post(path, payload, Map.class);
    }

    /** Meta's logs query surface: debugging (start/end/tool/limit) plus the analytics/stats surface (include_stats/summary_only/top_n — docs/meta-api/connectors.md). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getConnectorLogs(Long agentId, String connectorId, String startTime, String endTime, String toolId, Integer limit,
                                                 Boolean includeStats, Boolean summaryOnly, Integer topN) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);

        List<String> params = new java.util.ArrayList<>();
        if (startTime != null) params.add("start_time=" + startTime);
        if (endTime != null) params.add("end_time=" + endTime);
        if (toolId != null) params.add("tool_id=" + toolId);
        if (limit != null) params.add("limit=" + limit);
        if (includeStats != null) params.add("include_stats=" + includeStats);
        if (summaryOnly != null) params.add("summary_only=" + summaryOnly);
        if (topN != null) params.add("top_n=" + topN);

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
        wabaAccessGuard.requireAccess(wabaId, accountId);
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
                    String status = null;
                    if (m.get("connection_status") instanceof Map<?, ?> connectionStatus) {
                        Object statusValue = connectionStatus.get("status");
                        status = statusValue != null ? statusValue.toString() : null;
                    }
                    rows.add(new ConnectorDtos.ConnectorRow(
                            id != null ? id.toString() : null,
                            name != null ? name.toString() : "Unnamed connector",
                            String.valueOf(agent.getId()),
                            agent.getDisplayName(),
                            agent.getPhoneNumberId(),
                            status
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

    @SuppressWarnings("unchecked")
    public Map<String, Object> getTool(Long agentId, String connectorId, String toolId) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools/" + toolId, agent.getMetaAgentId());
        return metaApiClient.get(path, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> updateTool(Long agentId, String connectorId, String toolId, Map<String, Object> payload) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        String path = MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors/" + connectorId + "/tools/" + toolId, agent.getMetaAgentId());
        return metaApiClient.put(path, payload, Map.class);
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
     *
     * @param customerPhone thread-control.md's "to" field — the specific
     *                       conversation to release. Optional per Meta's docs,
     *                       but omitting it means release() targets the whole
     *                       number rather than one conversation (EL-flagged
     *                       gap, Wave 2 2026-08-03) — pass it whenever known.
     */
    public void releaseThreadControl(Long agentId, String customerPhone) {
        Agent agent = loadOwnedAgent(agentId);
        requirePhoneNumberId(agent);
        threadControlClient.release(agent.getPhoneNumberId(), customerPhone);
        log.info("Thread control released: agentId={} phoneNumberId={} to={}", agentId, agent.getPhoneNumberId(), customerPhone);
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

        // Settings PUT is a full replace (settings.md) — followup and
        // ai_audience are real operator-configured fields we don't manage
        // here, so hardcoding them (as this used to) silently destroyed a
        // client's real audience restriction / followup config on every
        // deploy, pause, or bindPhone. Read the live WhatsApp-channel entry
        // first and carry those two fields through unchanged. Confirmed live
        // (Wave 0, 2026-08-03): Meta's GET returns them in full when set —
        // a genuine read-modify-write, not a guess. A failed read has
        // nothing to preserve, so it falls back to Meta's own documented
        // defaults (followup off, ai_audience EVERYONE) rather than blocking
        // deploy/pause.
        Map<String, Object> live = readLiveWhatsappSettings(agent.getPhoneNumberId(), agent.getMetaAgentId());
        Object followup = live != null ? live.get("followup") : null;
        Object aiAudience = live != null ? live.get("ai_audience") : null;

        // Handoff is a real per-agent setting (settings.md handoff.{enabled,message}) —
        // never hardcode this off; it reflects the operator's configured toggle.
        Map<String, Object> handoff = agent.getHandoffMessage() != null
                ? Map.of("enabled", agent.isHandoffEnabled(), "message", agent.getHandoffMessage())
                : Map.of("enabled", agent.isHandoffEnabled());

        Map<String, Object> payload = new HashMap<>();
        payload.put("rollout", Map.of("enabled", enabled));
        payload.put("handoff", handoff);
        payload.put("followup", followup != null ? followup : Map.of("enabled", false));
        payload.put("ai_audience", aiAudience != null ? aiAudience : "EVERYONE");

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

    /**
     * Best-effort read of the live WhatsApp-channel settings entry — returns
     * null (never throws) on any failure, so a read hiccup falls back to
     * safe Meta defaults rather than blocking deploy/pause. Scoped the same
     * way the actual PUT/getSettings() reads already are (EL review,
     * 2026-08-03) — harmless today (one agent per number) but removes any
     * chance of ever reading a different agent's settings on this path.
     */
    private Map<String, Object> readLiveWhatsappSettings(String phoneNumberId, String metaAgentId) {
        String path = MetaApiClient.scopedPath("/" + phoneNumberId + "/agent_config/settings", metaAgentId);
        try {
            List<?> settings = metaApiClient.get(path, List.class);
            return MetaApiClient.findChannelEntry(settings, "whatsapp");
        } catch (MetaApiException e) {
            // Not deployed yet — nothing configured on Meta's side for a
            // brand-new agent's first deploy. Routine, not a failure.
            if (e.isNotFound()) {
                log.debug("No live settings yet (first deploy): phoneNumberId={}", phoneNumberId);
            } else {
                log.warn("Could not read live settings before PUT — proceeding with safe defaults (followup off, EVERYONE): phoneNumberId={} error={}", phoneNumberId, e.getMessage());
            }
            return null;
        } catch (Exception e) {
            log.warn("Could not read live settings before PUT — proceeding with safe defaults (followup off, EVERYONE): phoneNumberId={} error={}", phoneNumberId, e.getMessage());
            return null;
        }
    }

    private Agent loadOwnedAgent(Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return agentAccessService.getAccessible(agentId, accountId);
    }
}
