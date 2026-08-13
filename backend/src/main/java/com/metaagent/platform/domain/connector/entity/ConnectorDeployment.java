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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
