package com.metaagent.platform.domain.webhook.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity
@Table(name = "webhook_raw")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebhookRaw {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    // Nullable (V50) — a payload Meta sends for a phone_number_id we don't
    // recognize, or one that fails signature verification, has no known
    // account to attribute it to at all. Still persisted (see
    // WebhookController) rather than dropped, per the founder's "log every
    // kind of webhook" requirement — null here just means "unattributed",
    // never "lost".
    @Column(name = "account_id")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    @Column(name = "agent_id")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long agentId;

    /** Meta's phone_number_id from the payload — extracted at receipt, independent of whether an agent/account was resolved. */
    @Column(name = "phone_number_id", length = 64)
    private String phoneNumberId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "json")
    private String payload;

    @Column(nullable = false, length = 128)
    private String signature;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "received_at", nullable = false, updatable = false)
    private LocalDateTime receivedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @PrePersist
    protected void onCreate() {
        receivedAt = LocalDateTime.now();
        if (status == null) {
            status = Status.PENDING;
        }
    }

    public enum Status {
        PENDING, PROCESSING, PROCESSED, FAILED
    }
}
