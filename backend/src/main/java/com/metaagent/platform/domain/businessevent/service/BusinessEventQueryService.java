package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FireCounts;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FireDetail;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FireListItem;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FirePage;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Reads the announcement ledger. Never writes to it — the firing path owns
 * every write and this service must not become a second one.
 *
 * <p>Ownership is proved on every single method, through
 * {@link AgentAccessService#getAccessible}, before a row is fetched rather
 * than after: the ledger holds customer phone numbers, and a wrong answer here
 * leaks one account's customers to another. {@code getAccessible} throws
 * {@link NotFoundException} rather than a 403, so a stranger cannot even learn
 * that an agent id exists.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BusinessEventQueryService {

    /** Meta reports arrival either way; both mean the customer was told. */
    private static final Set<BusinessEventFire.MetaStatus> REACHED = Set.of(
            BusinessEventFire.MetaStatus.sent, BusinessEventFire.MetaStatus.success);

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_WINDOW_DAYS = 90;

    private final BusinessEventFireRepository fireRepository;
    private final AgentAccessService agentAccessService;

    /** The agent's history, newest first, optionally narrowed to one verdict. */
    public FirePage listFires(Long agentId, Long accountId, BusinessEventFire.Outcome outcome, int page, int size) {
        agentAccessService.getAccessible(agentId, accountId);

        Pageable pageable = PageRequest.of(Math.max(page, 0), clamp(size, 20, MAX_PAGE_SIZE));
        Page<BusinessEventFire> fires = outcome == null
                ? fireRepository.findByAgentIdOrderByCreatedAtDesc(agentId, pageable)
                : fireRepository.findByAgentIdAndOutcomeOrderByCreatedAtDesc(agentId, outcome, pageable);

        List<FireListItem> items = fires.getContent().stream().map(FireListItem::from).toList();
        return new FirePage(items, fires.getNumber(), fires.getSize(), fires.getTotalElements(), fires.getTotalPages());
    }

    /**
     * One fire. The account is part of the lookup and the agent is checked
     * against the row, so a fire id from another agent's ledger is a 404 even
     * within the same account.
     */
    public FireDetail getFire(Long agentId, Long accountId, Long fireId) {
        agentAccessService.getAccessible(agentId, accountId);

        BusinessEventFire fire = fireRepository.findByIdAndAccountId(fireId, accountId)
                .filter(f -> agentId.equals(f.getAgentId()))
                .orElseThrow(() -> new NotFoundException("Event not found"));
        return FireDetail.from(fire);
    }

    /** Asked for, sent, reached — over the last {@code days}, default 7. */
    public FireCounts countFires(Long agentId, Long accountId, int days) {
        agentAccessService.getAccessible(agentId, accountId);

        int window = clamp(days, 7, MAX_WINDOW_DAYS);
        LocalDateTime since = LocalDateTime.now().minusDays(window);

        long askedFor = fireRepository.countByAgentIdAndCreatedAtAfter(agentId, since);
        long sent = fireRepository.countByAgentIdAndCreatedAtAfterAndOutcome(
                agentId, since, BusinessEventFire.Outcome.ACCEPTED);
        long reached = fireRepository.countByAgentIdAndCreatedAtAfterAndOutcomeAndMetaStatusIn(
                agentId, since, BusinessEventFire.Outcome.ACCEPTED, REACHED);

        return new FireCounts(askedFor, sent, reached, window);
    }

    private static int clamp(int value, int fallback, int max) {
        if (value <= 0) {
            return fallback;
        }
        return Math.min(value, max);
    }
}
