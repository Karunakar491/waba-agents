package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Own class, not a private method on ConversationService — same reasoning as
 * every @Async service in this codebase (see AgentDetailSyncService's
 * javadoc): self-invocation bypasses Spring's transactional proxy.
 *
 * EL-diagnosed (2026-08-03): must be called from WebhookListener's catch
 * block — AFTER ConversationService.processWebhookEvent's own transaction has
 * actually rolled back and released the row lock claimForProcessing took —
 * NOT from within that method's own catch block. A first version tried
 * REQUIRES_NEW from inside processWebhookEvent's still-open (rollback-only)
 * transaction: the suspended outer transaction still holds an InnoDB X lock
 * on that exact row, so the "new" transaction's UPDATE blocks on its own
 * caller's lock for the full innodb_lock_wait_timeout before failing —
 * silently reverting the row to PENDING and stalling this single-consumer
 * queue on every failure. Calling from the listener, after the parent
 * transaction is fully done, means no REQUIRES_NEW is needed — this is
 * already the only active transaction at that point.
 */
@Service
@RequiredArgsConstructor
public class WebhookFailureRecorder {

    private final WebhookRawRepository webhookRawRepository;

    @Transactional
    public void markFailed(Long webhookRawId, String errorMessage) {
        webhookRawRepository.findById(webhookRawId).ifPresent(raw -> {
            raw.setStatus(WebhookRaw.Status.FAILED);
            raw.setErrorMessage(errorMessage);
            webhookRawRepository.save(raw);
        });
    }
}
