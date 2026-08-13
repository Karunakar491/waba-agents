package com.metaagent.platform.domain.agent.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class ConnectorDtos {

    private ConnectorDtos() {}

    /**
     * One row in the aggregate Connectors table.
     *
     * Meta stays authoritative: reads still fan out live per agent. The local
     * mirror (agent_connector, V45) supplies the fields Meta has no concept of
     * (systemType, tags, publishedToLibrary) and serves as the fallback when
     * Meta is unreachable — `cached` says which of the two you're looking at.
     *
     * usedByAgentCount is a heuristic: Meta's connector ids are scoped to a
     * phone number and carry no cross-agent identity, so the count groups rows
     * by name + base_url. See ConnectorMirrorService.usedByAgentCounts.
     */
    public record ConnectorRow(
            String id,
            String name,
            String agentId,
            String agentName,
            String phoneNumberId,
            String status,
            String authType,
            String baseUrl,
            String systemType,
            List<String> tags,
            boolean publishedToLibrary,
            int usedByAgentCount,
            boolean cached,
            LocalDateTime lastSyncedAt,
            /**
             * Set when this live Meta connector is a deployment of a library
             * connector (connector_deployment, V46). When set,
             * usedByAgentCount is the real COUNT(*) of deployments rather than
             * the name+base_url heuristic above.
             */
            String libraryConnectorId
    ) {}

    /**
     * @param cached true when at least one agent's connectors could not be
     *               fetched from Meta and were served from the local mirror.
     */
    public record ConnectorListResponse(List<ConnectorRow> connectors, boolean cached) {}
}
