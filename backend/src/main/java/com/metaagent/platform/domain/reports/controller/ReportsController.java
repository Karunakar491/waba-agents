package com.metaagent.platform.domain.reports.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.reports.service.ReportsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/reports/agents/{agentId}/eval")
@RequiredArgsConstructor
public class ReportsController {

    private final ReportsService reportsService;

    @GetMapping("/cases")
    public ApiResponse<Map<String, Object>> listCases(@PathVariable Long agentId) {
        return ApiResponse.ok(reportsService.listEvalCases(agentId));
    }

    @PostMapping("/run")
    public ApiResponse<Map<String, Object>> runEval(
            @PathVariable Long agentId,
            @RequestParam String evalCaseIds,
            @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(reportsService.runEval(agentId, evalCaseIds, body != null ? body : Map.of()));
    }

    @GetMapping("/run")
    public ApiResponse<Map<String, Object>> pollRun(@PathVariable Long agentId, @RequestParam String jobId) {
        return ApiResponse.ok(reportsService.pollEvalRun(agentId, jobId));
    }

    @GetMapping("/details")
    public ApiResponse<Map<String, Object>> getDetails(@PathVariable Long agentId, @RequestParam String evalIds) {
        return ApiResponse.ok(reportsService.getEvalDetails(agentId, evalIds));
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> getSummary(@PathVariable Long agentId, @RequestParam String summaryIds) {
        return ApiResponse.ok(reportsService.getEvalSummary(agentId, summaryIds));
    }
}
