package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentConnector;
import com.metaagent.platform.domain.agent.repository.AgentConnectorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Keeps the local connector mirror (agent_connector, V45) in step with Meta.
 *
 * Pattern: upsert-on-read. Every live list/get of connectors from Meta writes
 * what it saw back into the mirror in the same transaction, so the mirror is
 * maintained by real traffic and can never drift from a manual edit — there is
 * no manual edit path for the Meta-owned columns at all.
 *
 * What is NEVER written here: auth_config, api keys, oauth client secrets,
 * certificates or private keys. Those stay on Meta. Storing them locally would
 * turn a read-cache into a second credential store to breach, secure and
 * rotate, for zero UI benefit — the UI only ever needs to render auth_type.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConnectorMirrorService {

    private final AgentConnectorRepository repository;

    /**
     * Upserts every connector Meta just returned for this agent.
     * Meta-owned columns are overwritten; our own columns are left untouched
     * (system_type is seeded from a base_url guess on first insert only, so an
     * operator's later correction is never stomped by a sync).
     */
    @Transactional
    public List<AgentConnector> syncFromMeta(Agent agent, List<?> metaConnectors) {
        if (metaConnectors == null) return List.of();
        List<AgentConnector> saved = new ArrayList<>();
        for (Object entry : metaConnectors) {
            if (entry instanceof Map<?, ?> m) {
                AgentConnector row = upsertOne(agent, m);
                if (row != null) saved.add(row);
            }
        }
        return saved;
    }

    private AgentConnector upsertOne(Agent agent, Map<?, ?> meta) {
        String metaId = str(meta.get("id"));
        if (metaId == null) return null;

        String name = str(meta.get("name"));
        if (name == null) name = "Unnamed connector";
        String baseUrl = str(meta.get("base_url"));

        AgentConnector row = repository.findByAgentIdAndMetaConnectorId(agent.getId(), metaId)
                .orElseGet(() -> AgentConnector.builder()
                        .accountId(agent.getAccountId())
                        .agentId(agent.getId())
                        .metaConnectorId(metaId)
                        .systemType(guessSystemType(str(meta.get("name")), str(meta.get("base_url"))))
                        .publishedToLibrary(false)
                        .requiresCertificate(false)
                        .build());

        row.setPhoneNumberId(agent.getPhoneNumberId());
        row.setName(name);
        row.setDescription(truncate(str(meta.get("description")), 1024));
        row.setBaseUrl(truncate(baseUrl, 1024));
        row.setAuthType(str(meta.get("auth_type")));
        row.setStatus(connectionStatus(meta));
        row.setRequiresCertificate(Boolean.TRUE.equals(meta.get("requires_certificate")));
        row.setIdentityKey(identityKey(name, baseUrl));
        row.setLastSyncedAt(LocalDateTime.now());
        return repository.save(row);
    }

    /** Last-known state for one agent, used when Meta is unreachable. */
    @Transactional(readOnly = true)
    public List<AgentConnector> cachedFor(Long agentId) {
        return repository.findAllByAgentId(agentId);
    }

    @Transactional(readOnly = true)
    public List<AgentConnector> cachedForAgents(List<Long> agentIds) {
        return agentIds.isEmpty() ? List.of() : repository.findAllByAgentIdIn(agentIds);
    }

    /**
     * How many distinct agents share a connector, by heuristic identity.
     *
     * Meta gives connectors no cross-agent identity — a connector lives under
     * one phone number id and its id means nothing on another agent
     * (docs/meta-api/connectors.md). So this counts rows sharing our own
     * identity_key (lower name + lower base_url) across the supplied agents.
     * It is a good-faith match, not a guarantee from Meta.
     */
    public Map<String, Integer> usedByAgentCounts(List<AgentConnector> rows) {
        Map<String, java.util.Set<Long>> agentsPerKey = new LinkedHashMap<>();
        for (AgentConnector row : rows) {
            if (row.getIdentityKey() == null) continue;
            agentsPerKey.computeIfAbsent(row.getIdentityKey(), k -> new java.util.HashSet<>()).add(row.getAgentId());
        }
        Map<String, Integer> counts = new LinkedHashMap<>();
        agentsPerKey.forEach((key, agents) -> counts.put(key, agents.size()));
        return counts;
    }

    /** Renders a mirror row back into Meta's own response shape, flagged as cached. */
    public Map<String, Object> toMetaShape(AgentConnector row) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", row.getMetaConnectorId());
        out.put("name", row.getName());
        out.put("description", row.getDescription());
        out.put("base_url", row.getBaseUrl());
        out.put("auth_type", row.getAuthType());
        out.put("requires_certificate", row.isRequiresCertificate());
        out.put("connection_status", Map.of("status", row.getStatus() == null ? "UNKNOWN" : row.getStatus()));
        out.put("cached", true);
        out.put("last_synced_at", row.getLastSyncedAt());
        return out;
    }

    static String identityKey(String name, String baseUrl) {
        String n = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        String b = baseUrl == null ? "" : baseUrl.trim().toLowerCase(Locale.ROOT);
        return truncate(n + "|" + b, 512);
    }

    /**
     * First-insert-only guess at a system label from the vendor's own host.
     * Meta has no such field; an operator can correct it later and sync will
     * not overwrite the correction.
     */
    static String guessSystemType(String name, String baseUrl) {
        String haystack = ((baseUrl == null ? "" : baseUrl) + " " + (name == null ? "" : name)).toLowerCase(Locale.ROOT);
        for (String vendor : List.of("shopify", "zendesk", "salesforce", "hubspot", "stripe", "freshdesk", "zoho", "magento", "woocommerce", "intercom")) {
            if (haystack.contains(vendor)) {
                return Character.toUpperCase(vendor.charAt(0)) + vendor.substring(1);
            }
        }
        return "Custom";
    }

    private static String connectionStatus(Map<?, ?> meta) {
        if (meta.get("connection_status") instanceof Map<?, ?> cs) {
            return str(cs.get("status"));
        }
        return null;
    }

    private static String str(Object value) {
        return value == null ? null : value.toString();
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
