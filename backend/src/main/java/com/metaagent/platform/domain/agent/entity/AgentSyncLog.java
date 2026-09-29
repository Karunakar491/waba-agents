package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * One row per (agent, category, sync attempt) — R9's audit trail. Append-only
 * on purpose: "last synced at" and "did drift" are read by querying the
 * newest row per (agentId, category), never by mutating a row in place, so a
 * later sync can never erase what an earlier one found.
 */
@Entity
@Table(name = "agent_sync_log")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentSyncLog {

    public enum Trigger { PHONE_ADD, LOGIN, DAILY }
    public enum Category { SKILLS, FAQS, FILES, WEBSITES, BUSINESS_PERSONA, CONNECTORS }
    public enum Status { SUCCESS, FAILED }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_source", nullable = false, length = 16)
    private Trigger triggerSource;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(nullable = false)
    @Builder.Default
    private boolean changed = false;

    @Column(name = "before_snapshot", columnDefinition = "TEXT")
    private String beforeSnapshot;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @PrePersist
    protected void onCreate() {
        if (syncedAt == null) syncedAt = LocalDateTime.now();
    }
}
