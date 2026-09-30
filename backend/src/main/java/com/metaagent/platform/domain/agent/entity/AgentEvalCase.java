package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Mirror of one Meta eval case configuration (agent-eval.md GET /cases) —
 * read-only, no local editor; Meta owns these entirely. Running an eval
 * against a case is a separate, deliberate action (EvalRollupWorker), not
 * something this mirror triggers.
 */
@Entity
@Table(name = "agent_eval_case")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentEvalCase {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "meta_case_id", nullable = false, length = 255)
    private String metaCaseId;

    @Column(columnDefinition = "TEXT")
    private String scenario;

    @Column(name = "scenario_version", length = 64)
    private String scenarioVersion;

    /** JSON array, verbatim from Meta. */
    @Column(columnDefinition = "TEXT")
    private String categories;

    @Column(name = "max_turns")
    private Integer maxTurns;

    /** JSON array, verbatim from Meta. */
    @Column(name = "success_criteria", columnDefinition = "TEXT")
    private String successCriteria;

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
