package com.metaagent.platform.domain.user.repository;

import com.metaagent.platform.domain.user.entity.BusinessAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BusinessAccountRepository extends JpaRepository<BusinessAccount, Long> {
    Optional<BusinessAccount> findByEmail(String email);
}
