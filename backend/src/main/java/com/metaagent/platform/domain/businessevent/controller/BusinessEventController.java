package com.metaagent.platform.domain.businessevent.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.CreateOrUpdateRequest;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.DeleteImpact;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.EventListItem;
import com.metaagent.platform.domain.businessevent.service.BusinessEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Business Events section: create one once, see it from the nav or from any
 * agent it's attached to. Separate from {@link BusinessEventFireController},
 * which is the fire history for one agent — a different screen, a different
 * lifecycle.
 */
@RestController
@RequiredArgsConstructor
public class BusinessEventController {

    private final BusinessEventService service;

    @GetMapping("/api/v1/business-events")
    public ApiResponse<List<EventListItem>> listForAccount() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(service.listForAccount(accountId));
    }

    @PostMapping("/api/v1/business-events")
    public ApiResponse<EventListItem> create(@RequestBody CreateOrUpdateRequest req) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long userId = SecurityContextHelper.getRequiredUserId();
        return ApiResponse.ok(service.create(accountId, userId, req));
    }

    @PutMapping("/api/v1/business-events/{eventId}")
    public ApiResponse<EventListItem> update(@PathVariable Long eventId, @RequestBody CreateOrUpdateRequest req) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(service.update(accountId, eventId, req));
    }

    @GetMapping("/api/v1/business-events/{eventId}/delete-impact")
    public ApiResponse<DeleteImpact> previewDelete(@PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(service.previewDelete(accountId, eventId));
    }

    @DeleteMapping("/api/v1/business-events/{eventId}")
    public ApiResponse<Void> delete(@PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        service.delete(accountId, eventId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/api/v1/agents/{agentId}/business-events")
    public ApiResponse<List<EventListItem>> listForAgent(@PathVariable Long agentId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(service.listForAgent(agentId, accountId));
    }

    @PostMapping("/api/v1/agents/{agentId}/business-events/{eventId}/attach")
    public ApiResponse<Void> attach(@PathVariable Long agentId, @PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        service.attach(accountId, agentId, eventId);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/api/v1/agents/{agentId}/business-events/{eventId}/attach")
    public ApiResponse<Void> detach(@PathVariable Long agentId, @PathVariable Long eventId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        service.detach(accountId, agentId, eventId);
        return ApiResponse.ok(null);
    }
}
