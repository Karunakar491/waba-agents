package com.metaagent.platform.domain.connector.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * One library {@link Connector} deployed onto one agent (V46).
 *
 * metaConnectorId lives HERE, not on Connector — Meta scopes connector ids to
 * a phone number, so the same library definition gets a different Meta id on
 * every agent it lands on. Same reasoning as
 * {@code AgentSkillAttachment.metaSkillId}.
 *
 * This row is what makes "Used by N agents" a real count instead of V45's
 * name+base_url heuristic.
 */
@Entity
@Table(name = "connector_deployment")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectorDeployment {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "connector_id", nullable = false)
    private Long connectorId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    /** NULL = the Meta create call has not succeeded yet. */
    @Column(name = "meta_connector_id", length = 255)
    private String metaConnectorId;

    @Column(name = "phone_number_id", length = 255)
    private String phoneNumberId;

    /** NULL = never reached Meta. Older than the Connector's updatedAt = out of sync. */
    @Column(name = "deployed_at")
    private LocalDateTime deployedAt;

    /** Last failure from Meta, so a failed deploy is visible rather than silent. */
    @Column(name = "last_error", length = 1024)
    private String lastError;

    /**
     * The connector reached Meta, but these actions could not be set up as tools.
     *
     * Deliberately NOT folded into lastError: the two failures overlap in a way
     * that makes them indistinguishable afterwards. A redeploy of an
     * already-deployed connector that fails at the connector level leaves stale
     * deployedAt + fresh lastError, which is the same shape as "deployed, some
     * tools missing" — so a total failure would report itself as a partial one
     * (V57 carries the full reasoning). Separate column, no string parsing.
     */
    @Column(name = "tool_sync_error", length = 1024)
    private String toolSyncError;

    /**
     * How many tools Meta listed for this connector, and how many of them the
     * backfill could actually store, the last time it ran. Equal on a clean
     * import; they differ when a tool's request_definition could not be read,
     * which is the only record that the library's action list is incomplete.
     *
     * Integer, NOT int, and this matters: deploy() saves this row on every
     * deploy, so a primitive would let Hibernate stamp 0/0 onto rows the
     * backfill has never touched — destroying "NULL means never back-filled",
     * which is the distinction the whole thing rests on.
     */
    @Column(name = "tools_reported_by_meta")
    private Integer toolsReportedByMeta;

    @Column(name = "tools_imported")
    private Integer toolsImported;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
