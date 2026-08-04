package com.metaagent.platform.domain.templatestudio.iris;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IrisSessionRepository extends JpaRepository<IrisSession, Long> {
    boolean existsByIdAndAccountId(Long id, Long accountId);

    /** Sidebar list — small projection (id/title/updatedAt only), never hydrates pending_tool_args_json. */
    List<IrisSessionSummaryProjection> findByAccountIdOrderByUpdatedAtDesc(Long accountId);
}
