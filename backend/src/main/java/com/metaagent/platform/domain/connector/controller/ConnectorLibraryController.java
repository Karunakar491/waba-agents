package com.metaagent.platform.domain.connector.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.connector.dto.ConnectorLibraryDtos;
import com.metaagent.platform.domain.connector.service.ConnectorLibraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Connector Library (V46) — reusable definitions.
 *
 * Separate from {@code /api/v1/connectors}, which stays what it is: the live
 * rollup of what Meta currently reports on every agent on a WABA.
 */
@RestController
@RequiredArgsConstructor
public class ConnectorLibraryController {

    private final ConnectorLibraryService connectorLibraryService;

    @PostMapping("/api/v1/connector-library")
    public ApiResponse<ConnectorLibraryDtos.ConnectorResponse> create(
            @Valid @RequestBody ConnectorLibraryDtos.CreateRequest request) {
        return ApiResponse.ok(connectorLibraryService.create(request));
    }

    @GetMapping("/api/v1/connector-library")
    public ApiResponse<List<ConnectorLibraryDtos.ConnectorResponse>> list(@RequestParam("wabaId") String wabaId) {
        return ApiResponse.ok(connectorLibraryService.list(wabaId));
    }

    @PutMapping("/api/v1/connector-library/{connectorId}")
    public ApiResponse<ConnectorLibraryDtos.ConnectorResponse> update(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorLibraryDtos.UpdateRequest request) {
        return ApiResponse.ok(connectorLibraryService.update(connectorId, request));
    }

    @PostMapping("/api/v1/connector-library/{connectorId}/publish")
    public ApiResponse<ConnectorLibraryDtos.ConnectorResponse> publish(@PathVariable Long connectorId) {
        return ApiResponse.ok(connectorLibraryService.publish(connectorId));
    }

    /** The only endpoint here that reaches Meta. Secrets are request-only, never stored. */
    @PostMapping("/api/v1/connector-library/{connectorId}/deploy")
    public ApiResponse<ConnectorLibraryDtos.DeploymentView> deploy(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorLibraryDtos.DeployRequest request) {
        return ApiResponse.ok(connectorLibraryService.deploy(connectorId, request));
    }

    @DeleteMapping("/api/v1/connector-library/{connectorId}")
    public ApiResponse<Void> delete(@PathVariable Long connectorId) {
        connectorLibraryService.delete(connectorId);
        return ApiResponse.ok();
    }

    // --- Actions: what a connector can do --------------------------------
    // None of these reach Meta. Deploying does.

    @GetMapping("/api/v1/connector-library/{connectorId}/actions")
    public ApiResponse<List<ConnectorLibraryDtos.ActionResponse>> listActions(@PathVariable Long connectorId) {
        return ApiResponse.ok(connectorLibraryService.listActions(connectorId));
    }

    @PostMapping("/api/v1/connector-library/{connectorId}/actions")
    public ApiResponse<ConnectorLibraryDtos.ActionResponse> createAction(
            @PathVariable Long connectorId, @Valid @RequestBody ConnectorLibraryDtos.ActionRequest request) {
        return ApiResponse.ok(connectorLibraryService.createAction(connectorId, request));
    }

    @PutMapping("/api/v1/connector-library/{connectorId}/actions/{actionId}")
    public ApiResponse<ConnectorLibraryDtos.ActionResponse> updateAction(
            @PathVariable Long connectorId, @PathVariable Long actionId,
            @Valid @RequestBody ConnectorLibraryDtos.ActionRequest request) {
        return ApiResponse.ok(connectorLibraryService.updateAction(connectorId, actionId, request));
    }

    @DeleteMapping("/api/v1/connector-library/{connectorId}/actions/{actionId}")
    public ApiResponse<Void> deleteAction(@PathVariable Long connectorId, @PathVariable Long actionId) {
        connectorLibraryService.deleteAction(connectorId, actionId);
        return ApiResponse.ok();
    }
}
