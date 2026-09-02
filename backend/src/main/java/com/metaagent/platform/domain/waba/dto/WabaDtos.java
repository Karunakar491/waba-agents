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
            String connectedAgentName,
            // TASK-061 (P0): quality_rating directly predicts WhatsApp
            // restricting/banning a number — highest-stakes field this app
            // wasn't previously requesting from Meta at all.
            String qualityRating,
            String nameStatus,
            String messagingLimitTier,
            // Meta's Cloud API connection state (e.g. CONNECTED, PENDING) — a
            // PENDING number isn't actually live yet, and provisioning a BizAI
            // agent on one always fails server-side on Meta's end. Frontend
            // must treat anything other than "CONNECTED" as not-selectable.
            String status
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

    /** Summary of what's already configured on a phone number's Meta agent, before connecting/deploying onto it. */
    public record DeployPreflightResponse(
            boolean agentIdPresent,
            int skillCount,
            List<String> connectorNames
    ) {}

    /** One phone number, tagged with its WABA, for the Dashboard's account-wide inventory. */
    public record AccountPhoneNumber(
            String phoneNumberId,
            String displayPhoneNumber,
            String verifiedName,
            String wabaId,
            String wabaLabel,
            boolean hasAgent,
            String agentId,
            String agentName,
            String agentStatus,
            String qualityRating,
            String nameStatus,
            String messagingLimitTier
    ) {}

    /** Account-wide phone inventory — partial-failure aware: a WABA whose Meta call failed is
     * skipped (not thrown), and named here so the Dashboard can show "N of M WABAs loaded".
     * syncedAt (TASK-055): when this came from the login-sync cache, the real cache timestamp
     * (so the UI can show "Synced Xm ago"); when falling back to a live call (cache empty), now. */
    public record AccountPhonesResponse(
            List<AccountPhoneNumber> phoneNumbers,
            List<String> unavailableWabaLabels,
            String syncedAt
    ) {}
}
