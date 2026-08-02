package com.metaagent.platform.domain.persona.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.persona.dto.BusinessProfileDtos.BusinessProfileResponse;
import com.metaagent.platform.domain.persona.dto.BusinessProfileDtos.DeployRequest;
import com.metaagent.platform.domain.persona.dto.BusinessProfileDtos.SaveRequest;
import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import com.metaagent.platform.domain.persona.service.BusinessProfileDeployService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/business-profiles")
@RequiredArgsConstructor
public class BusinessProfileController {

    private final BusinessProfileDeployService service;

    @GetMapping("/drafts")
    public ApiResponse<List<BusinessProfileResponse>> listDrafts() {
        return ApiResponse.ok(service.listDrafts().stream().map(BusinessProfileController::toResponse).toList());
    }

    @PostMapping("/draft")
    public ApiResponse<BusinessProfileResponse> createDraft(@Valid @RequestBody SaveRequest request) {
        return ApiResponse.ok(toResponse(service.createDraft(request)));
    }

    @PutMapping("/draft/{id}")
    public ApiResponse<BusinessProfileResponse> updateDraft(@PathVariable Long id, @Valid @RequestBody SaveRequest request) {
        return ApiResponse.ok(toResponse(service.updateDraft(id, request)));
    }

    @DeleteMapping("/draft/{id}")
    public ApiResponse<Void> deleteDraft(@PathVariable Long id) {
        service.deleteDraft(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/draft/{id}/deploy")
    public ApiResponse<BusinessProfileResponse> deploy(@PathVariable Long id, @Valid @RequestBody DeployRequest request) {
        return ApiResponse.ok(toResponse(service.deploy(id, request.phoneNumberId())));
    }

    @GetMapping("/live")
    public ApiResponse<BusinessProfileResponse> getLive(@RequestParam String phoneNumberId) {
        BusinessProfile live = service.getLive(phoneNumberId);
        return ApiResponse.ok(live != null ? toResponse(live) : null);
    }

    @GetMapping("/history")
    public ApiResponse<List<BusinessProfileResponse>> getHistory(@RequestParam String phoneNumberId) {
        return ApiResponse.ok(service.getHistory(phoneNumberId).stream().map(BusinessProfileController::toResponse).toList());
    }

    /** Resets Meta's live business_info to defaults and archives our DEPLOYED row — distinct from deleting a history/live ROW (still deferred, see comment below). */
    @DeleteMapping("/live")
    public ApiResponse<Void> resetLive(@RequestParam String phoneNumberId) {
        service.resetLive(phoneNumberId);
        return ApiResponse.ok(null);
    }

    // Deletion of shared history rows is intentionally not exposed yet —
    // pending the founder's decision on live/history delete authorization
    // (same open item flagged for the sibling Skill entity).

    private static BusinessProfileResponse toResponse(BusinessProfile p) {
        return new BusinessProfileResponse(
                String.valueOf(p.getId()),
                p.getStatus().name(),
                p.getPhoneNumberId(),
                p.getPaymentMethod(),
                p.getReturnPolicy(),
                p.getPurchaseInfo(),
                p.getDeliveryAndShipping(),
                p.getBusinessDescription(),
                p.getContactEmail(),
                p.getContactHoursOfOperation(),
                p.getContactAddress(),
                p.getDeployedAt() != null ? p.getDeployedAt().toString() : null,
                p.getArchivedAt() != null ? p.getArchivedAt().toString() : null,
                p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : null
        );
    }
}
