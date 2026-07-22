package com.metaagent.platform.domain.webhook.service;

import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for WebhookRetentionJob.purgeOldWebhooks().
 *
 * Real MySQL via Testcontainers — deleteProcessedBefore uses a JPQL @Modifying query
 * that needs a real DB to execute. The job method is invoked directly (no scheduler).
 *
 * Retention window default is 30 days (webhook.retention.days).
 * We control "old vs recent" by manipulating processedAt on the saved rows.
 */
class WebhookRetentionJobTest extends IntegrationTestBase {

    // 31 days in the past — older than the default 30-day retention window
    private static final LocalDateTime OLD = LocalDateTime.now().minusDays(31);

    // 1 day in the past — within the retention window
    private static final LocalDateTime RECENT = LocalDateTime.now().minusDays(1);

    @Autowired
    private WebhookRetentionJob retentionJob;

    @Autowired
    private WebhookRawRepository webhookRawRepository;

    @AfterEach
    void cleanUp() {
        webhookRawRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private WebhookRaw saveWithProcessedAt(WebhookRaw.Status status, LocalDateTime processedAt) {
        WebhookRaw row = WebhookRaw.builder()
                .accountId(1L)
                .agentId(10L)
                .payload("{}")
                .signature("sha256=test")
                .status(status)
                .processedAt(processedAt)
                .build();
        return webhookRawRepository.save(row);
    }

    private WebhookRaw savePending() {
        // PENDING rows have no processedAt — they must never be deleted
        WebhookRaw row = WebhookRaw.builder()
                .accountId(1L)
                .agentId(10L)
                .payload("{}")
                .signature("sha256=test")
                .status(WebhookRaw.Status.PENDING)
                .build();
        return webhookRawRepository.save(row);
    }

    // -------------------------------------------------------------------------
    // Tests
    // -------------------------------------------------------------------------

    @Test
    void should_delete_processed_rows_older_than_retention_window() {
        saveWithProcessedAt(WebhookRaw.Status.PROCESSED, OLD);

        retentionJob.purgeOldWebhooks();

        assertThat(webhookRawRepository.findAll()).isEmpty();
    }

    @Test
    void should_delete_failed_rows_older_than_retention_window() {
        saveWithProcessedAt(WebhookRaw.Status.FAILED, OLD);

        retentionJob.purgeOldWebhooks();

        assertThat(webhookRawRepository.findAll()).isEmpty();
    }

    @Test
    void should_keep_recent_processed_rows_within_retention_window() {
        saveWithProcessedAt(WebhookRaw.Status.PROCESSED, RECENT);

        retentionJob.purgeOldWebhooks();

        assertThat(webhookRawRepository.findAll()).hasSize(1);
    }

    @Test
    void should_keep_pending_rows_regardless_of_age() {
        // PENDING rows have no processedAt — the WHERE clause requires processedAt < cutoff,
        // so NULL processedAt rows are never matched and must survive the purge.
        savePending();

        retentionJob.purgeOldWebhooks();

        assertThat(webhookRawRepository.findAll()).hasSize(1);
    }

    @Test
    void should_delete_old_rows_and_keep_recent_and_pending_rows_in_same_run() {
        // old PROCESSED — must be deleted
        saveWithProcessedAt(WebhookRaw.Status.PROCESSED, OLD);
        // old FAILED — must be deleted
        saveWithProcessedAt(WebhookRaw.Status.FAILED, OLD);
        // recent PROCESSED — must survive
        saveWithProcessedAt(WebhookRaw.Status.PROCESSED, RECENT);
        // PENDING — must survive
        savePending();

        retentionJob.purgeOldWebhooks();

        assertThat(webhookRawRepository.count()).isEqualTo(2);
        assertThat(webhookRawRepository.findAll())
                .extracting(WebhookRaw::getStatus)
                .containsExactlyInAnyOrder(WebhookRaw.Status.PROCESSED, WebhookRaw.Status.PENDING);
    }
}
