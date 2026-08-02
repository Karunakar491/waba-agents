package com.metaagent.platform.domain.skill.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Karix-curated reference catalog entry — GLOBAL, no waba_id/account_id at
 * all. Every logged-in account sees every template unconditionally; there is
 * no tenant data here, so no access guard beyond normal auth. "Copy to my
 * Skills" creates an independent Skill row (one-way INSERT, no live link
 * back) — editing a template later never affects anything already copied.
 */
@Entity
@Table(name = "skill_template")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillTemplate {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(nullable = false, length = 64)
    private String title;

    @Column(nullable = false, length = 1024)
    private String description;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false, length = 64)
    private String industry;

    @Column(name = "use_case", nullable = false, length = 64)
    private String useCase;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
