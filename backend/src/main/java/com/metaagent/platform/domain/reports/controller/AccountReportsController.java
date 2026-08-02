package com.metaagent.platform.domain.reports.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.reports.service.EvalRollupService;
import com.metaagent.platform.domain.reports.service.ReportsService;
import com.metaagent.platform.infrastructure.meta.audit.ApiCallLog;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Account-wide Reports section — Conversations, API Calls, Eval rollup. */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class AccountReportsController {

    private final ReportsService reportsService;
    private final EvalRollupService evalRollupService;

    @GetMapping("/conversations")
    public ApiResponse<ReportsService.ConversationsReport> getConversationsReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ApiResponse.ok(reportsService.getConversationsReport(from, to));
    }

    @GetMapping("/api-calls")
    public ApiResponse<List<ApiCallLog>> getApiCallLog(@RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.ok(reportsService.getApiCallLog(limit));
    }

    @PostMapping("/eval-rollup")
    public ApiResponse<Map<String, String>> startEvalRollup() {
        return ApiResponse.ok(Map.of("jobId", evalRollupService.start()));
    }

    @GetMapping("/eval-rollup/{jobId}")
    public ApiResponse<Map<String, Object>> pollEvalRollup(@PathVariable String jobId) {
        return ApiResponse.ok(evalRollupService.poll(jobId));
    }
}
