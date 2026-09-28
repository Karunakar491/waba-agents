package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.infrastructure.meta.MetaApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** What Meta said has to reach the ledger, even when it is not what Meta documents. */
class MetaErrorMapperTest {

    @Test
    void decomposesMetaSStandardErrorIntoItsOwnColumns() {
        MetaErrorMapper.LedgerError error = MetaErrorMapper.fromRejection(new MetaApiException(400,
                "{\"title\":\"Invalid parameter\",\"detail\":\"event.type is required\",\"type\":\"OAuthException\",\"status\":400}"));

        assertEquals(400, error.httpStatus().intValue());
        assertEquals("Invalid parameter", error.title());
        assertEquals("event.type is required", error.detail());
        assertEquals("OAuthException", error.type());
    }

    @Test
    void keepsAnUnparseableBodyInTheDetailColumnRatherThanSwallowingIt() {
        MetaErrorMapper.LedgerError error =
                MetaErrorMapper.fromRejection(new MetaApiException(503, "<html>upstream is down</html>"));

        assertEquals(503, error.httpStatus().intValue());
        assertEquals("<html>upstream is down</html>", error.detail());
        assertNull(error.title());
        assertNull(error.type());
    }

    @Test
    void keepsAJsonBodyThatIsNotAnObjectRatherThanSwallowingIt() {
        MetaErrorMapper.LedgerError error = MetaErrorMapper.fromRejection(new MetaApiException(400, "[\"nope\"]"));

        assertEquals("[\"nope\"]", error.detail());
        assertNull(error.title());
    }

    @Test
    void anObjectWithNoDetailFallsBackToTheRawBody() {
        MetaErrorMapper.LedgerError error =
                MetaErrorMapper.fromRejection(new MetaApiException(400, "{\"title\":\"Bad request\"}"));

        assertEquals("Bad request", error.title());
        assertEquals("{\"title\":\"Bad request\"}", error.detail());
    }

    @Test
    void aBlankFieldIsTreatedAsAbsentRatherThanStoredAsWhitespace() {
        MetaErrorMapper.LedgerError error = MetaErrorMapper.fromRejection(
                new MetaApiException(400, "{\"title\":\"   \",\"detail\":\"real detail\",\"type\":\"\"}"));

        assertNull(error.title());
        assertNull(error.type());
        assertEquals("real detail", error.detail());
    }

    @Test
    void anAbsentBodyLeavesEveryErrorColumnEmptyButKeepsTheStatus() {
        MetaErrorMapper.LedgerError error = MetaErrorMapper.fromRejection(new MetaApiException(500));

        assertEquals(500, error.httpStatus().intValue());
        assertNull(error.title());
        assertNull(error.detail());
        assertNull(error.type());
    }

    @Test
    void truncatesAnOverLongDetailToTheColumnWidthInsteadOfFailingTheInsert() {
        MetaErrorMapper.LedgerError error =
                MetaErrorMapper.fromRejection(new MetaApiException(400, "x".repeat(5000)));

        assertEquals(1024, error.detail().length());
    }

    @Test
    void aTransportFailureIsFiveOhTwoAndSaysWhatTheOperatorNeedsToKnow() {
        MetaErrorMapper.LedgerError error =
                MetaErrorMapper.fromTransportFailure(new IllegalStateException("connection reset"));

        assertEquals(502, error.httpStatus().intValue());
        assertEquals("Could not reach WhatsApp", error.title());
        assertTrue(error.detail().contains("connection reset"));
        assertNull(error.type());
    }
}
