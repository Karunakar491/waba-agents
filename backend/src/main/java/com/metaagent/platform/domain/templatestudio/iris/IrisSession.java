package com.metaagent.platform.domain.templatestudio.iris;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * One Iris conversation. pendingToolName/pendingToolArgsJson hold the exact
 * args of a mutating tool call awaiting explicit user confirmation (create/
 * edit/send_test — never list_templates, which is read-only and executes
 * inline). Confirm always replays THESE persisted args, never a freshly
 * re-parsed model message — this is what "confirm-before-submit" actually
 * means at the data layer, not just a UI gate.
 */
@Entity
@Table(name = "iris_session")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IrisSession {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSID exceeds JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    @Column(name = "waba_id")
    private Long wabaId;

    /** Set once from a truncated first user message — "New chat" is a frontend fallback for null, never stored. */
    @Column(name = "title", length = 120)
    private String title;

    @Column(name = "pending_tool_name", length = 50)
    private String pendingToolName;

    @Column(name = "pending_tool_args_json", columnDefinition = "TEXT")
    private String pendingToolArgsJson;

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
