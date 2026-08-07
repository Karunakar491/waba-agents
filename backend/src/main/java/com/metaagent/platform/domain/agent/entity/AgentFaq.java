package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_faq")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentFaq {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "meta_faq_id")
    private String metaFaqId;

    /** TASK-059: false when the last write to Meta failed (saved locally only)
     * or a reconciliation read found this row missing from Meta's live list.
     * True is the safe default for existing rows until proven otherwise. */
    @Column(name = "meta_synced", nullable = false)
    @Builder.Default
    private boolean metaSynced = true;

    /** TASK-059: false only when this row was created/last saved while its
     * agent had no phoneNumberId yet (draft agent — nothing to push to Meta
     * at all, sync happens at bind time). Reconciliation must skip these —
     * comparing them against Meta's live list would falsely flag "Not synced"
     * for a FAQ that was never supposed to be there yet, not one that's
     * actually broken. True for every row where a Meta call was genuinely
     * attempted (success or failure). */
    @Column(name = "meta_sync_attempted", nullable = false)
    @Builder.Default
    private boolean metaSyncAttempted = true;

    @Column(nullable = false, length = 512)
    private String question;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String answer;

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
