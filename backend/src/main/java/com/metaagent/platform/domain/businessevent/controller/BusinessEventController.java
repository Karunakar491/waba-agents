package com.metaagent.platform.domain.businessevent.controller;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FireCounts;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FireDetail;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FirePage;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.service.BusinessEventQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * The announcement history for one agent: what we were asked to tell
 * customers, and what actually happened.
 *
 * <p>Nested under {@code /api/v1/agents} because that is where it lives on
 * screen, but in its own class — AgentController is already very large.
 * {@code ModuleAccessFilter} gates everything unmatched under
 * {@code /api/v1/**} on BUSINESS_AGENTS, which is exactly the module the rest
 * of the agent endpoints need, so these paths need no case of their own there.
 */
@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class BusinessEventController {

    private final BusinessEventQueryService queryService;

    @GetMapping("/{agentId}/business-events/fires")
    public ApiResponse<FirePage> listFires(
            @PathVariable Long agentId,
            @RequestParam(value = "outcome", required = false) String outcome,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(queryService.listFires(agentId, accountId, parseOutcome(outcome), page, size));
    }

    @GetMapping("/{agentId}/business-events/fires/counts")
    public ApiResponse<FireCounts> countFires(
            @PathVariable Long agentId,
            @RequestParam(value = "days", defaultValue = "7") int days
    ) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(queryService.countFires(agentId, accountId, days));
    }

    @GetMapping("/{agentId}/business-events/fires/{fireId}")
    public ApiResponse<FireDetail> getFire(@PathVariable Long agentId, @PathVariable Long fireId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(queryService.getFire(agentId, accountId, fireId));
    }

    /** Blank means "no filter"; an unknown value is a mistake, not everything. */
    private static BusinessEventFire.Outcome parseOutcome(String outcome) {
        if (outcome == null || outcome.isBlank()) {
            return null;
        }
        try {
            return BusinessEventFire.Outcome.valueOf(outcome.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Unknown outcome filter: " + outcome);
        }
    }
}
