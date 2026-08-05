package com.metaagent.platform.domain.analytics.repository;

import com.metaagent.platform.domain.analytics.entity.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WebhookEventRepository extends JpaRepository<WebhookEvent, Long> {

    /** Total + failed webhook_events per agent, for the Client Command Bar's fleet-risk signal (roadmap item 45). */
    @Query("select w.agentId as agentId, count(w) as total, "
            + "sum(case when w.status <> 'success' then 1 else 0 end) as failed "
            + "from WebhookEvent w where w.agentId in :agentIds and w.receivedAt >= :since group by w.agentId")
    List<AgentWebhookStats> countByAgentIdsSince(@Param("agentIds") List<Long> agentIds, @Param("since") LocalDateTime since);

    interface AgentWebhookStats {
        Long getAgentId();
        Long getTotal();
        Long getFailed();
    }
}
