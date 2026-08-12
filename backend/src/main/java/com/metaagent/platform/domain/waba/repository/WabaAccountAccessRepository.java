package com.metaagent.platform.domain.waba.repository;

import com.metaagent.platform.domain.waba.entity.WabaAccountAccess;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WabaAccountAccessRepository extends JpaRepository<WabaAccountAccess, Long> {

    boolean existsByWabaIdAndAccountId(Long wabaId, Long accountId);

    List<WabaAccountAccess> findAllByAccountId(Long accountId);

    List<WabaAccountAccess> findAllByWabaId(Long wabaId);

    long countByWabaId(Long wabaId);

    void deleteByWabaIdAndAccountId(Long wabaId, Long accountId);
}
