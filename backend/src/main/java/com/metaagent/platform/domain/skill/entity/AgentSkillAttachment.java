package com.metaagent.platform.domain.skill.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Join between one agent and one Library {@link Skill}. metaSkillId lives
 * HERE, not on Skill — the same Library skill attached to two different
 * agents gets a different Meta-side skill id on each (Meta scopes skills per
 * phone number, not globally). deployedAt null or older than the Skill's
 * updatedAt means this agent's copy is "Out of sync" and needs an explicit
 * sync action before the edit reaches Meta.
 */
@Entity
@Table(name = "agent_skill_attachment")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentSkillAttachment {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "skill_id", nullable = false)
    private Long skillId;

    @Column(name = "meta_skill_id")
    private String metaSkillId;

    /** NULL = never pushed to Meta for this agent yet. */
    @Column(name = "deployed_at")
    private LocalDateTime deployedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
