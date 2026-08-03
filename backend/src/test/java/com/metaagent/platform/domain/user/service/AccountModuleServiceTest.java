package com.metaagent.platform.domain.user.service;

import com.metaagent.platform.domain.user.entity.AccountModule;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.AccountModuleRepository;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class AccountModuleServiceTest extends IntegrationTestBase {

    @Autowired
    private AccountModuleService accountModuleService;

    @Autowired
    private AccountModuleRepository accountModuleRepository;

    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    @AfterEach
    void cleanup() {
        accountModuleRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void should_deny_when_no_account_module_row_exists() {
        BusinessAccount account = businessAccountRepository.save(account("no-row@test.com"));

        boolean enabled = accountModuleService.isEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS);

        assertThat(enabled).isFalse();
    }

    @Test
    void should_allow_when_row_exists_and_enabled() {
        BusinessAccount account = businessAccountRepository.save(account("enabled@test.com"));
        accountModuleRepository.save(AccountModule.builder()
                .accountId(account.getId())
                .module(AccountModule.Module.BUSINESS_AGENTS)
                .enabled(true)
                .build());

        boolean enabled = accountModuleService.isEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS);

        assertThat(enabled).isTrue();
    }

    @Test
    void should_deny_when_row_exists_but_disabled() {
        BusinessAccount account = businessAccountRepository.save(account("disabled@test.com"));
        accountModuleRepository.save(AccountModule.builder()
                .accountId(account.getId())
                .module(AccountModule.Module.BUSINESS_AGENTS)
                .enabled(false)
                .build());

        boolean enabled = accountModuleService.isEnabled(account.getId(), AccountModule.Module.BUSINESS_AGENTS);

        assertThat(enabled).isFalse();
    }

    @Test
    void should_default_every_known_module_to_false_when_no_rows_exist() {
        BusinessAccount account = businessAccountRepository.save(account("bare@test.com"));

        var entitlements = accountModuleService.getEntitlements(account.getId());

        assertThat(entitlements).containsEntry(AccountModule.Module.BUSINESS_AGENTS, false);
    }

    private BusinessAccount account(String email) {
        return BusinessAccount.builder()
                .name("Test Co")
                .email(email)
                .passwordHash("hash")
                .build();
    }
}
