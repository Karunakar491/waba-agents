package com.metaagent.platform.domain.businessevent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * A shared, reusable business event definition — "Payment Received", "Order
 * Shipped" — created once and attached to many agents via
 * {@link BusinessEventBinding}. Mirrors {@code Skill} deliberately: same
 * two-layer shape, per the founder's own instruction to build this "same
 * like how we are doing for skills and business persona".
 *
 * <p>Editing this row changes nothing already fired — a
 * {@link BusinessEventFire} keeps its own copy of the type/description it was
 * fired with, the same way a Skill edit does not retroactively change a past
 * conversation.
 */
@Entity
@Table(name = "business_event")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessEvent {

    public enum TriggerMethod {
        MANUAL,
        SYSTEM_WEBHOOK,
        CONNECTOR_WATCH
    }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(nullable = false, length = 1024)
    private String description;

    @Column(length = 2000)
    private String guardrails;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_method", nullable = false, length = 24)
    private TriggerMethod triggerMethod;

    @Column(name = "created_by")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
