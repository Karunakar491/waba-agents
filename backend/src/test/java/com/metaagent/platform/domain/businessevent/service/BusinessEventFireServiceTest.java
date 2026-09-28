package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Every reason we refuse to announce something, and every way the announcement
 * itself can go wrong.
 *
 * <p>The refusals are the point of these tests. Each one is a real WhatsApp
 * message that would either not arrive or arrive at the wrong person, and the
 * ambiguous-customer case is the worst of them: two conversations ending in the
 * same ten digits must produce a refusal, never a guess.
 */
class BusinessEventFireServiceTest {

    private static final Long AGENT_ID = 100L;
    private static final Long ACCOUNT_ID = 7L;
    private static final String PHONE_NUMBER_ID = "pn-1";
    private static final String CUSTOMER = "+91 85009 96740";
    private static final String CUSTOMER_BARE = "918500996740";

    private BusinessEventFireRepository fireRepository;
    private ConversationRepository conversationRepository;
    private AgentAccessService agentAccessService;
    private AgentEventClient agentEventClient;
    private BusinessEventFireService service;

    @BeforeEach
    void setUp() {
        fireRepository = mock(BusinessEventFireRepository.class);
        conversationRepository = mock(ConversationRepository.class);
        agentAccessService = mock(AgentAccessService.class);
        agentEventClient = mock(AgentEventClient.class);
        // The real CustomerLookup over the mocked repository: these tests assert
        // on the three-tier match as the service actually experiences it.
        service = new BusinessEventFireService(
                fireRepository, new CustomerLookup(conversationRepository), agentAccessService, agentEventClient);
        ReflectionTestUtils.setField(service, "ledgerEnabled", true);

        // The repository is a mock, so save() returns what it was given — these
        // tests assert on the row we built, which is what the caller receives.
        when(fireRepository.save(any(BusinessEventFire.class))).thenAnswer(i -> i.getArgument(0));
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(activeAgent());
        when(conversationRepository.findAllByAgentIdAndAccountId(anyLong(), anyLong(), any(Pageable.class)))
                .thenReturn(List.of());
    }

    // ---------------------------------------------------------------- refusals

