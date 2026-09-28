package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The three-tier match, on the shapes production actually holds.
 *
 * <p>The ambiguous case is the one that matters most: two conversations ending
 * in the same ten digits must never resolve to one of them, because a wrong
 * pick announces a customer's private business to a stranger.
 */
class CustomerLookupTest {

    private static final Long AGENT_ID = 100L;
    private static final Long ACCOUNT_ID = 7L;
    private static final String CUSTOMER_BARE = "918500996740";

    private ConversationRepository conversationRepository;
    private CustomerLookup lookup;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(ConversationRepository.class);
        lookup = new CustomerLookup(conversationRepository);
        when(conversationRepository.findByAgentIdAndExternalId(anyLong(), anyString())).thenReturn(Optional.empty());
        when(conversationRepository.findAllByAgentIdAndAccountId(anyLong(), anyLong(), any(Pageable.class)))
                .thenReturn(List.of());
    }

    @Test
    void findsTheBareNumberProductionActuallyStores() {
        Conversation open = conversation(CUSTOMER_BARE);
        when(conversationRepository.findByAgentIdAndExternalId(AGENT_ID, CUSTOMER_BARE)).thenReturn(Optional.of(open));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertEquals(CustomerLookup.Result.FOUND, match.result());
        assertEquals(open.getId(), match.conversation().getId());
    }

    @Test
    void fallsBackToThePlusPrefixedFormWhenTheBareFormMisses() {
        Conversation open = conversation("+" + CUSTOMER_BARE);
        when(conversationRepository.findByAgentIdAndExternalId(AGENT_ID, "+" + CUSTOMER_BARE))
                .thenReturn(Optional.of(open));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertTrue(match.isFound());
        assertEquals(open.getId(), match.conversation().getId());
    }

    @Test
    void reachesTheCountryCodeLessRowsOnTheirLastTenDigits() {
        Conversation legacy = conversation("8500996740");
        givenScannedCandidates(legacy);

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertTrue(match.isFound());
        assertEquals(legacy.getId(), match.conversation().getId());
    }

    @Test
    void refusesToPickWhenTwoConversationsShareTheLastTenDigits() {
        givenScannedCandidates(conversation("8500996740"), conversation("448500996740"));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertEquals(CustomerLookup.Result.AMBIGUOUS, match.result());
        assertTrue(match.isAmbiguous());
        assertFalse(match.isFound());
        assertNull(match.conversation(), "an ambiguous match must never carry a guess");
    }

    @Test
    void aThirdCandidateIsStillAmbiguousAndStillCarriesNothing() {
        givenScannedCandidates(
                conversation("8500996740"),
                conversation("448500996740"),
                conversation("18500996740"));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertTrue(match.isAmbiguous());
        assertNull(match.conversation());
    }

    @Test
    void aBlankOrNullExternalIdNeverMatchesAndNeverThrows() {
        givenScannedCandidates(conversation(""), conversation(null), conversation("   "));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertEquals(CustomerLookup.Result.NONE, match.result());
        assertNull(match.conversation());
    }

    @Test
    void aBlankExternalIdAmongRealOnesDoesNotMakeAMatchAmbiguous() {
        Conversation legacy = conversation("8500996740");
        givenScannedCandidates(conversation(""), legacy, conversation(null));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertTrue(match.isFound());
        assertEquals(legacy.getId(), match.conversation().getId());
    }

    @Test
    void aNumberTooShortToHoldANationalNumberNeverScans() {
        givenScannedCandidates(conversation("8500996740"));

        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, "996740");

        assertEquals(CustomerLookup.Result.NONE, match.result());
    }

    @Test
    void noConversationsAtAllIsNoneRatherThanAmbiguous() {
        CustomerLookup.Match match = lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        assertEquals(CustomerLookup.Result.NONE, match.result());
        assertFalse(match.isAmbiguous());
    }

    @Test
    void theFallbackScanIsCappedSoOneFireCannotReadAWholeTenant() {
        lookup.find(AGENT_ID, ACCOUNT_ID, CUSTOMER_BARE);

        org.mockito.ArgumentCaptor<Pageable> page = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        org.mockito.Mockito.verify(conversationRepository)
                .findAllByAgentIdAndAccountId(eq(AGENT_ID), eq(ACCOUNT_ID), page.capture());
        assertEquals(500, page.getValue().getPageSize());
    }

    private void givenScannedCandidates(Conversation... candidates) {
        when(conversationRepository.findAllByAgentIdAndAccountId(eq(AGENT_ID), eq(ACCOUNT_ID), any(Pageable.class)))
                .thenReturn(List.of(candidates));
    }

    private Conversation conversation(String externalId) {
        Conversation conversation = new Conversation();
        conversation.setId(externalId == null ? 1L : (long) (externalId.hashCode() & 0x7fffffff) + 1L);
        conversation.setAgentId(AGENT_ID);
        conversation.setAccountId(ACCOUNT_ID);
        conversation.setExternalId(externalId);
        conversation.setStatus(Conversation.Status.open);
        return conversation;
    }
}
