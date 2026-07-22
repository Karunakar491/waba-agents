package com.metaagent.platform.domain.analytics.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.analytics.entity.AgentPerformanceHourly;
import com.metaagent.platform.domain.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/agents/{agentId}/summary")
    public ApiResponse<Map<String, Object>> getAgentSummary(
            @PathVariable Long agentId,
            @RequestParam(value = "start", required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(value = "end", required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end
    ) {
        if (start == null) start = LocalDateTime.now().minusDays(7);
        if (end == null) end = LocalDateTime.now();

        Map<String, Object> metrics = analyticsService.getAgentSummaryMetrics(agentId, start, end);
        return ApiResponse.ok(metrics);
    }

    @GetMapping("/agents/{agentId}/hourly")
    public ApiResponse<List<AgentPerformanceHourly>> getHourlyPerformance(
            @PathVariable Long agentId,
            @RequestParam(value = "start", required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(value = "end", required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end
    ) {
        if (start == null) start = LocalDateTime.now().minusDays(7);
        if (end == null) end = LocalDateTime.now();

        List<AgentPerformanceHourly> performanceList = analyticsService.getHourlyAnalytics(agentId, start, end);
        return ApiResponse.ok(performanceList);
    }
}
