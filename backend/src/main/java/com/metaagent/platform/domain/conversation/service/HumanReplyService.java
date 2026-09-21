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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lets a person answer a customer, and hand the thread back to Meta's agent.
 *
 * The control model is Meta's, not ours (docs/meta-api/thread-control.md):
 * **sending a message IS taking control** — there is no "take" call to make.
 * Handing back is the only explicit step, and until it happens the agent stays
 * silent on this conversation. So a reply here is not just a message: it is the
 * act that stops the agent answering, which is why it is worth its own service
 * rather than a method on the message store.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HumanReplyService {

    private final ConversationRepository conversationRepository;
    private final AgentRepository agentRepository;
    private final MetaMessageSender metaMessageSender;
    private final ConversationStore conversationStore;
    private final AgentDeployService agentDeployService;

    /**
     * Send a person's reply to the customer on this conversation.
     *
     * `needsHuman` is deliberately left set: it means "a person owns this
     * thread", not "a person has not typed yet". Clearing it on the first reply
     * would drop the conversation out of the operator's queue while the customer
     * is still mid-exchange with them. It clears on release, which is the moment
     * the agent takes over again.
     */
    @Transactional
    public Message reply(Long conversationId, String text) {
        if (text == null || text.isBlank()) {
            throw new BusinessException("A reply cannot be empty.");
        }

        Conversation conversation = loadOwned(conversationId);
        Agent agent = agentRepository.findById(conversation.getAgentId())
                .orElseThrow(() -> new NotFoundException("Agent not found for this conversation"));

        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException(
                    "This agent has no phone number, so nothing can be sent from it.");
        }

        // The customer's number. Meta accepts the same value it gave us.
        String recipient = conversation.getExternalId();

        String metaMessageId = metaMessageSender.send(
                agent.getPhoneNumberId(), recipient, text);

        // webhookRawId is null: this message did not arrive on a webhook, it
        // originated here. The echo Meta sends back later carries the same
        // metaMessageId, and ConversationStore de-duplicates on it.
        Message saved = conversationStore.saveOutbound(
                conversation.getAccountId(), conversation.getId(), agent.getId(),
                metaMessageId, text, null);

        log.info("Human replied: conversationId={} agentId={} metaMessageId={}",
                conversation.getId(), agent.getId(), metaMessageId);

        return saved;
    }

    /**
     * Hand the conversation back to Meta's agent.
     *
     * Per Meta, the agent resumes for NEW messages only — it will not answer
     * anything already sitting in the thread. The flag is cleared only after
     * Meta accepts the release, so a failed release leaves the conversation
     * visibly owned by a human rather than silently abandoned by both.
     */
    @Transactional
    public void release(Long conversationId) {
        Conversation conversation = loadOwned(conversationId);

        agentDeployService.releaseThreadControl(
                conversation.getAgentId(), conversation.getExternalId());

        conversation.setNeedsHuman(false);
        conversationRepository.save(conversation);

        log.info("Thread handed back to the agent: conversationId={} agentId={}",
                conversation.getId(), conversation.getAgentId());
    }

    /** Scoped by account, like every other read on this domain. */
    private Conversation loadOwned(Long conversationId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!accountId.equals(conversation.getAccountId())) {
            // Same message as a genuine miss: whether this conversation exists
            // is not something another account is entitled to learn.
            throw new NotFoundException("Conversation not found");
        }
        return conversation;
    }
}
