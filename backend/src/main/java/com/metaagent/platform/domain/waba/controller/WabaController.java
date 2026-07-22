package com.metaagent.platform.domain.waba.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.entity.Waba;
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

    @PostMapping("/validate")
    public ApiResponse<WabaDtos.ValidateResponse> validate(@Valid @RequestBody WabaDtos.ValidateRequest request) {
        return ApiResponse.ok(wabaService.validate(request.wabaId()));
    }

    @PostMapping
    public ApiResponse<WabaDtos.WabaResponse> create(@Valid @RequestBody WabaDtos.CreateRequest request) {
        Waba waba = wabaService.create(request.wabaId(), request.label());
        return ApiResponse.ok(toResponse(waba));
    }

    @GetMapping
    public ApiResponse<List<WabaDtos.WabaResponse>> list() {
        return ApiResponse.ok(wabaService.list().stream().map(WabaController::toResponse).toList());
    }

    private static WabaDtos.WabaResponse toResponse(Waba waba) {
        return new WabaDtos.WabaResponse(String.valueOf(waba.getId()), waba.getWabaId(), waba.getLabel(), waba.getStatus().name());
    }
}
