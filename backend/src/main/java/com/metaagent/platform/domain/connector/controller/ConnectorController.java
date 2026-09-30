package com.metaagent.platform.domain.connector.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.connector.dto.ConnectorDtos;
import com.metaagent.platform.domain.connector.dto.ConnectorProbeDtos;
import com.metaagent.platform.domain.connector.service.ConnectorService;
import com.metaagent.platform.domain.connector.service.ConnectorProbeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Connector definitions (V46) — reusable, ours, not yet necessarily on Meta.
 *
 * Separate from {@code /api/v1/connectors/live}, which stays what it is: the
 * live rollup of what Meta currently reports on every agent on a WABA.
 */
@RestController
@RequiredArgsConstructor
public class ConnectorController {

    private final ConnectorService connectorService;
    private final ConnectorProbeService connectorProbeService;

    @PostMapping("/api/v1/connectors")
    public ApiResponse<ConnectorDtos.ConnectorResponse> create(
            @Valid @RequestBody ConnectorDtos.CreateRequest request) {
        return ApiResponse.ok(connectorService.create(request));
    }

    @GetMapping("/api/v1/connectors")
    public ApiResponse<List<ConnectorDtos.ConnectorResponse>> list(@RequestParam("wabaId") String wabaId) {
        return ApiResponse.ok(connectorService.list(wabaId));
    }

    @PutMapping("/api/v1/connectors/{connectorId}")
    public ApiResponse<ConnectorDtos.ConnectorResponse> update(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorDtos.UpdateRequest request) {
        return ApiResponse.ok(connectorService.update(connectorId, request));
    }

    @PostMapping("/api/v1/connectors/{connectorId}/publish")
    public ApiResponse<ConnectorDtos.ConnectorResponse> publish(@PathVariable Long connectorId) {
        return ApiResponse.ok(connectorService.publish(connectorId));
    }

    /** Reaches Meta. Secrets supplied here are encrypted and stored against the deployment (V64). */
    @PostMapping("/api/v1/connectors/{connectorId}/deploy")
    public ApiResponse<ConnectorDtos.DeploymentView> deploy(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorDtos.DeployRequest request) {
        return ApiResponse.ok(connectorService.deploy(connectorId, request));
    }

    /**
     * Redeploys to every agent id given, reusing each one's stored credentials.
     * Meant for agents already running this connector — "tick the ones you
     * want, publish to all of them." Never all-or-nothing: check each result.
     */
    @PostMapping("/api/v1/connectors/{connectorId}/publish-to-agents")
    public ApiResponse<List<ConnectorDtos.PublishResult>> publishToAgents(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorDtos.PublishToAgentsRequest request) {
        return ApiResponse.ok(connectorService.publishToAgents(connectorId, request.agentIds()));
    }

    /**
     * Makes one real HTTP call to the connector's API and returns what came
     * back, so an operator can see an action work before a customer's message
     * is the thing that finds out.
     *
     * <p>Takes the request as typed rather than an action id, because the point
     * is testing an edit that has not been saved. The base URL is read from the
     * stored connector and never from this payload; see
     * {@link com.metaagent.platform.domain.connector.service.ConnectorProbeService}
     * for the SSRF screening this goes through and the one gap that remains.
     */
    @PostMapping("/api/v1/connectors/{connectorId}/probe")
    public ApiResponse<ConnectorProbeDtos.ProbeResponse> probe(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorProbeDtos.ProbeRequest request) {
        return ApiResponse.ok(connectorProbeService.probe(connectorId, request));
    }

    @DeleteMapping("/api/v1/connectors/{connectorId}")
    public ApiResponse<Void> delete(@PathVariable Long connectorId) {
        connectorService.delete(connectorId);
        return ApiResponse.ok();
    }

    // --- Actions: what a connector can do --------------------------------
    // None of these reach Meta. Deploying does.

    @GetMapping("/api/v1/connectors/{connectorId}/actions")
    public ApiResponse<List<ConnectorDtos.ActionResponse>> listActions(@PathVariable Long connectorId) {
        return ApiResponse.ok(connectorService.listActions(connectorId));
    }

    @PostMapping("/api/v1/connectors/{connectorId}/actions")
    public ApiResponse<ConnectorDtos.ActionResponse> createAction(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorDtos.ActionRequest request) {
        return ApiResponse.ok(connectorService.createAction(connectorId, request));
    }

    @PutMapping("/api/v1/connectors/{connectorId}/actions/{actionId}")
    public ApiResponse<ConnectorDtos.ActionResponse> updateAction(
            @PathVariable Long connectorId, @PathVariable Long actionId,
            @Valid @RequestBody ConnectorDtos.ActionRequest request) {
        return ApiResponse.ok(connectorService.updateAction(connectorId, actionId, request));
    }

    @DeleteMapping("/api/v1/connectors/{connectorId}/actions/{actionId}")
    public ApiResponse<Void> deleteAction(@PathVariable Long connectorId, @PathVariable Long actionId) {
        connectorService.deleteAction(connectorId, actionId);
        return ApiResponse.ok();
    }
}
