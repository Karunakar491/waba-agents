package com.metaagent.platform.domain.businessevent.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The read model behind the agent's announcement history.
 *
 * <p>Two rules hold this file together.
 *
 * <p>First, <b>the backend reports, it does not phrase</b>. Every row carries
 * the raw evidence — our verdict ({@code outcome}), Meta's verdict
 * ({@code metaStatus}), and the three reasons either one can give — and the
 * frontend's {@code describeEventOutcome()} turns that into English. Doing it
 * here as well would mean two copies of the same sentence drifting apart.
 *
 * <p>Second, <b>no internal id reaches a screen</b>. {@code id} is here so the
 * UI has a React key and a link target; it is never rendered. Account, agent,
 * conversation and binding ids are deliberately absent.
 */
public final class BusinessEventFireDtos {

    private BusinessEventFireDtos() {}

    /** One row of the history table. */
    public record FireListItem(
            @JsonSerialize(using = ToStringSerializer.class) Long id,
            String customerPhone,
            String eventName,
            String source,
            LocalDateTime firedAt,
            String outcome,
            String metaStatus,
            String refusalReason,
            String refusalDetail,
            String metaSkippedReason,
            String metaErrorMessage
    ) {
        public static FireListItem from(BusinessEventFire f) {
            return new FireListItem(
                    f.getId(),
                    f.getToPhone(),
                    f.getRequestEventType(),
                    name(f.getSource()),
                    f.getCreatedAt(),
                    name(f.getOutcome()),
                    name(f.getMetaStatus()),
                    name(f.getRefusalReason()),
                    f.getRefusalDetail(),
                    f.getMetaSkippedReason(),
                    f.getMetaErrorMessage());
        }
    }

    /** One page of history. Spring's {@code Page} is never serialised directly. */
    public record FirePage(
            List<FireListItem> items,
            int page,
            int size,
            long totalItems,
            int totalPages
    ) {}

    /**
     * The single fire, with what Meta said verbatim behind the "Details"
     * disclosure — a support lead forwards those words to Meta support.
     */
    public record FireDetail(
            FireListItem summary,
            String description,
            String payload,
            Integer metaHttpStatus,
            String metaErrorTitle,
            String metaErrorDetail,
            String metaErrorType,
            LocalDateTime updatedAt,
            LocalDateTime settledAt
    ) {
        public static FireDetail from(BusinessEventFire f) {
            return new FireDetail(
                    FireListItem.from(f),
                    f.getRequestDescription(),
                    f.getRequestPayload(),
                    f.getMetaHttpStatus(),
                    f.getMetaErrorTitle(),
                    f.getMetaErrorDetail(),
                    f.getMetaErrorType(),
                    f.getUpdatedAt(),
                    f.getTerminalAt());
        }
    }

    /**
     * The "31 sent · 2 didn't" line — three numbers, never one.
     *
     * <p>{@code askedFor} is every attempt including the ones we refused,
     * {@code sent} is what Meta accepted, and {@code reached} is what Meta says
     * actually got to the customer. Collapsing these would hide the accepted
     * fires Meta silently skipped, which is the whole reason the ledger exists.
     */
    public record FireCounts(
            long askedFor,
            long sent,
            long reached,
            int windowDays
    ) {}

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
