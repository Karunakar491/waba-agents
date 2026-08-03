package com.metaagent.platform.domain.user.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * Per-account entitlement for a product module (BUSINESS_AGENTS today,
 * AI_CAMPAIGNS_TEMPLATES later). Admin-set, DB-backed — no self-serve
 * upgrade flow. Missing row for a given (account, module) means disabled;
 * see AccountModuleService.isEnabled().
 */
@Entity
@Table(name = "account_modules")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountModule {

    public enum Module {
        BUSINESS_AGENTS
    }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 64)
    private Module module;

    @Column(nullable = false)
    private boolean enabled;

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