    @Test
    void refusesWhenAgentHasNoPhoneNumber() {
        Agent agent = activeAgent();
        agent.setPhoneNumberId(null);
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.AGENT_NOT_DEPLOYED);
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void refusesPausedAgentWithItsOwnRecoverableWording() {
        Agent agent = activeAgent();
        agent.setStatus(Agent.Status.paused);
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.AGENT_PAUSED);
        assertTrue(fire.getRefusalDetail().contains("Resume it"), fire.getRefusalDetail());
    }

    @Test
    void refusesDraftAgentAsPausedWithoutTheResumeWording() {
        Agent agent = activeAgent();
        agent.setStatus(Agent.Status.draft);
        when(agentAccessService.getAccessible(AGENT_ID, ACCOUNT_ID)).thenReturn(agent);

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.AGENT_PAUSED);
        assertFalse(fire.getRefusalDetail().contains("Resume it"));
    }

    @Test
    void refusesWhenTheCustomerNeverMessagedThisAgent() {
        givenNoConversations();

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.NO_CONVERSATION);
        assertNull(fire.getConversationId());
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void refusesWhenTheConversationIsClosed() {
        Conversation closed = conversation(CUSTOMER_BARE, Conversation.Status.closed, false);
        givenExactConversation(closed);

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.CONVERSATION_CLOSED);
        assertEquals(closed.getId(), fire.getConversationId());
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void refusesWhenAHumanHoldsTheThreadAndSaysWhyItIsPermanent() {
        givenExactConversation(conversation(CUSTOMER_BARE, Conversation.Status.open, true));

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.HUMAN_HOLDS_THREAD);
        assertTrue(fire.getRefusalDetail().contains("rejects every release"), fire.getRefusalDetail());
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void refusesANumberWithNoCountryCodeRatherThanGuessingOne() {
        BusinessEventFire fire = service.fire(command("8500996740"));

        assertRefused(fire, BusinessEventFire.RefusalReason.VALIDATION);
        assertTrue(fire.getRefusalDetail().contains("country code"), fire.getRefusalDetail());
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void refusesABlankEventType() {
        BusinessEventFire fire = service.fire(new BusinessEventFireService.FireCommand(
                AGENT_ID, ACCOUNT_ID, BusinessEventFire.Source.MANUAL, CUSTOMER,
                "  ", "Your order shipped.", "{}", null, null));

        assertRefused(fire, BusinessEventFire.RefusalReason.VALIDATION);
    }

    @Test
    void refusesAnOversizedPayloadAndNamesTheField() {
        String payload = "x".repeat(4097);

        BusinessEventFire fire = service.fire(new BusinessEventFireService.FireCommand(
                AGENT_ID, ACCOUNT_ID, BusinessEventFire.Source.MANUAL, CUSTOMER,
                "order_shipped", "Your order shipped.", payload, null, null));

        assertRefused(fire, BusinessEventFire.RefusalReason.PAYLOAD_TOO_LARGE);
        assertTrue(fire.getRefusalDetail().contains("payload"), fire.getRefusalDetail());
        // The stored copy must fit the column, or the refusal row itself is lost.
        assertEquals(4096, fire.getRequestPayload().length());
    }

    @Test
    void refusesAnOversizedEventTypeAsTooLargeNamingTheType() {
        BusinessEventFire fire = service.fire(new BusinessEventFireService.FireCommand(
                AGENT_ID, ACCOUNT_ID, BusinessEventFire.Source.MANUAL, CUSTOMER,
                "t".repeat(257), "Your order shipped.", "{}", null, null));

        assertRefused(fire, BusinessEventFire.RefusalReason.PAYLOAD_TOO_LARGE);
        assertTrue(fire.getRefusalDetail().contains("event type"), fire.getRefusalDetail());
    }

    // --------------------------------------------------- the three-way lookup

    @Test
    void findsTheConversationOnTheBareNumberProductionActuallyStores() {
        Conversation open = conversation(CUSTOMER_BARE, Conversation.Status.open, false);
        givenExactConversation(open);
        givenMetaAccepts("evt-1");

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.ACCEPTED, fire.getOutcome());
        assertEquals(open.getId(), fire.getConversationId());
    }

    @Test
    void fallsBackToThePlusPrefixedFormWhenTheBareFormMisses() {
        Conversation open = conversation("+" + CUSTOMER_BARE, Conversation.Status.open, false);
        when(conversationRepository.findByAgentIdAndExternalId(AGENT_ID, CUSTOMER_BARE)).thenReturn(Optional.empty());
        when(conversationRepository.findByAgentIdAndExternalId(AGENT_ID, "+" + CUSTOMER_BARE)).thenReturn(Optional.of(open));
        givenMetaAccepts("evt-2");

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.ACCEPTED, fire.getOutcome());
        assertEquals(open.getId(), fire.getConversationId());
    }

    @Test
    void fallsBackToTheLastTenDigitsForTheCountryCodeLessProductionRows() {
        givenNoConversations();
        Conversation legacy = conversation("8500996740", Conversation.Status.open, false);
        when(conversationRepository.findAllByAgentIdAndAccountId(eq(AGENT_ID), eq(ACCOUNT_ID), any(Pageable.class)))
                .thenReturn(List.of(legacy));
        givenMetaAccepts("evt-3");

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.ACCEPTED, fire.getOutcome());
        assertEquals(legacy.getId(), fire.getConversationId());
    }

    @Test
    void refusesRatherThanGuessingWhenTwoConversationsShareTheLastTenDigits() {
        givenNoConversations();
        when(conversationRepository.findAllByAgentIdAndAccountId(eq(AGENT_ID), eq(ACCOUNT_ID), any(Pageable.class)))
                .thenReturn(List.of(
                        conversation("8500996740", Conversation.Status.open, false),
                        conversation("448500996740", Conversation.Status.open, false)));

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.AMBIGUOUS_CUSTOMER);
        verifyNoInteractions(agentEventClient);
    }

    @Test
    void aBlankExternalIdNeverMatchesAndNeverThrows() {
        givenNoConversations();
        when(conversationRepository.findAllByAgentIdAndAccountId(eq(AGENT_ID), eq(ACCOUNT_ID), any(Pageable.class)))
                .thenReturn(List.of(
                        conversation("", Conversation.Status.open, false),
                        conversation(null, Conversation.Status.open, false)));

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertRefused(fire, BusinessEventFire.RefusalReason.NO_CONVERSATION);
    }

    // -------------------------------------------------------------- idempotency

    @Test
    void replaysTheStoredRowRatherThanMessagingTheCustomerTwice() {
        BusinessEventFire stored = BusinessEventFire.builder()
                .id(999L)
                .outcome(BusinessEventFire.Outcome.ACCEPTED)
                .metaAgentEventId("evt-already")
                .build();
        when(fireRepository.findByAgentIdAndIdempotencyKey(AGENT_ID, "key-1")).thenReturn(Optional.of(stored));

        BusinessEventFire fire = service.fire(new BusinessEventFireService.FireCommand(
                AGENT_ID, ACCOUNT_ID, BusinessEventFire.Source.INBOUND_API, CUSTOMER,
                "order_shipped", "Your order shipped.", "{}", "key-1", null));

        assertSame(stored, fire);
        verifyNoInteractions(agentEventClient);
        verify(fireRepository, never()).save(any());
    }

    @Test
    void losingTheUniqueIndexRaceRereadsInsteadOfFailing() {
        givenExactConversation(conversation(CUSTOMER_BARE, Conversation.Status.open, false));
        BusinessEventFire winner = BusinessEventFire.builder().id(888L)
                .outcome(BusinessEventFire.Outcome.ACCEPTED).build();
        when(fireRepository.findByAgentIdAndIdempotencyKey(AGENT_ID, "key-2"))
                .thenReturn(Optional.empty())          // the pre-flight check
                .thenReturn(Optional.of(winner));      // the post-collision re-read
        when(fireRepository.save(any(BusinessEventFire.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("uq_fire_idem"));

        BusinessEventFire fire = service.fire(new BusinessEventFireService.FireCommand(
                AGENT_ID, ACCOUNT_ID, BusinessEventFire.Source.INBOUND_API, CUSTOMER,
                "order_shipped", "Your order shipped.", "{}", "key-2", null));

        assertSame(winner, fire);
        verifyNoInteractions(agentEventClient);
    }

    // ------------------------------------------------------- the Meta outcome

    @Test
    void recordsAnAcceptedFireWithMetaSIdAndStartingStatus() {
        givenExactConversation(conversation(CUSTOMER_BARE, Conversation.Status.open, false));
        givenMetaAccepts("evt-9");

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.ACCEPTED, fire.getOutcome());
        assertEquals("evt-9", fire.getMetaAgentEventId());
        assertEquals(BusinessEventFire.MetaStatus.request_received, fire.getMetaStatus());
        assertEquals(200, fire.getMetaHttpStatus().intValue());
        verify(agentEventClient).send(eq(PHONE_NUMBER_ID), eq("+" + CUSTOMER_BARE), anyString(), anyString(), anyString());
    }

    @Test
    void decomposesMetaSStandardErrorIntoItsOwnColumns() {
        givenExactConversation(conversation(CUSTOMER_BARE, Conversation.Status.open, false));
        when(agentEventClient.send(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new MetaApiException(400,
                        "{\"title\":\"Invalid parameter\",\"detail\":\"event.type is required\",\"type\":\"OAuthException\",\"status\":400}"));

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.FAILED, fire.getOutcome());
        assertEquals(400, fire.getMetaHttpStatus().intValue());
        assertEquals("Invalid parameter", fire.getMetaErrorTitle());
        assertEquals("event.type is required", fire.getMetaErrorDetail());
        assertEquals("OAuthException", fire.getMetaErrorType());
    }

    @Test
    void keepsAnUnparseableMetaBodyRatherThanSwallowingIt() {
        givenExactConversation(conversation(CUSTOMER_BARE, Conversation.Status.open, false));
        when(agentEventClient.send(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new MetaApiException(503, "<html>upstream is down</html>"));

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.FAILED, fire.getOutcome());
        assertEquals(503, fire.getMetaHttpStatus().intValue());
        assertEquals("<html>upstream is down</html>", fire.getMetaErrorDetail());
    }

    @Test
    void aTransportFailureIsRecordedAsFiveOhTwoAndNeverEscapes() {
        givenExactConversation(conversation(CUSTOMER_BARE, Conversation.Status.open, false));
        when(agentEventClient.send(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new IllegalStateException("connection reset"));

        BusinessEventFire fire = service.fire(command(CUSTOMER));

        assertEquals(BusinessEventFire.Outcome.FAILED, fire.getOutcome());
        assertEquals(502, fire.getMetaHttpStatus().intValue());
        assertTrue(fire.getMetaErrorDetail().contains("connection reset"));
    }

    // -------------------------------------------------------------- fixtures

    private BusinessEventFireService.FireCommand command(String to) {
        return new BusinessEventFireService.FireCommand(
                AGENT_ID, ACCOUNT_ID, BusinessEventFire.Source.MANUAL, to,
                "order_shipped", "Your order shipped.", "{\"order\":\"A1\"}", null, 55L);
    }

    private Agent activeAgent() {
        Agent agent = new Agent();
        agent.setId(AGENT_ID);
        agent.setAccountId(ACCOUNT_ID);
        agent.setPhoneNumberId(PHONE_NUMBER_ID);
        agent.setStatus(Agent.Status.active);
        return agent;
    }

    private Conversation conversation(String externalId, Conversation.Status status, boolean needsHuman) {
        Conversation conversation = new Conversation();
        conversation.setId(externalId == null ? 1L : (long) (externalId.hashCode() & 0x7fffffff) + 1L);
        conversation.setAgentId(AGENT_ID);
        conversation.setAccountId(ACCOUNT_ID);
        conversation.setExternalId(externalId);
        conversation.setStatus(status);
        conversation.setNeedsHuman(needsHuman);
        return conversation;
    }

    private void givenExactConversation(Conversation conversation) {
        when(conversationRepository.findByAgentIdAndExternalId(AGENT_ID, CUSTOMER_BARE))
                .thenReturn(Optional.of(conversation));
    }

    private void givenNoConversations() {
        when(conversationRepository.findByAgentIdAndExternalId(anyLong(), anyString())).thenReturn(Optional.empty());
    }

    private void givenMetaAccepts(String eventId) {
        when(agentEventClient.send(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new AgentEventClient.SendResponse("accepted", eventId));
    }

    private void assertRefused(BusinessEventFire fire, BusinessEventFire.RefusalReason reason) {
        assertEquals(BusinessEventFire.Outcome.REFUSED, fire.getOutcome());
        assertEquals(reason, fire.getRefusalReason());
        assertNotNull(fire.getRefusalDetail());
        assertNull(fire.getMetaAgentEventId());
    }
}
