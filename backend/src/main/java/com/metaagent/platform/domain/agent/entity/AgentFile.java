package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_file")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentFile {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "meta_file_id")
    private String metaFileId;

    /** TASK-062: false when reconciliation finds this file missing from
     * Meta's live list (deleted/changed directly on Meta, outside this app).
     * addFile already throws hard on a failed Meta upload, so unlike FAQ
     * there's no "local-only" creation path — every row here started synced. */
    @Column(name = "meta_synced", nullable = false)
    @Builder.Default
    private boolean metaSynced = true;

    @Column(nullable = false)
    private String filename;

    @Column(name = "mime_type", nullable = false, length = 128)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
