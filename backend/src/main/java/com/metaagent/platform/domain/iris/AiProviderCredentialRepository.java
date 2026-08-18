package com.metaagent.platform.domain.iris;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiProviderCredentialRepository extends JpaRepository<AiProviderCredential, Long> {
    Optional<AiProviderCredential> findByAccountIdAndProvider(Long accountId, String provider);
    /** An account has one ACTIVE provider at a time in practice — read paths pick the first. */
    List<AiProviderCredential> findAllByAccountId(Long accountId);
    boolean existsByAccountId(Long accountId);
}
