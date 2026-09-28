package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyShort;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * The poller exists for one answer in particular: {@code skipped} — Meta
 * accepted the announcement, delivered nothing, and the customer was never
 * told. Without this job that row looks exactly like a success.
 */
class BusinessEventStatusPollJobTest {

    private static final Long AGENT_ID = 100L;
    private static final Long ACCOUNT_ID = 7L;

    private BusinessEventFireRepository fireRepository;
    private AgentRepository agentRepository;
    private AgentEventClient agentEventClient;
    private BusinessEventStatusPollJob job;

    @BeforeEach
    void setUp() {
        fireRepository = mock(BusinessEventFireRepository.class);
        agentRepository = mock(AgentRepository.class);
        agentEventClient = mock(AgentEventClient.class);
        job = new BusinessEventStatusPollJob(fireRepository, agentRepository, agentEventClient);
        ReflectionTestUtils.setField(job, "pollEnabled", true);

        Agent agent = new Agent();
        agent.setId(AGENT_ID);
        agent.setAccountId(ACCOUNT_ID);
        agent.setPhoneNumberId("pn-1");
        agent.setStatus(Agent.Status.active);
        when(agentRepository.findById(AGENT_ID)).thenReturn(Optional.of(agent));
        when(fireRepository.save(any(BusinessEventFire.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void killSwitchStopsTheJobBeforeItTouchesAnything() {
        ReflectionTestUtils.setField(job, "pollEnabled", false);

        job.poll();

        verifyNoInteractions(fireRepository, agentRepository, agentEventClient);
    }

    @Test
    void skippedIsRecordedAsTerminalWithMetaSReason() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentEventClient.fetchStatus(anyString(), anyString())).thenReturn(
                new AgentEventClient.StatusResponse("skipped", "order_shipped", null,
                        "conversation window closed", null, null));

        job.poll();

        assertEquals(BusinessEventFire.MetaStatus.skipped, fire.getMetaStatus());
        assertEquals("conversation window closed", fire.getMetaSkippedReason());
        assertNotNull(fire.getTerminalAt());
    }

    @Test
    void processingIsNotTerminalAndStaysInTheQueue() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentEventClient.fetchStatus(anyString(), anyString())).thenReturn(
                new AgentEventClient.StatusResponse("processing", "order_shipped", null, null, null, null));

        job.poll();

        assertEquals(BusinessEventFire.MetaStatus.processing, fire.getMetaStatus());
        assertNull(fire.getTerminalAt());
        assertEquals(1, fire.getPollAttempts());
    }

    @Test
    void aStatusMetaInventsTomorrowBecomesUnknownRatherThanAnException() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentEventClient.fetchStatus(anyString(), anyString())).thenReturn(
                new AgentEventClient.StatusResponse("quarantined", "order_shipped", null, null, null, null));

        job.poll();

        assertEquals(BusinessEventFire.MetaStatus.unknown, fire.getMetaStatus());
    }

    @Test
    void oneFourOhFourIsNotEnoughToGiveUp() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentEventClient.fetchStatus(anyString(), anyString())).thenThrow(new MetaApiException(404, null));

        job.poll();

        assertNull(fire.getTerminalAt());
    }

    @Test
    void threeConsecutiveFourOhFoursStopUsPollingAGhostForever() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentEventClient.fetchStatus(anyString(), anyString())).thenThrow(new MetaApiException(404, null));

        job.poll();
        fire.setLastPolledAt(null); // next cycle, backoff already elapsed
        job.poll();
        fire.setLastPolledAt(null);
        job.poll();

        assertEquals(BusinessEventFire.MetaStatus.unknown, fire.getMetaStatus());
        assertNotNull(fire.getTerminalAt());
    }

    @Test
    void aFiveHundredLeavesTheRowAliveForTheNextCycle() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentEventClient.fetchStatus(anyString(), anyString())).thenThrow(new MetaApiException(500, "boom"));

        job.poll();

        assertNull(fire.getTerminalAt());
        assertNull(fire.getMetaStatus());
    }

    @Test
    void oneBadRowDoesNotStarveTheRestOfTheBatch() {
        BusinessEventFire poison = accepted();
        poison.setId(1L);
        BusinessEventFire good = accepted();
        good.setId(2L);
        when(fireRepository.findDueForPoll(any(), anyShort(), any(), any(Pageable.class)))
                .thenReturn(List.of(poison, good));
        when(agentEventClient.fetchStatus(anyString(), eq("evt-1")))
                .thenThrow(new IllegalStateException("kaboom"));
        when(agentEventClient.fetchStatus(anyString(), eq("evt-2")))
                .thenReturn(new AgentEventClient.StatusResponse("sent", "order_shipped", null, null, null, null));
        poison.setMetaAgentEventId("evt-1");
        good.setMetaAgentEventId("evt-2");

        job.poll();

        assertEquals(BusinessEventFire.MetaStatus.sent, good.getMetaStatus());
        assertNotNull(good.getTerminalAt());
    }

    @Test
    void anAgentThatLostItsNumberIsClosedOutRatherThanPolledForever() {
        BusinessEventFire fire = accepted();
        givenDue(fire);
        when(agentRepository.findById(AGENT_ID)).thenReturn(Optional.empty());

        job.poll();

        assertEquals(BusinessEventFire.MetaStatus.unknown, fire.getMetaStatus());
        assertNotNull(fire.getTerminalAt());
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void backoffClimbsFromSecondsToADayAndStopsThere() {
        assertEquals(5, BusinessEventStatusPollJob.backoffSeconds((short) 0));
        assertEquals(15, BusinessEventStatusPollJob.backoffSeconds((short) 1));
        assertEquals(60, BusinessEventStatusPollJob.backoffSeconds((short) 2));
        assertEquals(300, BusinessEventStatusPollJob.backoffSeconds((short) 3));
        assertEquals(1800, BusinessEventStatusPollJob.backoffSeconds((short) 4));
        assertEquals(3600, BusinessEventStatusPollJob.backoffSeconds((short) 5));
        assertEquals(86400, BusinessEventStatusPollJob.backoffSeconds((short) 100));
    }

    private BusinessEventFire accepted() {
        return BusinessEventFire.builder()
                .id(11L)
                .accountId(ACCOUNT_ID)
                .agentId(AGENT_ID)
                .toPhone("+918500996740")
                .source(BusinessEventFire.Source.MANUAL)
                .requestEventType("order_shipped")
                .requestDescription("Your order shipped.")
                .requestPayload("{}")
                .outcome(BusinessEventFire.Outcome.ACCEPTED)
                .metaAgentEventId("evt-1")
                .metaStatus(null)
                .build();
    }

    private void givenDue(BusinessEventFire fire) {
        when(fireRepository.findDueForPoll(any(), anyShort(), any(), any(Pageable.class)))
                .thenReturn(List.of(fire));
    }
}
