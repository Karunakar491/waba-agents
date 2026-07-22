package com.metaagent.platform.domain.waba.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "waba")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Waba {

    public enum Status { active, disconnected }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    /** Meta's numeric WABA ID as entered by the user. */
    @Column(name = "waba_id", nullable = false, length = 32)
    private String wabaId;

    @Column(length = 100)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.active;

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
