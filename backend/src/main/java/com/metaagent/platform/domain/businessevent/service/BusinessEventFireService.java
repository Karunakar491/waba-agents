package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * The one entry point for making an agent announce something to a customer.
 *
 * <p>Every source — the manual button, the inbound API, a connector watch —
 * comes through {@link #fire(FireCommand)}. There is no second path to
 * {@code /agent_event}, because a second path would be a second place where the
 * refusals below could be forgotten, and a forgotten refusal is a real WhatsApp
 * message sent to a real person who should not have received it.
 *
 * <p><b>Deliberately NOT {@code @Transactional}.</b> A Meta call cannot be
 * rolled back: once the announcement is accepted, a customer may already have
 * been messaged. If this method were transactional, a later failure would roll
 * back the ledger row and we would have sent something we have no record of.
 * Same discipline, and the same reason, as
 * {@code ConnectorService.deploy()} — the row must survive the failure.
 *
 * <p><b>Meta's two hard limits, measured rather than assumed:</b> an event
 * cannot start a conversation (the customer must have written in first), and if
 * a human has taken the thread our app holds control and the agent is silent on
 * it. Thread-control release is currently rejected by Meta, so that second state
 * is permanent for the life of the conversation. Both are refusals here, before
 * Meta is called, so the operator gets a reason instead of a silent nothing.
 *
 * <p>Three collaborators carry the parts that stand alone:
 * {@link CustomerLookup} finds whose conversation this is,
 * {@link FireRequestLimits} judges the request against Meta's contract, and
 * {@link MetaErrorMapper} turns Meta's answer into ledger columns.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BusinessEventFireService {

    private static final int MAX_REFUSAL_DETAIL = 512;
    private static final int MAX_TO_PHONE = 32;

    private final BusinessEventFireRepository fireRepository;
    private final CustomerLookup customerLookup;
    private final AgentAccessService agentAccessService;
    private final AgentEventClient agentEventClient;

    /**
     * Kill switch. False routes the caller back to the pre-ledger direct Meta
     * call in {@code AgentDeployService}, which is the one-command rollback for
     * this whole feature.
     */
    @Value("${business-events.ledger.enabled:true}")
    private boolean ledgerEnabled;

    public boolean isLedgerEnabled() {
        return ledgerEnabled;
    }

    /**
     * One announcement attempt. {@code payload} is Meta's opaque JSON string —
     * we never parse it, only measure it.
     */
    public record FireCommand(Long agentId,
                              Long accountId,
                              BusinessEventFire.Source source,
                              String toPhoneRaw,
                              String eventType,
                              String description,
                              String payload,
                              String idempotencyKey,
                              Long firedBy) {
    }

    /**
     * Fires, or records why it would not. Always returns a persisted row —
     * a refusal is a row, not an exception, because "we tried and would not send
     * it, here is why" is the only answer a support lead can give a customer.
     */
    public BusinessEventFire fire(FireCommand command) {
        Optional<BusinessEventFire> alreadyFired = findReplay(command);
        if (alreadyFired.isPresent()) {
            return alreadyFired.get();
        }

        Agent agent = agentAccessService.getAccessible(command.agentId(), command.accountId());
        String toDigits = PhoneKey.normalize(command.toPhoneRaw());

        BusinessEventFire fire = newRow(command, toDigits);

        BusinessEventFire refusal = preflight(fire, agent, command, toDigits);
        if (refusal != null) {
            return save(refusal);
        }

        BusinessEventFire saved = save(fire);
        if (saved != fire) {
            // We lost the unique-index race: a concurrent retry with the same
            // idempotency key already inserted, and already fired. Return its
            // row rather than announcing the same thing to the customer twice.
            return saved;
        }
        return callMeta(fire, agent, toDigits);
    }

    // -------------------------------------------------------------------------
    // Idempotency
    // -------------------------------------------------------------------------

    /**
     * A duplicate here is a duplicate WhatsApp message to a real person, so the
     * stored row wins over firing again. Checked before anything else, including
     * the access check — a replay of a fire we already made is answered from our
     * own ledger.
     */
    private Optional<BusinessEventFire> findReplay(FireCommand command) {
        if (command.idempotencyKey() == null || command.idempotencyKey().isBlank()) {
            return Optional.empty();
        }
        return fireRepository.findByAgentIdAndIdempotencyKey(command.agentId(), command.idempotencyKey());
    }

    /**
     * The unique index on (agent_id, idempotency_key) is the real guard: two
     * concurrent retries both pass {@link #findReplay} and one loses the insert.
     * The loser re-reads rather than failing, so the caller still gets the row
     * that was actually fired.
     */
    private BusinessEventFire save(BusinessEventFire fire) {
        try {
            return fireRepository.save(fire);
        } catch (DataIntegrityViolationException e) {
            if (fire.getIdempotencyKey() == null) {
                throw e;
            }
            return fireRepository.findByAgentIdAndIdempotencyKey(fire.getAgentId(), fire.getIdempotencyKey())
                    .orElseThrow(() -> e);
        }
    }

    /** Request fields are stored truncated to their column widths — see {@link FireRequestLimits}. */
    private BusinessEventFire newRow(FireCommand command, String toDigits) {
        return BusinessEventFire.builder()
                .accountId(command.accountId())
                .agentId(command.agentId())
                .toPhone(truncate(PhoneKey.toE164(toDigits), MAX_TO_PHONE))
                .source(command.source())
                .firedBy(command.firedBy())
                .idempotencyKey(blankToNull(command.idempotencyKey()))
                .requestEventType(truncate(nullToEmpty(command.eventType()), FireRequestLimits.MAX_EVENT_TYPE))
                .requestDescription(truncate(nullToEmpty(command.description()), FireRequestLimits.MAX_DESCRIPTION))
                .requestPayload(truncate(nullToEmpty(command.payload()), FireRequestLimits.MAX_PAYLOAD))
                .outcome(BusinessEventFire.Outcome.ACCEPTED)
                .build();
    }

    // -------------------------------------------------------------------------
    // Pre-flight — every reason we will not call Meta, in order.
    // Returns the refusal row, or null to proceed.
    // -------------------------------------------------------------------------

    private BusinessEventFire preflight(BusinessEventFire fire, Agent agent, FireCommand command, String toDigits) {
        if (agent.getPhoneNumberId() == null) {
            return refuse(fire, BusinessEventFire.RefusalReason.AGENT_NOT_DEPLOYED,
                    "This agent has no WhatsApp number connected yet, so there is nothing to announce from. Connect a number and deploy the agent first.");
        }

        if (agent.getStatus() != Agent.Status.active) {
            return refuse(fire, BusinessEventFire.RefusalReason.AGENT_PAUSED, pausedDetail(agent));
        }

        FireRequestLimits.Violation violation =
                FireRequestLimits.check(command.eventType(), command.description(), command.payload());
        if (violation != null) {
            BusinessEventFire.RefusalReason reason = violation.anyFieldTooLong()
                    ? BusinessEventFire.RefusalReason.PAYLOAD_TOO_LARGE
                    : BusinessEventFire.RefusalReason.VALIDATION;
            return refuse(fire, reason, violation.message());
        }

        if (!PhoneKey.isSendable(toDigits)) {
            return refuse(fire, BusinessEventFire.RefusalReason.VALIDATION,
                    "That customer number has no country code, and we will never guess one — guessing would announce this to a stranger in another country. Store the full international number and try again.");
        }

        CustomerLookup.Match match = customerLookup.find(command.agentId(), command.accountId(), toDigits);
        if (match.isAmbiguous()) {
            return refuse(fire, BusinessEventFire.RefusalReason.AMBIGUOUS_CUSTOMER,
                    "More than one conversation on this agent could be this customer, and we will not pick one — picking wrong messages the wrong person. Store full international numbers for these customers.");
        }
        if (!match.isFound()) {
            return refuse(fire, BusinessEventFire.RefusalReason.NO_CONVERSATION,
                    "This customer has never messaged this agent. WhatsApp only lets an agent announce something inside a conversation the customer opened, so there is nothing to announce into.");
        }

        Conversation conversation = match.conversation();
        fire.setConversationId(conversation.getId());

        if (conversation.getStatus() == Conversation.Status.closed) {
            return refuse(fire, BusinessEventFire.RefusalReason.CONVERSATION_CLOSED,
                    "This customer's conversation is closed. Reopen it, or wait for the customer to message again, before announcing anything.");
        }

        if (conversation.isNeedsHuman()) {
            return refuse(fire, BusinessEventFire.RefusalReason.HUMAN_HOLDS_THREAD,
                    "A person is handling this conversation, so the agent is silent on it until control is released — and Meta currently rejects every release request, so that stays true for the life of this conversation. The announcement would be swallowed with no delivery and no error, so we do not send it.");
        }

        return null;
    }

    /** Paused is the one recoverable status, so it gets its own sentence rather than a generic "not active". */
    private String pausedDetail(Agent agent) {
        if (agent.getStatus() == Agent.Status.paused) {
            return "This agent is paused, so it is not talking to anyone right now. Resume it and fire this again — nothing else is wrong.";
        }
        return "This agent is not live (status: " + agent.getStatus() + "), so it cannot announce anything. Deploy it first.";
    }

    private BusinessEventFire refuse(BusinessEventFire fire, BusinessEventFire.RefusalReason reason, String detail) {
        fire.setOutcome(BusinessEventFire.Outcome.REFUSED);
        fire.setRefusalReason(reason);
        fire.setRefusalDetail(truncate(detail, MAX_REFUSAL_DETAIL));
        return fire;
    }

    // -------------------------------------------------------------------------
    // The Meta call, and recording what it said.
    // -------------------------------------------------------------------------

    private BusinessEventFire callMeta(BusinessEventFire fire, Agent agent, String toDigits) {
        try {
            AgentEventClient.SendResponse response = agentEventClient.send(
                    agent.getPhoneNumberId(),
                    PhoneKey.toE164(toDigits),
                    fire.getRequestEventType(),
                    fire.getRequestDescription(),
                    fire.getRequestPayload());

            fire.setOutcome(BusinessEventFire.Outcome.ACCEPTED);
            fire.setMetaHttpStatus(200);
            fire.setMetaAgentEventId(response == null ? null : response.agentEventId());
            fire.setMetaStatus(BusinessEventFire.MetaStatus.request_received);
        } catch (MetaApiException e) {
            recordFailure(fire, MetaErrorMapper.fromRejection(e));
            log.warn("Business event fire rejected by Meta: agentId={} status={} title={}",
                    fire.getAgentId(), e.getStatusCode(), fire.getMetaErrorTitle());
        } catch (Exception e) {
            recordFailure(fire, MetaErrorMapper.fromTransportFailure(e));
            log.warn("Business event fire failed before Meta answered: fireId={} agentId={} error={}",
                    fire.getId(), fire.getAgentId(), e.toString());
        }
        // Saved on every path, including both failure paths — the row is the
        // point, and losing it would leave an operator with no trace at all.
        return save(fire);
    }

    private void recordFailure(BusinessEventFire fire, MetaErrorMapper.LedgerError error) {
        fire.setOutcome(BusinessEventFire.Outcome.FAILED);
        fire.setMetaHttpStatus(error.httpStatus());
        fire.setMetaErrorTitle(error.title());
        fire.setMetaErrorDetail(error.detail());
        fire.setMetaErrorType(error.type());
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
