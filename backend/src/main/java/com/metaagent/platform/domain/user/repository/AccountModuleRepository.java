package com.metaagent.platform.domain.user.repository;

import com.metaagent.platform.domain.user.entity.AccountModule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountModuleRepository extends JpaRepository<AccountModule, Long> {
    Optional<AccountModule> findByAccountIdAndModule(Long accountId, AccountModule.Module module);
    List<AccountModule> findAllByAccountId(Long accountId);
}
