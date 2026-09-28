package com.metaagent.platform.domain.businessevent.repository;

import com.metaagent.platform.domain.businessevent.entity.BusinessEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BusinessEventRepository extends JpaRepository<BusinessEvent, Long> {
    List<BusinessEvent> findAllByAccountIdOrderByNameAsc(Long accountId);

    Optional<BusinessEvent> findByIdAndAccountId(Long id, Long accountId);
}
