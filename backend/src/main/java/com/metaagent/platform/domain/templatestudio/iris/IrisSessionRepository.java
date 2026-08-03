package com.metaagent.platform.domain.templatestudio.iris;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IrisSessionRepository extends JpaRepository<IrisSession, Long> {
    boolean existsByIdAndAccountId(Long id, Long accountId);
}
