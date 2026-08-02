package com.metaagent.platform.infrastructure.meta.audit;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiCallLogRepository extends JpaRepository<ApiCallLog, Long> {
    List<ApiCallLog> findAllByAccountIdOrderByCalledAtDesc(Long accountId, Pageable pageable);
}
