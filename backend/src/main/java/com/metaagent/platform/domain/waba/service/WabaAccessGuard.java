package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Single place that answers "can this account touch this WABA" — every
 * caller across domains (agent, skill, templatestudio, iris, reconciliation)
 * goes through here instead of calling
 * WabaAccountAccessRepository.existsByWabaIdAndAccountId directly, mirroring
 * AgentAccessService's role for agent-level access. Found duplicated across
 * 8+ call sites in the 2026-08-05 EM architecture-vision audit — a missed
 * copy is a cross-tenant data leak, not a cosmetic bug.
 */
@Service
@RequiredArgsConstructor
public class WabaAccessGuard {

    private final WabaAccountAccessRepository wabaAccountAccessRepository;

    public void requireAccess(Long wabaId, Long accountId) {
        if (!hasAccess(wabaId, accountId)) {
            throw new NotFoundException("WABA not found");
        }
    }

    public boolean hasAccess(Long wabaId, Long accountId) {
        return wabaAccountAccessRepository.existsByWabaIdAndAccountId(wabaId, accountId);
    }
}
