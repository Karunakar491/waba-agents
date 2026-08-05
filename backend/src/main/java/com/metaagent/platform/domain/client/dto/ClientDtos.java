package com.metaagent.platform.domain.client.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class ClientDtos {

    private ClientDtos() {}

    public record CreateRequest(
            @NotBlank(message = "Client name is required")
            @Size(max = 150, message = "Client name must be at most 150 characters")
            String name,
            @NotNull(message = "WABA is required")
            String wabaId // internal waba.id, as string (TSID)
    ) {}

    public record UpdateRequest(
            @NotBlank(message = "Client name is required")
            @Size(max = 150, message = "Client name must be at most 150 characters")
            String name,
            @NotBlank(message = "Credit line status is required")
            String creditLineStatus // Client.CreditLineStatus name
    ) {}

    public record StaffAccessRequest(
            @NotNull(message = "User id is required")
            String userId // TSID as string
    ) {}

    public record ClientResponse(
            String id, // TSID as string — 64-bit values exceed JS Number.MAX_SAFE_INTEGER
            String name,
            String wabaId,
            String creditLineStatus,
            String createdBy,
            String updatedBy,
            String createdAt,
            String updatedAt
    ) {}

    public record StaffResponse(
            String userId,
            String email
    ) {}

    public record AuditEntryResponse(
            String changedBy,
            String changeSummary,
            String changedAt
    ) {}

    public record ClientDetailResponse(
            ClientResponse client,
            List<StaffResponse> staff
    ) {}

    /**
     * Fleet-risk row for the Client Command Bar (roadmap item 45). Signals are
     * computed live (no cache table — client counts are small; revisit if p95
     * exceeds 500ms at real scale). agentErrorRatePct is a DISCLOSED
     * approximation, not a distinct tracked metric — see webhookFailureRatePct's
     * javadoc on ClientService.computeFleetRisk() for why they share one
     * underlying signal (EM decision, 2026-08-06, no new error-tracking
     * pipeline built for v1).
     */
    public record FleetRiskRow(
            String clientId,
            String name,
            int riskScore, // 0-100, higher = more at-risk, weighted blend of the 4 signals below
            long staleConversationAgeMins, // age of the oldest still-open conversation's last message; 0 if none open
            double webhookFailureRatePct, // % of this client's webhook_events with status != 'success', last 24h
            long handoffBacklogCount, // open conversations with needsHuman=true
            double agentErrorRatePct, // approximation — same underlying data as webhookFailureRatePct, see above
            boolean approximate // true when agentErrorRatePct is a stand-in, not a distinct metric — always true in v1
    ) {}
}
