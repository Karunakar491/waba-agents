package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FireCounts;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventDtos.FirePage;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * The ledger holds customers' phone numbers, so the test that matters most is
 * the one where the caller does not own the agent.
 */
class BusinessEventQueryServiceTest {

    private static final Long AGENT_ID = 100L;
    private static final Long ACCOUNT_ID = 7L;
    private static final Long OTHER_ACCOUNT_ID = 8L;

    private BusinessEventFireRepository fireRepository;
    private AgentAccessService agentAccessService;
    private BusinessEventQueryService service;

    @BeforeEach
    void setUp() {
        fireRepository = mock(BusinessEventFireRepository.class);
        agentAccessService = mock(AgentAccessService.class);
        service = new BusinessEventQueryService(fireRepository, agentAccessService);

        Agent agent = new Agent();
        agent.setId(AGENT_ID);
        agent.setAccountId(ACCOUNT_ID);
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);
        when(agentAccessService.getAccessible(AGENT_ID, OTHER_ACCOUNT_ID))
                .thenThrow(new NotFoundException("Agent not found"));
    }

    private BusinessEventFire fire(Long id, BusinessEventFire.Outcome outcome) {
        BusinessEventFire f = BusinessEventFire.builder()
                .id(id)
                .accountId(ACCOUNT_ID)
                .agentId(AGENT_ID)
                .toPhone("+919010011634")
                .source(BusinessEventFire.Source.INBOUND_API)
                .requestEventType("order_shipped")
                .requestDescription("Your order is on its way")
                .requestPayload("{}")
                .outcome(outcome)
                .build();
        f.setCreatedAt(LocalDateTime.now());
        f.setUpdatedAt(LocalDateTime.now());
        return f;
    }

    @Test
    void anotherAccountCannotReadTheLedger() {
        assertThrows(NotFoundException.class,
                () -> service.listFires(AGENT_ID, OTHER_ACCOUNT_ID, null, 0, 20));
        assertThrows(NotFoundException.class,
                () -> service.getFire(AGENT_ID, OTHER_ACCOUNT_ID, 1L));
        assertThrows(NotFoundException.class,
                () -> service.countFires(AGENT_ID, OTHER_ACCOUNT_ID, 7));

        verifyNoInteractions(fireRepository);
    }

    @Test
    void aFireBelongingToAnotherAgentIsNotFound() {
        BusinessEventFire otherAgentsFire = fire(5L, BusinessEventFire.Outcome.ACCEPTED);
        otherAgentsFire.setAgentId(999L);
        when(fireRepository.findByIdAndAccountId(5L, ACCOUNT_ID)).thenReturn(Optional.of(otherAgentsFire));

        assertThrows(NotFoundException.class, () -> service.getFire(AGENT_ID, ACCOUNT_ID, 5L));
    }

    @Test
    void pagingAsksForThePageRequestedAndReportsTheTotals() {
        when(fireRepository.findByAgentIdOrderByCreatedAtDesc(eq(AGENT_ID), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(fire(1L, BusinessEventFire.Outcome.ACCEPTED)),
                        PageRequest.of(2, 5), 11));

        FirePage result = service.listFires(AGENT_ID, ACCOUNT_ID, null, 2, 5);

        verify(fireRepository).findByAgentIdOrderByCreatedAtDesc(AGENT_ID, PageRequest.of(2, 5));
        assertEquals(2, result.page());
        assertEquals(5, result.size());
        assertEquals(11L, result.totalItems());
        assertEquals(3, result.totalPages());
        assertEquals(1, result.items().size());
        assertEquals("+919010011634", result.items().get(0).customerPhone());
        assertEquals("order_shipped", result.items().get(0).eventName());
    }

    @Test
    void theOutcomeFilterUsesTheFilteredQueryOnly() {
        when(fireRepository.findByAgentIdAndOutcomeOrderByCreatedAtDesc(
                eq(AGENT_ID), eq(BusinessEventFire.Outcome.REFUSED), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(fire(2L, BusinessEventFire.Outcome.REFUSED)),
                        PageRequest.of(0, 20), 1));

        FirePage result = service.listFires(AGENT_ID, ACCOUNT_ID, BusinessEventFire.Outcome.REFUSED, 0, 20);

        assertEquals("REFUSED", result.items().get(0).outcome());
        verify(fireRepository).findByAgentIdAndOutcomeOrderByCreatedAtDesc(
                AGENT_ID, BusinessEventFire.Outcome.REFUSED, PageRequest.of(0, 20));
        verify(fireRepository, never()).findByAgentIdOrderByCreatedAtDesc(anyLong(), any(Pageable.class));
    }

    @Test
    void countsAreThreeSeparateNumbersNotOneTotal() {
        when(fireRepository.countByAgentIdAndCreatedAtAfter(eq(AGENT_ID), any())).thenReturn(33L);
        when(fireRepository.countByAgentIdAndCreatedAtAfterAndOutcome(
                eq(AGENT_ID), any(), eq(BusinessEventFire.Outcome.ACCEPTED))).thenReturn(31L);
        when(fireRepository.countByAgentIdAndCreatedAtAfterAndOutcomeAndMetaStatusIn(
                eq(AGENT_ID), any(), eq(BusinessEventFire.Outcome.ACCEPTED), any())).thenReturn(29L);

        FireCounts counts = service.countFires(AGENT_ID, ACCOUNT_ID, 7);

        assertEquals(33L, counts.askedFor());
        assertEquals(31L, counts.sent());
        assertEquals(29L, counts.reached());
        assertEquals(7, counts.windowDays());
    }

    @Test
    void anAbsurdWindowOrPageSizeIsClampedRatherThanObeyed() {
        when(fireRepository.findByAgentIdOrderByCreatedAtDesc(eq(AGENT_ID), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 100), 0));

        service.listFires(AGENT_ID, ACCOUNT_ID, null, -1, 5000);
        verify(fireRepository).findByAgentIdOrderByCreatedAtDesc(AGENT_ID, PageRequest.of(0, 100));

        assertEquals(90, service.countFires(AGENT_ID, ACCOUNT_ID, 9999).windowDays());
    }
}
