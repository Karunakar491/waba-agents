package com.metaagent.platform.domain.waba.repository;

import com.metaagent.platform.domain.waba.entity.WabaKarixCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WabaKarixCredentialRepository extends JpaRepository<WabaKarixCredential, Long> {
    Optional<WabaKarixCredential> findByWabaId(Long wabaId);
}
