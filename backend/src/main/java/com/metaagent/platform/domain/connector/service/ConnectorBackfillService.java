package com.metaagent.platform.domain.connector.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.connector.entity.Connector;
import com.metaagent.platform.domain.connector.entity.ConnectorAction;
import com.metaagent.platform.domain.connector.entity.ConnectorDeployment;
import com.metaagent.platform.domain.connector.repository.ConnectorActionRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorDeploymentRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The fifth backfill, alongside MetaMirrorReconciler's skills/FAQs/files/
 * websites: a connector can be live on Meta while our library holds none of
 * the actions it is made of.
 *
 * That is not hypothetical. On 2026-09-20 three IndiaMART connectors were
 * serving the oldest agent on the account with zero connector_action rows
 * between them, which left them unusable in every direction at once — Publish
 * disabled ("Requires at least one action"), Delete disabled ("On 1 agent"),
 * and name/description editable but unpublishable. Their tools existed on
 * Meta the whole time. This reads them back.
 *
 * WHY THIS TALKS TO MetaApiClient AND NOT AgentDeployService
 * Every public method on AgentDeployService begins with loadOwnedAgent() →
 * SecurityContextHelper.getRequiredAccountId(), which reads SecurityContextHolder
 * and throws when it is empty. The only code that ever populates one is
 * JwtAuthFilter, on an HTTP request thread. This runs from the hourly
 * @Scheduled sweep and the async login fan-out, which carry the account in
 * BackgroundCallContext instead — see MetaMirrorReconciler's own class javadoc
 * saying never to call that from a scheduled thread. Routed through
 * AgentDeployService this would have thrown on every run, been swallowed by
 * its own catch, and shipped as a feature that silently did nothing.
 *
 * MUST NEVER INJECT ConnectorLibraryService. That edge closes a bean cycle —
 * MetaMirrorReconciler → ConnectorLibraryService → AgentService → MetaMirrorReconciler
 * — and Spring fails at startup. The few lines of field mapping shared with
 * ConnectorLibraryService.createAction are duplicated deliberately for that
 * reason.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConnectorBackfillService {

    private final ConnectorRepository connectorRepository;
    private final ConnectorActionRepository connectorActionRepository;
    private final ConnectorDeploymentRepository deploymentRepository;
    private final MetaApiClient metaApiClient;
    private final ObjectMapper objectMapper;

    /** Matches ConnectorAction.name (default 255) and description (1024). */
    private static final int NAME_MAX = 255;
    private static final int DESCRIPTION_MAX = 1024;

    /**
     * Kill switch. Field injection, not in the Lombok constructor, matching
     * ConnectorLibraryService's tool-sync flag. Default ON: connectors are
     * dead-ended today for want of this, so shipping it dormant would leave
     * them broken. Set false and restart to stop it without a redeploy.
     */
    @Value("${connector.action-backfill.enabled:true}")
    private boolean enabled = true;

    /**
     * Never throws — the caller bundles this with four other backfills and has
     * no try/catch of its own.
     */
    public void ensureConnectorsBackfilled(Agent agent) {
        if (!enabled) return;
        if (agent.getPhoneNumberId() == null) return;
        // A Connector with a null wabaId is unreachable forever: requireWabaAccess
        // rejects null, so every later read, edit and delete of it 400s.
        if (agent.getWabaId() == null) return;

        try {
            String path = MetaApiClient.scopedPath(
                    "/" + agent.getPhoneNumberId() + "/agent_connectors", agent.getMetaAgentId());
            List<?> remote = metaApiClient.get(path, List.class);
            if (remote == null) return;

            // Exact identity. Never names: the name we send Meta is a lossy,
            // non-injective slug of the display name and is not stored, so
            // matching on it would silently pair the wrong rows.
            Map<String, ConnectorDeployment> byMetaId = deploymentsByMetaId(agent);
            if (byMetaId.isEmpty()) return;

            java.util.Set<String> liveOnMeta = new java.util.HashSet<>();
            for (Object item : remote) {
                if (!(item instanceof Map<?, ?> metaConnector)) continue;
                String metaId = str(metaConnector.get("id"));
                if (metaId == null) continue;
                liveOnMeta.add(metaId);

                ConnectorDeployment deployment = byMetaId.get(metaId);
                if (deployment == null) continue;          // not ours — orphan adoption is a later diff
                if (deployment.getDeployedAt() == null) continue; // never landed; nothing to read back

                // One bad connector must not cost this agent the rest of them.
                try {
                    backfillActions(agent, deployment, metaId);
                } catch (Exception e) {
                    log.warn("Connector action backfill failed: agentId={} connectorId={} error={}",
                            agent.getId(), deployment.getConnectorId(), e.getMessage());
                }
            }

            markAnythingMetaNoLongerLists(agent, byMetaId, liveOnMeta);
        } catch (Exception e) {
            log.warn("Connector backfill failed: agentId={} error={}", agent.getId(), e.getMessage());
        }
    }

    /**
     * A connector we believe is deployed, which Meta's own list of this
     * number's connectors does not contain, is not there any more — deleted or
     * rebuilt on Meta with nothing telling us.
     *
     * Driven off ABSENCE FROM THE LIST, not off a 404 on the per-connector
     * tools call. An earlier version did the latter and was wrong twice over:
     * a connector Meta has deleted never appears in the list, so it was never
     * visited and this could not fire for the case it exists for; and the only
     * way it COULD fire was a 404 for a connector Meta had just listed, which
     * this codebase already documents as benign ("404 means no connectors
     * configured on this number yet", WabaService) — so it would have marked a
     * live connector unpublished for the crime of having no tools yet.
     *
     * Clearing deployedAt is what makes the screen honest: published means
     * published to Meta, so a connector Meta does not have is a draft. Two
     * connectors on this account read "live on 1 agent" while Meta 404s on both.
     *
     * Only ever called with a list Meta actually returned. A timeout or a 500
     * throws before this point and leaves every row alone, which is the
     * behaviour that matters — an outage must never look like a mass deletion.
     */
    private void markAnythingMetaNoLongerLists(
            Agent agent, Map<String, ConnectorDeployment> byMetaId, java.util.Set<String> liveOnMeta) {
        for (Map.Entry<String, ConnectorDeployment> entry : byMetaId.entrySet()) {
            if (liveOnMeta.contains(entry.getKey())) continue;
            ConnectorDeployment deployment = entry.getValue();
            if (deployment.getDeployedAt() == null) continue; // already recorded

            try {
                deployment.setDeployedAt(null);
                deployment.setLastError("Meta no longer lists this connector. It was deleted or rebuilt there.");
                deployment.setToolSyncError(null);
                deploymentRepository.save(deployment);
                log.warn("Connector gone from Meta, marked not published: agentId={} connectorId={} metaConnectorId={}",
                        agent.getId(), deployment.getConnectorId(), deployment.getMetaConnectorId());
            } catch (Exception e) {
                log.warn("Could not mark connector as gone: agentId={} connectorId={} error={}",
                        agent.getId(), deployment.getConnectorId(), e.getMessage());
            }
        }
    }

    private Map<String, ConnectorDeployment> deploymentsByMetaId(Agent agent) {
        Map<String, ConnectorDeployment> byMetaId = new java.util.HashMap<>();
        for (ConnectorDeployment d : deploymentRepository.findAllByAgentIdIn(List.of(agent.getId()))) {
            if (d.getMetaConnectorId() != null) byMetaId.put(d.getMetaConnectorId(), d);
        }
        return byMetaId;
    }

    /**
     * Only ever fills an empty connector. The zero-rows guard is what makes the
     * hourly sweep free after the first success, and it is the same guard the
     * other four backfills use. Its known limit: a connector holding one
     * hand-made action is never topped up, so no surface may claim a connector
     * is fully in sync until reconcile-on-mismatch exists.
     */
    private void backfillActions(Agent agent, ConnectorDeployment deployment, String metaId) {
        Long connectorId = deployment.getConnectorId();
        if (!connectorActionRepository.findAllByConnectorIdOrderByNameAsc(connectorId).isEmpty()) return;

        Optional<Connector> owner = connectorRepository.findById(connectorId);
        if (owner.isEmpty()) return;
        Connector connector = owner.get();

        String path = MetaApiClient.scopedPath(
                "/" + agent.getPhoneNumberId() + "/agent_connectors/" + metaId + "/tools",
                agent.getMetaAgentId());
        List<?> tools = metaApiClient.get(path, List.class);
        if (tools == null) return;

        int reported = tools.size();
        int imported = 0;
        for (Object item : tools) {
            if (!(item instanceof Map<?, ?> tool)) continue;
            if (saveAction(connector, tool)) imported++;
        }

        // Written once, after the loop — a save per tool would multiply the
        // failure surface and the row churn for nothing. Inside the caller's
        // per-connector try/catch: there is no @Transactional here, so each
        // save is its own transaction and one failing row must not escape.
        deployment.setToolsReportedByMeta(reported);
        deployment.setToolsImported(imported);
        deploymentRepository.save(deployment);

        if (imported > 0) {
            // info, not debug: this is the line that proves a broken connector
            // was repaired, without anyone opening the database.
            log.info("Back-filled {} of {} Meta tools as actions: agentId={} connectorId={}",
                    imported, reported, agent.getId(), connectorId);
        }
        if (imported < reported) {
            log.warn("Some Meta tools could not be read: agentId={} connectorId={} imported={} reported={}",
                    agent.getId(), connectorId, imported, reported);
        }
    }

    /** @return true when a row was written. */
    private boolean saveAction(Connector connector, Map<?, ?> tool) {
        String name = truncate(str(tool.get("name")), NAME_MAX);
        String description = truncate(str(tool.get("description")), DESCRIPTION_MAX);
        // Both columns are NOT NULL, and description is what the agent reads to
        // decide WHEN to call this — a blank one is worse than no row at all.
        if (name == null || description == null) return false;

        String requestDefinition = readDefinition(tool.get("request_definition"));
        // Deliberately no fallback to "{}". An empty object is a valid-looking
        // payload, so a tool stored that way would be pushed to Meta on the next
        // deploy as something that silently does nothing. Skipping is honest;
        // the count in the caller's log records that we did.
        if (requestDefinition == null) return false;

        if (connectorActionRepository.existsByConnectorIdAndName(connector.getId(), name)) return false;

        connectorActionRepository.save(ConnectorAction.builder()
                // Inherited from the parent connector, exactly as createAction
                // does — ConnectorDeployment carries no accountId of its own.
                .accountId(connector.getAccountId())
                .connectorId(connector.getId())
                .name(name)
                .description(description)
                .requestDefinition(requestDefinition)
                .userAuthRequired(Boolean.TRUE.equals(tool.get("user_auth_required")))
                .build());
        return true;
    }

    /**
     * Meta's request_definition, kept exactly as Meta sent it.
     *
     * Deliberately not re-encoded into "our" shape: nested body nodes are
     * recursively JSON-encoded strings and the codebase's own note on
     * normalizeForCompare says what Meta returns from a GET is NOT verified to
     * match what we send. Re-encoding would be guessing. Storing verbatim is
     * safe because differs() normalises both sides before comparing, so an
     * imported action and a hand-made one still compare equal.
     *
     * @return the JSON object as a string, or null if there isn't one.
     */
    private String readDefinition(Object raw) {
        try {
            JsonNode node;
            if (raw instanceof Map || raw instanceof List) {
                node = objectMapper.valueToTree(raw);
            } else if (raw instanceof String s && !s.isBlank()) {
                node = objectMapper.readTree(s);
            } else {
                return null;
            }
            return node != null && node.isObject() ? node.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String str(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
