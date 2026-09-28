package com.metaagent.platform.domain.businessevent.service;

/**
 * Meta's own limits on the {@code agent_event} contract, checked against what
 * the caller actually sent.
 *
 * <p>Meta would reject these too, but as an unattributed 400. Checking here
 * means the operator is told which field is wrong and by how much, in a
 * sentence they can act on.
 *
 * <p>The same numbers are the ledger's column widths, so the caller truncates
 * what it stores to them. An over-long request is refused with its real length
 * named, so nothing is lost by not storing the overflow — and storing it would
 * make the refusal row itself fail to insert, losing the evidence entirely.
 */
public final class FireRequestLimits {

    public static final int MAX_EVENT_TYPE = 256;
    public static final int MAX_DESCRIPTION = 1024;
    public static final int MAX_PAYLOAD = 4096;

    private FireRequestLimits() {
    }

    /**
     * {@code anyFieldTooLong} is true when any of the three fields exceeds its
     * limit, which is what separates a PAYLOAD_TOO_LARGE refusal from a plain
     * VALIDATION one — independently of which field the message happens to name.
     */
    public record Violation(String message, boolean anyFieldTooLong) {
    }

    /** Null when the request is within every limit. */
    public static Violation check(String rawEventType, String rawDescription, String rawPayload) {
        String eventType = nullToEmpty(rawEventType);
        String description = nullToEmpty(rawDescription);
        String payload = nullToEmpty(rawPayload);

        boolean anyFieldTooLong = eventType.length() > MAX_EVENT_TYPE
                || description.length() > MAX_DESCRIPTION
                || payload.length() > MAX_PAYLOAD;

        String message = firstProblem(eventType, description, payload);
        return message == null ? null : new Violation(message, anyFieldTooLong);
    }

    private static String firstProblem(String eventType, String description, String payload) {
        if (eventType.isBlank()) {
            return "The event needs a type — the short name for what happened, like \"order_shipped\".";
        }
        if (eventType.length() > MAX_EVENT_TYPE) {
            return "The event type is " + eventType.length() + " characters; WhatsApp allows " + MAX_EVENT_TYPE + ".";
        }
        if (description.isBlank()) {
            return "The event needs a description — the sentence the agent uses to tell the customer what happened.";
        }
        if (description.length() > MAX_DESCRIPTION) {
            return "The description is " + description.length() + " characters; WhatsApp allows " + MAX_DESCRIPTION + ".";
        }
        if (payload.length() > MAX_PAYLOAD) {
            return "The payload is " + payload.length() + " characters; WhatsApp allows " + MAX_PAYLOAD + ".";
        }
        return null;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
