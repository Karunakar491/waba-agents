package com.metaagent.platform.domain.businessevent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Join between one agent and one {@link BusinessEvent}. No Meta-side object
 * to keep in sync here — unlike {@code AgentSkillAttachment}, a business
 * event has nothing pushed to Meta ahead of time, so this row is just "this
 * agent can announce this event" and nothing more.
 */
@Entity
@Table(name = "business_event_binding")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessEventBinding {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "agent_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long agentId;

    @Column(name = "business_event_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long businessEventId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
