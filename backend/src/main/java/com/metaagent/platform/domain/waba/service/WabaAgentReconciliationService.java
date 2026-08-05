package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.waba.entity.WabaAccountAccess;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Runs whenever a WABA's phone list is viewed (WabaService.validate/getPhones):
 * grants the viewing account access to the WABA, then for every phone number
 * with a live Meta agent config that has no local Agent row yet, creates one.
 * 2026-07-28 decoupling decision — see project memory.
 *
 * Never fails the caller's view: a Meta lookup failure for one phone number
 * is logged and skipped, not thrown; the WABA-view page must still render
 * even when reconciliation can't complete for some/all numbers.
 *
 * grantAccessIfMissing() below calls the repository directly rather than
 * WabaAccessGuard — it's an idempotent-insert existence check deciding
 * whether to grant access, not a gate deciding whether to allow it. See
 * WabaAccessGuardEnforcementTest's ALLOWED_EXISTENCE_CHECK_SUFFIX note.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WabaAgentReconciliationService {

    private final AgentRepository agentRepository;
    private final WabaAccountAccessRepository wabaAccountAccessRepository;
    private final MetaApiClient metaApiClient;

    public void reconcile(Long wabaId, Long accountId, List<String> phoneNumberIds) {
        grantAccessIfMissing(wabaId, accountId);
        for (String phoneNumberId : phoneNumberIds) {
            try {
                reconcileOne(wabaId, accountId, phoneNumberId);
            } catch (Exception e) {
                log.warn("Reconciliation failed for phoneNumberId={}: {}", phoneNumberId, e.getMessage());
            }
        }
    }

    private void grantAccessIfMissing(Long wabaId, Long accountId) {
        if (wabaAccountAccessRepository.existsByWabaIdAndAccountId(wabaId, accountId)) {
            return;
        }
        try {
            wabaAccountAccessRepository.save(WabaAccountAccess.builder()
                    .wabaId(wabaId)
                    .accountId(accountId)
                    .grantedBy(accountId)
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Concurrent view already inserted the same grant — fine, unique index did its job.
        }
    }

    @SuppressWarnings("unchecked")
    private void reconcileOne(Long wabaId, Long accountId, String phoneNumberId) {
        if (agentRepository.findByPhoneNumberId(phoneNumberId).isPresent()) {
            return; // already tracked locally — never overwritten, reconciliation only adds
        }

        List<?> settings;
        try {
            // Same shape WabaService.deployPreflight already relies on for this endpoint.
            settings = metaApiClient.get("/" + phoneNumberId + "/agent_config/settings", List.class);
        } catch (MetaApiException e) {
            if (e.isNotFound()) return; // nothing configured on Meta — nothing to import
            throw e;
        }
        if (settings == null || settings.isEmpty()) {
            return;
        }

        // Settings GET returns one entry per configured channel (settings.md)
        // — never assume index 0 is WhatsApp on a multi-channel number.
        Map<?, ?> entry = MetaApiClient.findChannelEntry(settings, "whatsapp");
        if (entry == null || entry.get("agent_id") == null) {
            return; // no live Meta agent on this number
        }

        boolean rolloutEnabled = entry.get("rollout") instanceof Map<?, ?> rollout
                && Boolean.TRUE.equals(rollout.get("enabled"));

        // Hydrate handoff from Meta's real config — without this, an imported
        // agent's real handoff message is silently lost the first time this
        // app writes settings (deploy/pause), since that write always
        // rebuilds handoff from these local columns. See Wave 1a.
        boolean handoffEnabled = false;
        String handoffMessage = null;
        if (entry.get("handoff") instanceof Map<?, ?> handoff) {
            handoffEnabled = Boolean.TRUE.equals(handoff.get("enabled"));
            Object msg = handoff.get("message");
            handoffMessage = msg != null ? msg.toString() : null;
        }

        Agent agent = Agent.builder()
                .accountId(accountId) // informational creator stamp only — see Agent.accountId javadoc
                .wabaId(wabaId)
                .phoneNumberId(phoneNumberId)
                .metaAgentId(String.valueOf(entry.get("agent_id")))
                // TASK-063/066 reverted (2026-07-30): Meta's verified_name is the
                // WABA's registered business name, NOT the per-client identity —
                // multiple distinct client agents on a shared Karix-owned WABA all
                // share the same verified_name, so resolving it here silently
                // collapsed unrelated businesses into one indistinguishable label.
                // The phoneNumberId-based placeholder is honestly unique; a human
                // renames it via the agent's Settings tab once they know who it is.
                .displayName("Imported agent (" + phoneNumberId + ")")
                .channel(Agent.Channel.whatsapp)
                .status(rolloutEnabled ? Agent.Status.active : Agent.Status.paused)
                .enabled(rolloutEnabled)
                .handoffEnabled(handoffEnabled)
                .handoffMessage(handoffMessage)
                .build();
        try {
            agentRepository.saveAndFlush(agent);
            log.info("Reconciled Meta agent into local DB: phoneNumberId={} wabaId={}", phoneNumberId, wabaId);
        } catch (DataIntegrityViolationException e) {
            // Another concurrent view already imported this number — fine, unique index wins.
        }
    }
}
