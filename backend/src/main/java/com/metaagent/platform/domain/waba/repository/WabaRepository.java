package com.metaagent.platform.domain.waba.repository;

import com.metaagent.platform.domain.waba.entity.Waba;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WabaRepository extends JpaRepository<Waba, Long> {

    List<Waba> findAllByAccountId(Long accountId);

    Optional<Waba> findByIdAndAccountId(Long id, Long accountId);

    Optional<Waba> findByAccountIdAndWabaId(Long accountId, String wabaId);
}
