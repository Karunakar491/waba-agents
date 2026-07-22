package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentWebsitePage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface AgentWebsitePageRepository extends JpaRepository<AgentWebsitePage, Long> {

    @Transactional
    void deleteAllByWebsiteId(Long websiteId);
}
