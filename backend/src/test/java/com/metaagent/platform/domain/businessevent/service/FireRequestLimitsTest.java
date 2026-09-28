package com.metaagent.platform.domain.businessevent.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Meta's contract limits, and the message the operator is given for each. */
class FireRequestLimitsTest {

    @Test
    void aValidRequestHasNoViolation() {
        assertNull(FireRequestLimits.check("order_shipped", "Your order shipped.", "{}"));
    }

    @Test
    void anEmptyPayloadIsFineBecauseMetaDoesNotRequireOne() {
        assertNull(FireRequestLimits.check("order_shipped", "Your order shipped.", null));
    }

    @Test
    void aBlankEventTypeIsAskedForByName() {
        FireRequestLimits.Violation violation = FireRequestLimits.check("  ", "Your order shipped.", "{}");

        assertTrue(violation.message().contains("type"), violation.message());
        assertFalse(violation.anyFieldTooLong());
    }

    @Test
    void aBlankDescriptionIsAskedForByName() {
        FireRequestLimits.Violation violation = FireRequestLimits.check("order_shipped", null, "{}");

        assertTrue(violation.message().contains("description"), violation.message());
        assertFalse(violation.anyFieldTooLong());
    }

    @Test
    void anOverLongFieldNamesItsRealLengthAndMetaSLimit() {
        FireRequestLimits.Violation violation =
                FireRequestLimits.check("order_shipped", "Your order shipped.", "x".repeat(4097));

        assertTrue(violation.message().contains("4097"), violation.message());
        assertTrue(violation.message().contains("4096"), violation.message());
        assertTrue(violation.anyFieldTooLong());
    }

    @Test
    void aBlankFieldAlongsideAnOverLongOneStillCountsAsTooLarge() {
        FireRequestLimits.Violation violation = FireRequestLimits.check("order_shipped", "  ", "x".repeat(4097));

        assertTrue(violation.message().contains("description"), violation.message());
        assertTrue(violation.anyFieldTooLong(), "the oversized payload still decides the refusal reason");
    }

    @Test
    void aFieldExactlyAtTheLimitIsAccepted() {
        assertNull(FireRequestLimits.check("t".repeat(256), "d".repeat(1024), "x".repeat(4096)));
    }
}
