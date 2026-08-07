package com.metaagent.platform.domain.waba.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Account <-> WABA access grant. Many-to-many, mirrors client_staff:
 * decouples "which account can manage this WABA's agents" from any single
 * exclusive owner. Any account with a row here can see/edit every Agent
 * whose wabaId points at this WABA — see PhoneNumberAccessGuard and
 * AgentService (2026-07-28 decision, decoupling Agent from Agent.accountId).
 */
@Entity
@Table(name = "waba_account_access", uniqueConstraints = @UniqueConstraint(name = "uq_waba_account", columnNames = {"waba_id", "account_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WabaAccountAccess {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "waba_id", nullable = false)
    private Long wabaId;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    @Column(name = "granted_by", nullable = false, updatable = false)
    private Long grantedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
