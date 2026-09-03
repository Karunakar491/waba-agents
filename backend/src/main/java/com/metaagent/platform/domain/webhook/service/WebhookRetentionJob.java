package com.metaagent.platform.domain.webhook.service;

import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Daily purge of processed/failed webhook_raw rows older than the retention window.
 * Prevents unbounded growth on t3.medium disk.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookRetentionJob {

    private final WebhookRawRepository webhookRawRepository;

    @Value("${webhook.retention.days:30}")
    private int retentionDays;

    @Scheduled(cron = "0 0 2 * * *") // 02:00 server time daily
    @Transactional
    public void purgeOldWebhooks() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        int deleted = webhookRawRepository.deleteProcessedBefore(cutoff);
        log.info("Webhook retention purge: deleted={} cutoff={} retentionDays={}", deleted, cutoff, retentionDays);
    }
}
