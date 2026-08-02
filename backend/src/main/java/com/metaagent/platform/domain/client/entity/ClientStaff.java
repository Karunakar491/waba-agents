package com.metaagent.platform.domain.client.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * Staff <-> client access grant. Many-to-many — a client can be shared between
 * multiple internal staff, a staff member can have access to multiple clients.
 */
@Entity
@Table(name = "client_staff", uniqueConstraints = @UniqueConstraint(name = "uq_client_staff", columnNames = {"client_id", "user_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientStaff {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "granted_by", nullable = false, updatable = false)
    private Long grantedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
