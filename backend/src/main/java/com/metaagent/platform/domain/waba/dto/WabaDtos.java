package com.metaagent.platform.domain.waba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class WabaDtos {

    private WabaDtos() {}

    public record ValidateRequest(
            @NotBlank(message = "WABA ID is required")
            @Pattern(regexp = "\\d{1,32}", message = "WABA ID must be numeric")
            String wabaId
    ) {}

    public record CreateRequest(
            @NotBlank(message = "WABA ID is required")
            @Pattern(regexp = "\\d{1,32}", message = "WABA ID must be numeric")
            String wabaId,
            @Size(max = 100, message = "Label must be at most 100 characters")
            String label
    ) {}

    public record PhoneNumber(
            String phoneNumberId,
            String displayPhoneNumber,
            String verifiedName,
            boolean alreadyConnected,
            String connectedAgentName
    ) {}

    public record ValidateResponse(
            String wabaId,
            String wabaName,
            List<PhoneNumber> phoneNumbers
    ) {}

    public record WabaResponse(
            String id, // TSID as string — 64-bit values exceed JS Number.MAX_SAFE_INTEGER
            String wabaId,
            String label,
            String status
    ) {}
}
