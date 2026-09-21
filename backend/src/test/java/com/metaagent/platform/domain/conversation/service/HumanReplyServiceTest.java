package com.metaagent.platform.domain.conversation.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.service.AgentDeployService;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * A person answering a customer, and handing the thread back.
 *
 * The risk being tested is a message that reaches WhatsApp but not our database.
 * Meta's model has no "take control" call — sending IS taking control
 * (docs/meta-api/thread-control.md) — so the send is irreversible the moment it
 * succeeds. If persistence then fails, the customer has an answer the operator
 * cannot see they sent, and will send again.
 *
 * The release tests guard the opposite failure: clearing needsHuman before Meta
 * accepts the release would drop the conversation out of the operator's queue
 * while the agent is still not answering it — abandoned by both.
 */
class HumanReplyServiceTest {

    private static final Long ACCOUNT = 100L;
    private static final Long OTHER_ACCOUNT = 200L;
    private static final Long CONVERSATION = 55L;
    private static final Long AGENT = 7L;
    private static final String PHONE_NUMBER_ID = "674661285722401";
    private static final String CUSTOMER = "919010011634";

    private ConversationRepository conversationRepository;
    private AgentRepository agentRepository;
    private MetaMessageSender metaMessageSender;
    private ConversationStore conversationStore;
    private AgentDeployService agentDeployService;
    private HumanReplyService service;
    private MockedStatic<SecurityContextHelper> security;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(ConversationRepository.class);
        agentRepository = mock(AgentRepository.class);
        metaMessageSender = mock(MetaMessageSender.class);
        conversationStore = mock(ConversationStore.class);
        agentDeployService = mock(AgentDeployService.class);
        service = new HumanReplyService(
                conversationRepository, agentRepository, metaMessageSender,
                conversationStore, agentDeployService);

        security = mockStatic(SecurityContextHelper.class);
        security.when(SecurityContextHelper::getRequiredAccountId).thenReturn(ACCOUNT);
    }

    @AfterEach
    void tearDown() {
        security.close();
    }

    private Conversation conversation(Long accountId) {
        Conversation c = new Conversation();
        c.setId(CONVERSATION);
        c.setAccountId(accountId);
        c.setAgentId(AGENT);
        c.setExternalId(CUSTOMER);
        c.setNeedsHuman(true);
        return c;
    }

    private Agent agent(String phoneNumberId) {
        Agent a = new Agent();
        a.setId(AGENT);
        a.setPhoneNumberId(phoneNumberId);
        return a;
    }

    private void given(Conversation c, Agent a) {
        when(conversationRepository.findById(CONVERSATION)).thenReturn(Optional.of(c));
        when(agentRepository.findById(AGENT)).thenReturn(Optional.of(a));
    }

    @Test
    void sends_the_reply_to_the_customer_from_the_agents_number() {
        given(conversation(ACCOUNT), agent(PHONE_NUMBER_ID));
        when(metaMessageSender.send(any(), any(), any())).thenReturn("wamid.ABC");

        service.reply(CONVERSATION, "A person here — how can I help?");

        verify(metaMessageSender).send(PHONE_NUMBER_ID, CUSTOMER, "A person here — how can I help?");
    }

    @Test
    void persists_the_reply_against_the_conversation_with_metas_message_id() {
        given(conversation(ACCOUNT), agent(PHONE_NUMBER_ID));
        when(metaMessageSender.send(any(), any(), any())).thenReturn("wamid.ABC");

        service.reply(CONVERSATION, "hello");

        // webhookRawId is null: this did not arrive on a webhook. The echo Meta
        // sends back later carries the same id, and the store de-duplicates on it.
        verify(conversationStore).saveOutbound(
                ACCOUNT, CONVERSATION, AGENT, "wamid.ABC", "hello", null);
    }

    @Test
    void does_not_persist_anything_when_meta_refuses_the_send() {
        given(conversation(ACCOUNT), agent(PHONE_NUMBER_ID));
        when(metaMessageSender.send(any(), any(), any()))
                .thenThrow(new BusinessException("Failed to send WhatsApp message: 131047"));

        assertThrows(BusinessException.class, () -> service.reply(CONVERSATION, "hello"));

        verifyNoInteractions(conversationStore);
    }

    @Test
    void refuses_an_empty_reply_without_calling_meta() {
        assertThrows(BusinessException.class, () -> service.reply(CONVERSATION, "   "));
        verifyNoInteractions(metaMessageSender);
    }

    @Test
    void refuses_when_the_agent_has_no_phone_number_to_send_from() {
        given(conversation(ACCOUNT), agent(null));

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.reply(CONVERSATION, "hello"));

        assertTrue(e.getMessage().toLowerCase().contains("phone number"),
                "the operator should be told why, not given a 500: " + e.getMessage());
        verifyNoInteractions(metaMessageSender);
    }

    @Test
    void another_accounts_conversation_is_not_found_rather_than_forbidden() {
        when(conversationRepository.findById(CONVERSATION))
                .thenReturn(Optional.of(conversation(OTHER_ACCOUNT)));

        // "Not found", not "forbidden": whether this conversation exists is not
        // something another account is entitled to learn.
        assertThrows(NotFoundException.class, () -> service.reply(CONVERSATION, "hello"));
        verifyNoInteractions(metaMessageSender);
    }

    @Test
    void replying_leaves_the_conversation_owned_by_the_human() {
        Conversation c = conversation(ACCOUNT);
        given(c, agent(PHONE_NUMBER_ID));
        when(metaMessageSender.send(any(), any(), any())).thenReturn("wamid.ABC");

        service.reply(CONVERSATION, "hello");

        // needsHuman means "a person owns this thread", not "nobody has typed
        // yet". Clearing it here would drop the thread out of the queue while
        // the customer is still mid-exchange with that person.
        assertTrue(c.isNeedsHuman());
    }

    @Test
    void release_hands_control_back_for_this_customer_and_clears_the_flag() {
        Conversation c = conversation(ACCOUNT);
        when(conversationRepository.findById(CONVERSATION)).thenReturn(Optional.of(c));

        service.release(CONVERSATION);

        verify(agentDeployService).releaseThreadControl(AGENT, CUSTOMER);
        assertFalse(c.isNeedsHuman());
        verify(conversationRepository).save(c);
    }

    @Test
    void a_failed_release_leaves_the_conversation_owned_by_the_human() {
        Conversation c = conversation(ACCOUNT);
        when(conversationRepository.findById(CONVERSATION)).thenReturn(Optional.of(c));
        doThrow(new BusinessException("Meta refused the release"))
                .when(agentDeployService).releaseThreadControl(any(), any());

        assertThrows(BusinessException.class, () -> service.release(CONVERSATION));

        // Otherwise it leaves the queue while the agent is still not answering:
        // abandoned by the person and by the agent at once.
        assertTrue(c.isNeedsHuman());
        verify(conversationRepository, never()).save(any());
    }
}
