package com.metaagent.platform.domain.businessevent.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos.CreateOrUpdateRequest;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos.DeleteImpact;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos.EventListItem;
import com.metaagent.platform.domain.businessevent.service.BusinessEventLibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The library screen: create a business event once, see it from the nav or
 * from any agent it's attached to. Separate from {@link BusinessEventController},
 * which is the fire history for one agent — a different screen, a different
 * lifecycle.
 */
@RestController
@RequiredArgsConstructor
public class BusinessEventLibraryController {

    private final BusinessEventLibraryService libraryService;

    @GetMapping("/api/v1/business-events")
    public ApiResponse<List<EventListItem>> listForAccount() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(libraryService.listForAccount(accountId));
    }

    @PostMapping("/api/v1/business-events")
    public ApiResponse<EventListItem> create(@RequestBody CreateOrUpdateRequest req) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long userId = SecurityContextHelper.getRequiredUserId();
        return ApiResponse.ok(libraryService.create(accountId, userId, req));
    }

    @PutMapping("/api/v1/business-events/{eventId}")
    public ApiResponse<EventListItem> update(@PathVariable Long eventId, @RequestBody CreateOrUpdateRequest req) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(libraryService.update(accountId, eventId, req));
    }

    @GetMapping("/api/v1/business-events/{eventId}/delete-impact")
    public ApiResponse<DeleteImpact> previewDelete(@PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(libraryService.previewDelete(accountId, eventId));
    }

    @DeleteMapping("/api/v1/business-events/{eventId}")
    public ApiResponse<Void> delete(@PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        libraryService.delete(accountId, eventId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/api/v1/agents/{agentId}/business-events")
    public ApiResponse<List<EventListItem>> listForAgent(@PathVariable Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(libraryService.listForAgent(agentId, accountId));
    }

    @PostMapping("/api/v1/agents/{agentId}/business-events/{eventId}/attach")
    public ApiResponse<Void> attach(@PathVariable Long agentId, @PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        libraryService.attach(accountId, agentId, eventId);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/api/v1/agents/{agentId}/business-events/{eventId}/attach")
    public ApiResponse<Void> detach(@PathVariable Long agentId, @PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        libraryService.detach(accountId, agentId, eventId);
        return ApiResponse.ok(null);
    }
}
