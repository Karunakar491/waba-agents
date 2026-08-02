package com.metaagent.platform.domain.dashboard.dto;

import com.metaagent.platform.domain.waba.dto.WabaDtos;

import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {}

    public record SummaryResponse(
            long totalConversations,
            long activeConversations,
            List<WabaDtos.AccountPhoneNumber> phoneNumbers,
            List<String> unavailableWabaLabels,
            String phoneNumbersSyncedAt
    ) {}
}
