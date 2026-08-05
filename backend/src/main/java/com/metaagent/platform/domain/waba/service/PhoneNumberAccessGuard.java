package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Single tenant-boundary check for anything keyed by phoneNumberId (Skill,
 * BusinessProfile, ...). Access to a phone number's Agent is granted via
 * waba_account_access — any account with a grant on the Agent's WABA has
 * access, not just the Agent's original creator (2026-07-28 decoupling
 * decision — deliberately reverses the prior single-owner check).
 *
 * A draft Agent never bound to a WABA (wabaId null) has no shared-access
 * concept yet — it falls back to the original creator (Agent.accountId)
 * only, since there's nothing to share until it's connected to a number.
 *
 * Deliberately entity-agnostic: callers pass only (accountId, phoneNumberId).
 * Do not add entity-specific branches here — entity-specific rules belong in
 * the calling controller/service, not this guard.
 */
@Component
@RequiredArgsConstructor
public class PhoneNumberAccessGuard {

    private final AgentRepository agentRepository;
    private final WabaAccessGuard wabaAccessGuard;

    public void requireAccess(Long accountId, String phoneNumberId) {
        if (!hasAccess(accountId, phoneNumberId)) {
            throw new BusinessException("You don't have access to this phone number.");
        }
    }

    public boolean hasAccess(Long accountId, String phoneNumberId) {
        Agent agent = agentRepository.findByPhoneNumberId(phoneNumberId).orElse(null);
        return agent != null && (
                agent.getWabaId() != null
                        ? wabaAccessGuard.hasAccess(agent.getWabaId(), accountId)
                        : accountId.equals(agent.getAccountId())
        );
    }
}
