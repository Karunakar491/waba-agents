package com.metaagent.platform.domain.agent.controller;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.FileLibraryDtos;
import com.metaagent.platform.domain.agent.service.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Aggregate Files/Websites library (TASK-065) — every file/website across every agent on a WABA. */
@RestController
@RequiredArgsConstructor
public class FileLibraryController {

    private final AgentService agentService;

    @GetMapping("/api/v1/files")
    public ApiResponse<FileLibraryDtos.FileListResponse> listFiles(@RequestParam("wabaId") String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        return ApiResponse.ok(new FileLibraryDtos.FileListResponse(agentService.getAllFilesForWaba(wabaId, accountId)));
    }

    @GetMapping("/api/v1/websites")
    public ApiResponse<FileLibraryDtos.WebsiteListResponse> listWebsites(@RequestParam("wabaId") String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        return ApiResponse.ok(new FileLibraryDtos.WebsiteListResponse(agentService.getAllWebsitesForWaba(wabaId, accountId)));
    }

    private static Long parseId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (Exception e) {
            throw new BusinessException("Invalid id: " + raw);
        }
    }
}
