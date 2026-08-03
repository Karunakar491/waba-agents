package com.metaagent.platform.domain.templatestudio.iris;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AiProviderCredentialRepository extends JpaRepository<AiProviderCredential, Long> {
    Optional<AiProviderCredential> findByAccountIdAndProvider(Long accountId, String provider);
    boolean existsByAccountId(Long accountId);
}
