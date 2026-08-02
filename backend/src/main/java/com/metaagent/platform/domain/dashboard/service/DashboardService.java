package com.metaagent.platform.domain.dashboard.service;

import com.metaagent.platform.domain.conversation.service.ConversationService;
import com.metaagent.platform.domain.dashboard.dto.DashboardDtos;
import com.metaagent.platform.domain.waba.service.WabaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Aggregates conversation + phone-inventory data for the Dashboard summary.
 * Spans the conversation and waba domains — neither owns "dashboard" as a
 * concept, so this stays a thin collaborator rather than living inside either
 * (EM gate 2026-07-29).
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ConversationService conversationService;
    private final WabaService wabaService;

    public DashboardDtos.SummaryResponse getSummary() {
        var totals = conversationService.getConversationTotals();
        // Cache-first (TASK-055) — reads the login-sync snapshot; only makes
        // live Meta calls if that cache is empty (e.g. before first sync completes).
        var phones = wabaService.getCachedOrLivePhonesForAccount();
        return new DashboardDtos.SummaryResponse(
                totals.total(),
                totals.active(),
                phones.phoneNumbers(),
                phones.unavailableWabaLabels(),
                phones.syncedAt()
        );
    }
}
