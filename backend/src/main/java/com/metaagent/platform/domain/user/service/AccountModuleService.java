package com.metaagent.platform.domain.user.service;

import com.metaagent.platform.domain.user.entity.AccountModule;
import com.metaagent.platform.domain.user.repository.AccountModuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;

/**
 * Fail-closed module entitlement checks. A missing (account, module) row
 * means disabled — never assume access for a module that was never granted.
 */
@Service
@RequiredArgsConstructor
public class AccountModuleService {

    private final AccountModuleRepository accountModuleRepository;

    public boolean isEnabled(Long accountId, AccountModule.Module module) {
        return accountModuleRepository.findByAccountIdAndModule(accountId, module)
                .map(AccountModule::isEnabled)
                .orElse(false);
    }

    /** Every known module, defaulting to disabled when no row exists — single source of truth for FE nav/route gating. */
    public Map<AccountModule.Module, Boolean> getEntitlements(Long accountId) {
        Map<AccountModule.Module, Boolean> entitlements = new EnumMap<>(AccountModule.Module.class);
        for (AccountModule.Module module : AccountModule.Module.values()) {
            entitlements.put(module, false);
        }
        accountModuleRepository.findAllByAccountId(accountId)
                .forEach(row -> entitlements.put(row.getModule(), row.isEnabled()));
        return entitlements;
    }
}
