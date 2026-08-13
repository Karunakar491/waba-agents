package com.metaagent.platform.domain.connector.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * A reusable Connector Library definition (V46) — our own source of truth for
 * an integration, independent of Meta.
 *
 * Named {@code Connector}, not {@code ConnectorTemplate}, to match the Skill
 * Library's actual convention: there the WABA-scoped library row is
 * {@code Skill} and the {@code Template} suffix is reserved for the global
 * Karix-curated catalog ({@code SkillTemplate}). No such catalog exists for
 * connectors yet, so the suffix would have promised something that isn't here.
 *
 * Relationship to {@link com.metaagent.platform.domain.agent.entity.AgentConnector}
 * (V45): that is a CACHE of Meta's live per-phone-number state. This is the
 * definition above it. Editing this row never touches Meta — deployment is an
 * explicit per-agent action, exactly like Skill/AgentSkillAttachment.
 *
 * NO CREDENTIAL MATERIAL IS EVER STORED HERE. {@code authConfigShape} holds
 * field names and non-secret OAuth settings only; the actual key, secret or
 * certificate is supplied at deploy time and forwarded straight to Meta.
 */
@Entity
@Table(name = "connector")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Connector {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_PUBLISHED = "PUBLISHED";

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    /** NULL = not yet shared with any WABA. Set = visible to every agent on that WABA. */
    @Column(name = "waba_id")
    private Long wabaId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 1024)
    private String description;

    /** Our label (Shopify / Zendesk / Custom). Meta has no such field. */
    @Column(name = "system_type", length = 64)
    private String systemType;

    @Column(name = "base_url", nullable = false, length = 1024)
    private String baseUrl;

    @Column(name = "auth_type", nullable = false, length = 64)
    private String authType;

    /** JSON — field NAMES and non-secret OAuth settings only. Never values. */
    @Column(name = "auth_config_shape", columnDefinition = "TEXT")
    private String authConfigShape;

    @Column(name = "requires_certificate", nullable = false)
    private boolean requiresCertificate;

    @Column(length = 512)
    private String tags;

    /** DRAFT | PUBLISHED — ours, not a Meta concept. */
    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = STATUS_DRAFT;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
