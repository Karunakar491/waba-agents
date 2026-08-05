package com.metaagent.platform.domain.client.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.analytics.repository.WebhookEventRepository;
import com.metaagent.platform.domain.client.dto.ClientDtos;
import com.metaagent.platform.domain.client.entity.Client;
import com.metaagent.platform.domain.client.entity.ClientAuditLog;
import com.metaagent.platform.domain.client.entity.ClientStaff;
import com.metaagent.platform.domain.client.repository.ClientAuditLogRepository;
import com.metaagent.platform.domain.client.repository.ClientRepository;
import com.metaagent.platform.domain.client.repository.ClientStaffRepository;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.domain.user.entity.User;
import com.metaagent.platform.domain.user.repository.UserRepository;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.domain.waba.service.WabaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Client CRUD + staff access grants, scoped to the caller's account.
 *
 * Tenant isolation follows the AnalyticsService/WabaService convention: every read/write
 * verifies the record belongs to the caller's account (and, for client-scoped operations,
 * that the caller is a granted staff member) before touching data — fails closed with
 * NotFoundException so record existence is never leaked across tenants or to unauthorized staff.
 */
@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clientRepository;
    private final ClientStaffRepository clientStaffRepository;
    private final ClientAuditLogRepository clientAuditLogRepository;
    private final WabaRepository wabaRepository;
    private final WabaService wabaService;
    private final UserRepository userRepository;
    private final AgentRepository agentRepository;
    private final ConversationRepository conversationRepository;
    private final WebhookEventRepository webhookEventRepository;

    @Transactional
    public Client create(String name, Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long callerId = SecurityContextHelper.getRequiredUserId();

        wabaRepository.findByIdAndAccountId(wabaId, accountId)
                .orElseThrow(() -> new BusinessException("WABA not found"));

        Client client = Client.builder()
                .accountId(accountId)
                .name(name)
                .wabaId(wabaId)
                .createdBy(callerId)
                .updatedBy(callerId)
                .build();
        client = clientRepository.save(client);

        // Creator gets access by default — otherwise nobody could see the client they just made.
        clientStaffRepository.save(ClientStaff.builder()
                .clientId(client.getId())
                .userId(callerId)
                .grantedBy(callerId)
                .build());

        logChange(client.getId(), callerId, "created client '" + name + "'");
        return client;
    }

    /** Clients the calling staff member has been granted access to. */
    public List<Client> listForCaller() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long callerId = SecurityContextHelper.getRequiredUserId();
        return clientRepository.findAllByAccountIdAndStaffUserId(accountId, callerId);
    }

    public Client getDetail(Long clientId) {
        return verifyStaffAccess(clientId);
    }

    public List<ClientStaff> getStaff(Long clientId) {
        verifyStaffAccess(clientId);
        return clientStaffRepository.findAllByClientId(clientId);
    }

    public List<ClientAuditLog> getAuditLog(Long clientId) {
        verifyStaffAccess(clientId);
        return clientAuditLogRepository.findAllByClientIdOrderByChangedAtDesc(clientId);
    }

    /**
     * Phone numbers + health status for the client's WABA — reuses WabaService's
     * live Meta lookup rather than duplicating phone data in a separate table.
     */
    public List<WabaDtos.PhoneNumber> getPhoneNumbers(Long clientId) {
        Client client = verifyStaffAccess(clientId);
        if (client.getWabaId() == null) {
            return List.of();
        }
        var waba = wabaRepository.findByIdAndAccountId(client.getWabaId(), client.getAccountId())
                .orElseThrow(() -> new BusinessException("WABA not found"));
        return wabaService.getPhones(waba.getWabaId());
    }

    @Transactional
    public Client update(Long clientId, String name, Client.CreditLineStatus creditLineStatus) {
        Client client = verifyStaffAccess(clientId);
        Long callerId = SecurityContextHelper.getRequiredUserId();

        List<String> changes = new ArrayList<>();
        if (!Objects.equals(client.getName(), name)) {
            changes.add("name: '" + client.getName() + "' -> '" + name + "'");
            client.setName(name);
        }
        if (client.getCreditLineStatus() != creditLineStatus) {
            changes.add("creditLineStatus: " + client.getCreditLineStatus() + " -> " + creditLineStatus);
            client.setCreditLineStatus(creditLineStatus);
        }
        if (changes.isEmpty()) {
            return client;
        }

        client.setUpdatedBy(callerId);
        client = clientRepository.save(client);
        logChange(clientId, callerId, String.join("; ", changes));
        return client;
    }

    @Transactional
    public void addStaffAccess(Long clientId, Long targetUserId) {
        Client client = verifyStaffAccess(clientId);
        Long callerId = SecurityContextHelper.getRequiredUserId();

        userRepository.findByIdAndAccountId(targetUserId, client.getAccountId())
                .orElseThrow(() -> new BusinessException("Staff user not found"));

        if (clientStaffRepository.existsByClientIdAndUserId(clientId, targetUserId)) {
            return; // idempotent
        }
        clientStaffRepository.save(ClientStaff.builder()
                .clientId(clientId)
                .userId(targetUserId)
                .grantedBy(callerId)
                .build());
        logChange(clientId, callerId, "granted staff access to user " + targetUserId);
    }

    /**
     * Fleet-risk ranking for the Client Command Bar (roadmap item 45) — staff-grant
     * scoped via {@link #listForCaller()}, same access model as every other client
     * read, never all-access (2026-08-06 founder decision: respect the existing
     * ClientStaff boundary rather than widen it for this feature).
     *
     * agentErrorRatePct is NOT a distinct tracked metric — EM decision 2026-08-06:
     * no new error-tracking pipeline for v1. It reuses webhookFailureRatePct's
     * underlying data (webhook_events.status != 'success'), since the schema has
     * no way to separate "delivery failure" from "agent processing error" by
     * event type. Always returned with approximate=true — the frontend must
     * disclose this, not present it as a precise second signal.
     */
    public List<ClientDtos.FleetRiskRow> getFleetRisk() {
        List<Client> clients = listForCaller();
        LocalDateTime since = LocalDateTime.now().minusHours(24);
        LocalDateTime now = LocalDateTime.now();

        return clients.stream().map(client -> {
            if (client.getWabaId() == null) {
                return new ClientDtos.FleetRiskRow(String.valueOf(client.getId()), client.getName(), 0, 0, 0.0, 0, 0.0, true);
            }
            List<Long> agentIds = agentRepository.findAllByWabaId(client.getWabaId()).stream().map(Agent::getId).toList();
            if (agentIds.isEmpty()) {
                return new ClientDtos.FleetRiskRow(String.valueOf(client.getId()), client.getName(), 0, 0, 0.0, 0, 0.0, true);
            }

            LocalDateTime oldestOpen = conversationRepository.findOldestOpenLastMessageAt(agentIds, Conversation.Status.open);
            long staleMins = oldestOpen != null ? Duration.between(oldestOpen, now).toMinutes() : 0;

            long handoffBacklog = conversationRepository.countByAgentIdInAndStatusAndNeedsHumanTrue(agentIds, Conversation.Status.open);

            var webhookStats = webhookEventRepository.countByAgentIdsSince(agentIds, since);
            long totalEvents = webhookStats.stream().mapToLong(WebhookEventRepository.AgentWebhookStats::getTotal).sum();
            long failedEvents = webhookStats.stream().mapToLong(WebhookEventRepository.AgentWebhookStats::getFailed).sum();
            double failureRate = totalEvents > 0 ? (failedEvents * 100.0) / totalEvents : 0.0;

            int score = blendRiskScore(staleMins, failureRate, handoffBacklog);

            return new ClientDtos.FleetRiskRow(
                    String.valueOf(client.getId()), client.getName(), score,
                    staleMins, failureRate, handoffBacklog, failureRate, true);
        }).sorted((a, b) -> Integer.compare(b.riskScore(), a.riskScore())).toList();
    }

    /**
     * Weighted blend, 0-100. Weights are a starting point, not tuned against real
     * usage yet — PM's own risk note: ship with a visible per-signal breakdown so
     * an operator can sanity-check a misranked client on day one, don't just trust
     * one opaque number.
     */
    private static int blendRiskScore(long staleMins, double failureRatePct, long handoffBacklog) {
        double staleScore = Math.min(100, staleMins / 4.0); // 400+ min stale = maxed out
        double failureScore = Math.min(100, failureRatePct * 2); // 50%+ failure = maxed out
        double handoffScore = Math.min(100, handoffBacklog * 20.0); // 5+ backlog = maxed out
        double blended = staleScore * 0.35 + failureScore * 0.35 + handoffScore * 0.30;
        return (int) Math.round(Math.min(100, Math.max(0, blended)));
    }

    @Transactional
    public void removeStaffAccess(Long clientId, Long targetUserId) {
        verifyStaffAccess(clientId);
        Long callerId = SecurityContextHelper.getRequiredUserId();

        List<ClientStaff> current = clientStaffRepository.findAllByClientId(clientId);
        boolean targetHasAccess = current.stream().anyMatch(cs -> cs.getUserId().equals(targetUserId));
        if (!targetHasAccess) {
            return; // idempotent
        }
        if (current.size() == 1) {
            throw new BusinessException("Cannot remove the last staff member with access to this client");
        }

        clientStaffRepository.deleteByClientIdAndUserId(clientId, targetUserId);
        logChange(clientId, callerId, "revoked staff access from user " + targetUserId);
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * Fails closed: a client outside the caller's account, or one the caller has not been
     * granted access to, returns NotFoundException either way — never leaks which case it was.
     */
    private Client verifyStaffAccess(Long clientId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long callerId = SecurityContextHelper.getRequiredUserId();

        Client client = clientRepository.findByIdAndAccountId(clientId, accountId)
                .orElseThrow(() -> new NotFoundException("Client not found"));

        if (!clientStaffRepository.existsByClientIdAndUserId(clientId, callerId)) {
            throw new NotFoundException("Client not found");
        }
        return client;
    }

    private void logChange(Long clientId, Long changedBy, String summary) {
        clientAuditLogRepository.save(ClientAuditLog.builder()
                .clientId(clientId)
                .changedBy(changedBy)
                .changeSummary(summary)
                .build());
    }
}
