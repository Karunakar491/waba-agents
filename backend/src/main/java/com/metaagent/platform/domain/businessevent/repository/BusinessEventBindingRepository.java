package com.metaagent.platform.domain.businessevent.repository;

import com.metaagent.platform.domain.businessevent.entity.BusinessEventBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BusinessEventBindingRepository extends JpaRepository<BusinessEventBinding, Long> {
    List<BusinessEventBinding> findAllByAgentId(Long agentId);

    List<BusinessEventBinding> findAllByBusinessEventId(Long businessEventId);

    Optional<BusinessEventBinding> findByAgentIdAndBusinessEventId(Long agentId, Long businessEventId);

    /** Batched "used by N agents" count for the whole library table — avoids an N+1 per row. */
    @Query("select b.businessEventId, count(b) from BusinessEventBinding b "
            + "where b.businessEventId in :eventIds group by b.businessEventId")
    List<Object[]> countByBusinessEventIdIn(@Param("eventIds") List<Long> eventIds);
}
