package com.metaagent.platform.domain.agent.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.ConnectorMirrorDtos;
import com.metaagent.platform.domain.connector.service.ConnectorService;
import com.metaagent.platform.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Aggregate connectors view (TASK-064) — every connector live on any agent on a WABA. */
@RestController
@RequiredArgsConstructor
public class ConnectorMirrorController {

    private final ConnectorService connectorService;

    /**
     * Still the live rollup. It now goes through ConnectorService so
     * rows that are deployments of a connector (V46) report a real
     * "used by N agents" count instead of V45's name+base_url heuristic.
     */
    @GetMapping("/api/v1/connectors/live")
    public ApiResponse<ConnectorMirrorDtos.ConnectorListResponse> list(@RequestParam("wabaId") String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        return ApiResponse.ok(connectorService.listLiveForWaba(wabaId, accountId));
    }

    private static Long parseId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (Exception e) {
            throw new BusinessException("Invalid id: " + raw);
        }
    }
}
