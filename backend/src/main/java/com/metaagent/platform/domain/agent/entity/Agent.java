package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Agent {

    public enum Status { draft, active, paused, deleted }

    public enum Channel { whatsapp, messenger, instagram }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    /** Null until a phone is bound via the WABA connection flow. Unique when set. */
    @Column(name = "phone_number_id", unique = true)
    private String phoneNumberId;

    /** Internal waba.id (not Meta's WABA ID). Set when a phone is bound. */
    @Column(name = "waba_id")
    private Long wabaId;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    /** Shown to end-users in chat (spec 4: max 25 chars). */
    @Column(name = "customer_facing_name", length = 25)
    private String customerFacingName;

    /** Locked after creation — service layer rejects changes (spec 4). */
    @Enumerated(EnumType.STRING)
    @Column
    private Channel channel;

    @Column(length = 50)
    private String tone;

    @Column(length = 50)
    private String language;

    @Column(name = "behavior_rules", columnDefinition = "TEXT")
    private String behaviorRules;

    @Column(nullable = false)
    private boolean enabled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.draft;

    @Column(name = "deployed_at")
    private LocalDateTime deployedAt;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    private String systemPrompt;

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
