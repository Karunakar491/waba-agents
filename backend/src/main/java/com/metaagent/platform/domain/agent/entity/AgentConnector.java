package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Local mirror of one Meta connector (V45).
 *
 * Meta stays authoritative for every field in the "from Meta" block below —
 * they are overwritten on every live read (upsert-on-read). The "ours" block
 * is local-only metadata Meta has no concept of and sync never touches.
 *
 * No credential material is stored here, ever. Not api keys, not oauth
 * secrets, not certificates. Those live only on Meta.
 */
@Entity
@Table(name = "agent_connector")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentConnector {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long agentId;

    @Column(name = "meta_connector_id", nullable = false, length = 255)
    private String metaConnectorId;

    @Column(name = "phone_number_id", length = 255)
    private String phoneNumberId;

    // --- from Meta (overwritten on every sync) -------------------------------

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 1024)
    private String description;

    @Column(name = "base_url", length = 1024)
    private String baseUrl;

    @Column(name = "auth_type", length = 64)
    private String authType;

    @Column(length = 32)
    private String status;

    @Column(name = "requires_certificate", nullable = false)
    private boolean requiresCertificate;

    // --- ours (sync never touches these) -------------------------------------

    @Column(name = "system_type", length = 64)
    private String systemType;

    @Column(length = 512)
    private String tags;

    @Column(name = "published_to_library", nullable = false)
    private boolean publishedToLibrary;

    // --- bookkeeping ---------------------------------------------------------

    /** Heuristic cross-agent key — see V45 migration comment. Not a Meta guarantee. */
    @Column(name = "identity_key", length = 512)
    private String identityKey;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

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
