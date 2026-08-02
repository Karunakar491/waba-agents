package com.metaagent.platform.domain.dashboard.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.dashboard.dto.DashboardDtos;
import com.metaagent.platform.domain.dashboard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ApiResponse<DashboardDtos.SummaryResponse> getSummary() {
        return ApiResponse.ok(dashboardService.getSummary());
    }
}
