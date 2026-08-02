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
}
