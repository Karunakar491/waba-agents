package com.metaagent.platform.domain.client.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * Audit trail for Client edits — who changed what, when.
 * No Envers/JPA-auditing convention existed elsewhere in this codebase (checked before
 * adding this) so this follows the plain entity-table pattern already used everywhere else.
 */
@Entity
@Table(name = "client_audit_log")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientAuditLog {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "changed_by", nullable = false)
    private Long changedBy;

    /** e.g. "name: 'Acme' -> 'Acme Corp'" — one line per changed field. */
    @Column(name = "change_summary", nullable = false, length = 500)
    private String changeSummary;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    @PrePersist
    protected void onCreate() {
        changedAt = LocalDateTime.now();
    }
}
