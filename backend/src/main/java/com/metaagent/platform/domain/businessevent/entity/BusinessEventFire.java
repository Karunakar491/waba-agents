package com.metaagent.platform.domain.businessevent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * One attempt to make an agent announce something to a customer — and that
 * includes the attempts we refuse (V58).
 *
 * <p>A refusal is a row here with {@code outcome = REFUSED} and a
 * {@link RefusalReason}. It never reaches Meta. Writing it down is the whole
 * point: "we tried and would not send it, here is why" is the only answer a
 * support lead can give, and the "31 sent · 2 didn't" line on the agent page is
 * only truthful if those 2 exist.
 *
 * <p><b>{@link #outcome} and {@link #metaStatus} are two fields on purpose.</b>
 * {@code outcome} is our verdict on the attempt; {@code metaStatus} is Meta's
 * verdict on what it then did. They disagree routinely —
 * {@code outcome = ACCEPTED, metaStatus = skipped} is real and common: Meta
 * took the request, decided by itself to deliver nothing, and the customer was
 * never told. One combined status field would make that indistinguishable from
 * a real delivery. Same reasoning as
 * {@code ConnectorDeployment.toolSyncError} versus {@code lastError} (V57).
 *
 * <p>{@link #conversationId} being null is evidence, not an omission: it is
 * what a {@link RefusalReason#NO_CONVERSATION} refusal looks like. Meta can
 * only announce into a conversation the customer already opened.
 *
 * <p>{@link #businessEventId} and {@link #businessEventBindingId} are nullable
 * because this ships before named events exist, and stay nullable
 * afterwards — an ad-hoc fire that names its own event type is legal forever.
 */
@Entity
@Table(name = "business_event_fire")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessEventFire {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    /**
     * The tenant, as a column rather than an inference. The public inbound path
     * that fires these authenticates with an ingest credential, not a logged-in
     * user, so there is no SecurityContext to read the account from.
     */
    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long agentId;

    /** NULL = there was no conversation to announce into — a NO_CONVERSATION refusal. */
    @Column(name = "conversation_id")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long conversationId;

    /** Exactly what we sent Meta, after normalisation by {@code PhoneKey}. */
    @Column(name = "to_phone", nullable = false, length = 32)
    private String toPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Source source;

    /** The user who pressed the button, for a MANUAL fire only. */
    @Column(name = "fired_by")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long firedBy;

    /** Which credential authenticated an INBOUND_API fire. */
    @Column(name = "ingest_key_id")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long ingestKeyId;

    /** NULL for an ad-hoc fire, or for any fire made before named events existed. */
    @Column(name = "business_event_id")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long businessEventId;

    /** NULL for the same reasons as {@link #businessEventId}. */
    @Column(name = "business_event_binding_id")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long businessEventBindingId;

    /** Caller-supplied, unique per agent — a retry must not announce twice. */
    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    /** Meta's limit, not ours. */
    @Column(name = "request_event_type", nullable = false, length = 256)
    private String requestEventType;

    /** Meta's limit, not ours. */
    @Column(name = "request_description", nullable = false, length = 1024)
    private String requestDescription;

    /**
     * Meta's opaque string, capped by Meta at 4096 characters. Stored as text
     * rather than JSON because Meta never requires it to parse.
     */
    @Column(name = "request_payload", nullable = false, columnDefinition = "text")
    private String requestPayload;

    /** Our verdict. See the class note on why this is not merged with {@link #metaStatus}. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Outcome outcome;

    @Enumerated(EnumType.STRING)
    @Column(name = "refusal_reason", length = 40)
    private RefusalReason refusalReason;

    /** Free text for the operator, e.g. which field failed validation. */
    @Column(name = "refusal_detail", length = 512)
    private String refusalDetail;

    /** Optional in Meta's contract. NULL means this fire can never be polled. */
    @Column(name = "meta_agent_event_id", length = 255)
    private String metaAgentEventId;

    @Column(name = "meta_http_status")
    private Integer metaHttpStatus;

    @Column(name = "meta_error_title", length = 255)
    private String metaErrorTitle;

    @Column(name = "meta_error_detail", length = 1024)
    private String metaErrorDetail;

    @Column(name = "meta_error_type", length = 64)
    private String metaErrorType;

    /** Meta's verdict, polled after acceptance. Deliberately not {@link #outcome}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "meta_status", length = 24)
    private MetaStatus metaStatus;

    /** Why Meta delivered nothing despite accepting the request. */
    @Column(name = "meta_skipped_reason", length = 512)
    private String metaSkippedReason;

    @Column(name = "meta_error_message", length = 512)
    private String metaErrorMessage;

    @Builder.Default
    @Column(name = "poll_attempts", nullable = false)
    private short pollAttempts = 0;

    @Column(name = "last_polled_at")
    private LocalDateTime lastPolledAt;

    /** Set once Meta's status can no longer change; the poller skips these. */
    @Column(name = "terminal_at")
    private LocalDateTime terminalAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Who asked for this announcement. */
    public enum Source {
        INBOUND_API, MANUAL, CONNECTOR_WATCH
    }

    /** Our verdict on the attempt, before Meta has any say. */
    public enum Outcome {
        REFUSED, ACCEPTED, FAILED
    }

    /** Why we would not call Meta. Set only when {@link Outcome#REFUSED}. */
    public enum RefusalReason {
        AGENT_NOT_DEPLOYED,
        AGENT_PAUSED,
        BINDING_DISABLED,
        NO_CONVERSATION,
        CONVERSATION_CLOSED,
        HUMAN_HOLDS_THREAD,
        PAYLOAD_TOO_LARGE,
        VALIDATION,
        AMBIGUOUS_CUSTOMER
    }

    /**
     * Meta's own six states, plus {@code unknown} for a value Meta starts
     * sending that we do not yet recognise. Lowercase to match Meta's wire
     * values exactly, the same way {@code Conversation.Status} does — these are
     * persisted as strings, so the constant name IS the stored value.
     */
    public enum MetaStatus {
        request_received, processing, sent, failed, skipped, success, unknown
    }
}
