package com.metaagent.platform.domain.waba.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.service.PhoneNumberSyncService;
import com.metaagent.platform.domain.waba.service.WabaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/waba")
@RequiredArgsConstructor
public class WabaController {

    private final WabaService wabaService;
    private final PhoneNumberSyncService phoneNumberSyncService;

    @PostMapping("/validate")
    public ApiResponse<WabaDtos.ValidateResponse> validate(@Valid @RequestBody WabaDtos.ValidateRequest request) {
        return ApiResponse.ok(wabaService.validate(request.wabaId()));
    }

    @PostMapping
    public ApiResponse<WabaDtos.WabaResponse> create(@Valid @RequestBody WabaDtos.CreateRequest request) {
        Waba waba = wabaService.create(request.wabaId(), request.label());
        // Fire-and-forget (TASK-056) — never blocks this response, never
        // throws. KNOWN TECH DEBT: syncForAccount() re-syncs every WABA on
        // the account, not just the one just connected (no per-WABA variant
        // exists yet) — accepted given accounts today hold few WABAs.
        phoneNumberSyncService.syncForAccount(SecurityContextHelper.getRequiredAccountId());
        return ApiResponse.ok(toResponse(waba));
    }

    @GetMapping
    public ApiResponse<List<WabaDtos.WabaResponse>> list() {
        return ApiResponse.ok(wabaService.list().stream().map(WabaController::toResponse).toList());
    }

    @GetMapping("/{wabaId}/phones")
    public ApiResponse<List<WabaDtos.PhoneNumber>> getPhones(@PathVariable String wabaId) {
        return ApiResponse.ok(wabaService.getPhones(wabaId));
    }

    @GetMapping("/phones/{phoneNumberId}/deploy-preflight")
    public ApiResponse<WabaDtos.DeployPreflightResponse> deployPreflight(@PathVariable String phoneNumberId) {
        return ApiResponse.ok(wabaService.deployPreflight(phoneNumberId));
    }

    private static WabaDtos.WabaResponse toResponse(Waba waba) {
        return new WabaDtos.WabaResponse(String.valueOf(waba.getId()), waba.getWabaId(), waba.getLabel(), waba.getStatus().name());
    }
}
