package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Finds the conversation a customer's phone number belongs to, on one agent.
 *
 * <p>The highest-risk logic in business events, because the cost of getting it
 * wrong is a customer's private business announced to a stranger.
 *
 * <p>{@code Conversation.externalId} is whatever the webhook's raw {@code from}
 * field held, stored unchanged. Measured against production across all 48 rows
 * on <b>2026-09-25</b>: every row is BARE (no leading {@code "+"}), 44 are 12
 * digits, 3 are 10 digits with no country code at all, and 1 is an empty
 * string. So one exact lookup is not enough, and three tiers are needed:
 *
 * <ol>
 *   <li>the bare digits, which is what production actually stores;</li>
 *   <li>the {@code "+"}-prefixed form, in case a future webhook change starts
 *       storing E.164;</li>
 *   <li>the last 10 digits, which is the only way to reach the three
 *       country-code-less rows — and is allowed <b>only when it is unique</b>.</li>
 * </ol>
 *
 * <p>Tier three never picks between candidates. Two conversations ending in the
 * same ten digits produce {@link Result#AMBIGUOUS}, and the caller refuses:
 * picking one announces a customer's private business to the wrong person, a
 * silent and unrecoverable wrong. A refusal is visible and fixable; a mis-sent
 * WhatsApp message is neither.
 */
@Component
@RequiredArgsConstructor
public class CustomerLookup {

    /**
     * How many of an agent's conversations the last-10-digit fallback will scan.
     * Well above the 48 rows production holds today, and a hard stop so a large
     * tenant cannot turn one fire into an unbounded read.
     */
    private static final int SCAN_LIMIT = 500;

    private static final int NATIONAL_NUMBER_DIGITS = 10;

    private final ConversationRepository conversationRepository;

    /** Ambiguity is a distinct answer from "no match" — it refuses, it does not fall through. */
    public enum Result {
        FOUND,
        NONE,
        AMBIGUOUS
    }

    public record Match(Result result, Conversation conversation) {

        static Match found(Conversation conversation) {
            return new Match(Result.FOUND, conversation);
        }

        static Match none() {
            return new Match(Result.NONE, null);
        }

        static Match ambiguous() {
            return new Match(Result.AMBIGUOUS, null);
        }

        public boolean isFound() {
            return result == Result.FOUND;
        }

        public boolean isAmbiguous() {
            return result == Result.AMBIGUOUS;
        }
    }

    /** {@code toDigits} is a {@link PhoneKey#normalize} result: digits only, never null. */
    public Match find(Long agentId, Long accountId, String toDigits) {
        Optional<Conversation> exact = conversationRepository.findByAgentIdAndExternalId(agentId, toDigits);
        if (exact.isPresent()) {
            return Match.found(exact.get());
        }

        // Historic rows are all bare today, but nothing enforces that, and a
        // future webhook change could start storing "+91...". Cheap to check.
        Optional<Conversation> plusPrefixed =
                conversationRepository.findByAgentIdAndExternalId(agentId, PhoneKey.toE164(toDigits));
        if (plusPrefixed.isPresent()) {
            return Match.found(plusPrefixed.get());
        }

        return matchOnLastTenDigits(agentId, accountId, toDigits);
    }

    private Match matchOnLastTenDigits(Long agentId, Long accountId, String toDigits) {
        String suffix = lastTen(toDigits);
        if (suffix == null) {
            return Match.none();
        }

        List<Conversation> candidates = conversationRepository.findAllByAgentIdAndAccountId(
                agentId, accountId, PageRequest.of(0, SCAN_LIMIT));

        Conversation found = null;
        for (Conversation candidate : candidates) {
            // An externalId that is blank — production has one — can never match
            // anything, and lastTen returns null for it rather than throwing.
            String candidateSuffix = lastTen(PhoneKey.normalize(candidate.getExternalId()));
            if (candidateSuffix == null || !candidateSuffix.equals(suffix)) {
                continue;
            }
            if (found != null) {
                return Match.ambiguous();
            }
            found = candidate;
        }
        return found == null ? Match.none() : Match.found(found);
    }

    /** Null for anything too short to have a national number in it, including blank. */
    private static String lastTen(String digits) {
        if (digits == null || digits.length() < NATIONAL_NUMBER_DIGITS) {
            return null;
        }
        return digits.substring(digits.length() - NATIONAL_NUMBER_DIGITS);
    }
}
