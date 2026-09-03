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
 * Two-tier purge of webhook_raw rows (2026-08-14): account-attributed rows keep a
 * 30-day retention window; unattributed rows (no matching agent, or signature
 * verification failure — never belong to any tenant) are purged after 48 hours.
 * Runs every 6 hours so no row's actual age can exceed its window by more than
 * one interval. Prevents unbounded growth on t3.medium disk.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookRetentionJob {

    private final WebhookRawRepository webhookRawRepository;

    @Value("${webhook.retention.attributed-days:30}")
    private int attributedRetentionDays;

    @Value("${webhook.retention.unattributed-hours:48}")
    private int unattributedRetentionHours;

    @Scheduled(cron = "0 0 */6 * * *") // every 6 hours
    @Transactional
    public void purgeOldWebhooks() {
        LocalDateTime attributedCutoff = LocalDateTime.now().minusDays(attributedRetentionDays);
        int attributedDeleted = webhookRawRepository.deleteAttributedBefore(attributedCutoff);
        log.info("Webhook retention purge (attributed): deleted={} cutoff={} retentionDays={}",
                attributedDeleted, attributedCutoff, attributedRetentionDays);

        LocalDateTime unattributedCutoff = LocalDateTime.now().minusHours(unattributedRetentionHours);
        int unattributedDeleted = webhookRawRepository.deleteUnattributedBefore(unattributedCutoff);
        log.info("Webhook retention purge (unattributed): deleted={} cutoff={} retentionHours={}",
                unattributedDeleted, unattributedCutoff, unattributedRetentionHours);
    }
}
