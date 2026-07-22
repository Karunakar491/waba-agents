package com.metaagent.platform.domain.analytics.repository;

import com.metaagent.platform.domain.analytics.entity.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WebhookEventRepository extends JpaRepository<WebhookEvent, Long> {
}
