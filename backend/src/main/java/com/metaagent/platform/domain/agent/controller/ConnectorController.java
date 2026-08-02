package com.metaagent.platform.domain.agent.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.ConnectorDtos;
import com.metaagent.platform.domain.agent.service.AgentDeployService;
import com.metaagent.platform.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Aggregate connectors view (TASK-064) — every connector live on any agent on a WABA. */
@RestController
@RequiredArgsConstructor
public class ConnectorController {

    private final AgentDeployService agentDeployService;

    @GetMapping("/api/v1/connectors")
    public ApiResponse<ConnectorDtos.ConnectorListResponse> list(@RequestParam("wabaId") String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        return ApiResponse.ok(new ConnectorDtos.ConnectorListResponse(
                agentDeployService.listConnectorsForWaba(wabaId, accountId)));
    }

    private static Long parseId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (Exception e) {
            throw new BusinessException("Invalid id: " + raw);
        }
    }
}
