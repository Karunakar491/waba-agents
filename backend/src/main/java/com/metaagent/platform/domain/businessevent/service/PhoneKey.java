package com.metaagent.platform.domain.businessevent.service;

/**
 * The one place a customer's phone number is normalised.
 *
 * <p><b>Read this before assuming {@code Conversation.externalId} is E.164. It
 * is not.</b> {@code externalId} is whatever the webhook's raw {@code from}
 * field contained, stored unchanged.
 *
 * <p>Measured against production on <b>2026-09-25</b>, across all 48
 * conversation rows then in the table:
 * <ul>
 *   <li>All 48 store the number <b>bare</b>, e.g. {@code 918500996740}.
 *       <b>None</b> has a leading {@code +}.</li>
 *   <li>44 rows are 12 characters — country code plus a 10-digit number.</li>
 *   <li><b>3 rows are 10 characters: no country code at all.</b></li>
 *   <li>1 row is an <b>empty string</b>.</li>
 * </ul>
 *
 * <p>Meta's {@code agent_event.to} field wants E.164, so something has to bridge
 * the two, and that something is this class rather than a {@code "+" + x}
 * scattered through the callers.
 *
 * <p>The 10-digit rows are why {@link #isSendable(String)} exists. A number with
 * no country code cannot be made into E.164 without inventing the country, and
 * inventing it would announce a customer's order status to a stranger in
 * another country. We refuse instead; the fire is recorded as a refusal and a
 * human can look at it.
 */
public final class PhoneKey {

    /** Anything below this cannot carry a country code plus a national number. */
    private static final int MIN_SENDABLE_DIGITS = 11;

    private PhoneKey() {
    }

    /**
     * Reduces a raw number to digits only: strips {@code +}, spaces, hyphens,
     * parentheses and anything else that is not a digit.
     *
     * <p>Leading zeros are kept. A zero is meaningful in some national formats,
     * and stripping it here would quietly change which number we call.
     *
     * <p>Null or blank in returns an empty string. Never null, never throws —
     * a bad number must produce a refusal downstream, not an exception in the
     * middle of a webhook.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        StringBuilder digits = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c >= '0' && c <= '9') {
                digits.append(c);
            }
        }
        return digits.toString();
    }

    /** The form Meta wants. Blank in, blank out — never a bare {@code "+"}. */
    public static String toE164(String digits) {
        if (digits == null || digits.isBlank()) {
            return "";
        }
        return "+" + digits;
    }

    /**
     * Whether we are willing to send to this number.
     *
     * <p>False for blank, and false for anything shorter than
     * {@value #MIN_SENDABLE_DIGITS} digits — that is the 10-digit,
     * country-code-less case from production, and the country must never be
     * guessed.
     */
    public static boolean isSendable(String digits) {
        return digits != null && !digits.isBlank() && digits.length() >= MIN_SENDABLE_DIGITS;
    }
}
