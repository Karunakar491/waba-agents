package com.metaagent.platform.domain.agent.dto;

import java.util.List;

public final class ConnectorDtos {

    private ConnectorDtos() {}

    /** One row in the aggregate Connectors table — live-fetched from Meta per agent (TASK-064, PM+EM 2026-07-30: no local mirror, Option A). */
    public record ConnectorRow(
            String id,
            String name,
            String agentId,
            String agentName,
            String phoneNumberId
    ) {}

    public record ConnectorListResponse(List<ConnectorRow> connectors) {}
}
