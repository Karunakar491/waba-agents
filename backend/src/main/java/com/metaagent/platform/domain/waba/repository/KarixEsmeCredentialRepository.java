package com.metaagent.platform.domain.waba.repository;

import com.metaagent.platform.domain.waba.entity.KarixEsmeCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KarixEsmeCredentialRepository extends JpaRepository<KarixEsmeCredential, Long> {
    Optional<KarixEsmeCredential> findByEsmeAddr(String esmeAddr);
    List<KarixEsmeCredential> findAllByAccountId(Long accountId);
}
