package com.metaagent.platform.domain.templatestudio.iris;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IrisSessionRepository extends JpaRepository<IrisSession, Long> {
    boolean existsByIdAndAccountId(Long id, Long accountId);

    /**
     * Sidebar list — small projection (id/title/updatedAt only), never
     * hydrates pending_tool_args_json. Capped at 50 most recent (UX-caught
     * gap, 2026-08-07 audit: previously unbounded, rendering every session
     * an account had ever created — a real problem at scale). A "load more"
     * UI is real pagination work deferred past this fix; 50 covers the
     * realistic near-term case without the unbounded-render risk.
     */
    List<IrisSessionSummaryProjection> findTop50ByAccountIdOrderByUpdatedAtDesc(Long accountId);
}
