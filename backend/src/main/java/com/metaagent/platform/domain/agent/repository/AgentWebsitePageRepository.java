package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.AgentWebsitePage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AgentWebsitePageRepository extends JpaRepository<AgentWebsitePage, Long> {

    void deleteAllByWebsiteId(Long websiteId);

    void deleteAllByAgentId(Long agentId);
}
