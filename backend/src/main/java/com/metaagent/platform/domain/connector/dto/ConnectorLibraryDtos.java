package com.metaagent.platform.domain.connector.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/**
 * Connector Library (V46) — the reusable definition layer.
 *
 * The single most important rule in this file: no request or response record
 * here carries a credential VALUE except {@link DeployRequest#secrets()},
 * which is write-only, forwarded straight to Meta, and never persisted.
 */
public final class ConnectorLibraryDtos {

    private ConnectorLibraryDtos() {}

    /**
     * The auth shape of a library connector — names, not values.
     *
     * API_KEY: {@code headers} names the header(s) that will carry the key.
     * OAUTH2_CLIENT_CREDENTIALS: {@code tokenUrl}, {@code scopes},
     * {@code clientId} are configuration, not secrets; the client_secret is
     * never here — it's supplied per deployment.
     */
    public record AuthShape(
            List<HeaderField> headers,
            @Size(max = 1024) String tokenUrl,
            List<String> scopes,
            @Size(max = 255) String clientId
    ) {}

    public record HeaderField(
            @NotBlank(message = "Header name is required")
            @Size(max = 128) String fieldName,
            @Size(max = 64) String prefix
    ) {}

    public record CreateRequest(
            @NotNull(message = "wabaId is required") String wabaId,
            @NotBlank(message = "Name is required") @Size(max = 255) String name,
            @NotBlank(message = "Description is required") @Size(max = 1024) String description,
            @Size(max = 64) String systemType,
            @NotBlank(message = "Base URL is required") @Size(max = 1024) String baseUrl,
            @NotBlank(message = "Auth type is required") @Size(max = 64) String authType,
            AuthShape authShape,
            boolean requiresCertificate,
            @Size(max = 512) String tags
    ) {}

    public record UpdateRequest(
            @NotBlank(message = "Name is required") @Size(max = 255) String name,
            @NotBlank(message = "Description is required") @Size(max = 1024) String description,
            @Size(max = 64) String systemType,
            @NotBlank(message = "Base URL is required") @Size(max = 1024) String baseUrl,
            @NotBlank(message = "Auth type is required") @Size(max = 64) String authType,
            AuthShape authShape,
            boolean requiresCertificate,
            @Size(max = 512) String tags
    ) {}

    /**
     * Deploy one library connector onto one agent.
     *
     * @param secrets write-only credential values keyed by the field name
     *                declared in the connector's AuthShape — plus the reserved
     *                keys {@code client_secret} (OAuth) and
     *                {@code client_certificate} / {@code client_key} /
     *                {@code ca_certificate} (mTLS). Forwarded to Meta and
     *                dropped; never written to any column.
     */
    public record DeployRequest(
            @NotNull(message = "agentId is required") String agentId,
            Map<String, String> secrets
    ) {}

    /** One agent a library connector is live on — the real join, not a heuristic. */
    public record DeploymentView(
            String agentId,
            String agentName,
            String phoneNumberId,
            String metaConnectorId,
            String deployedAt,
            String status, // "LIVE" | "OUT_OF_SYNC" | "FAILED" | "PENDING"
            String lastError
    ) {}

    /** A library row. authShape is echoed back so the edit form can prefill; it holds no values. */
    public record ConnectorResponse(
            String id,
            String wabaId,
            String name,
            String description,
            String systemType,
            String baseUrl,
            String authType,
            AuthShape authShape,
            boolean requiresCertificate,
            List<String> tags,
            String status, // DRAFT | PUBLISHED
            String updatedAt,
            int usedByAgentCount,
            List<DeploymentView> deployments
    ) {}
}
