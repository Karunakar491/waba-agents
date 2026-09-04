package com.metaagent.platform.domain.connector.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.util.StdConverter;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * One thing a connector can do — "search products", "check order status" —
 * stored against the library connector rather than against an agent.
 *
 * This exists because Meta scopes tools to a phone number, so an action for a
 * connector that has not been deployed anywhere has no Meta object to live in.
 * This is the template; deploying instantiates it as a real Meta tool per agent.
 *
 * {@code requestDefinition} is Meta's own JSON, stored verbatim. It is not
 * decomposed into columns on purpose: nested body nodes are recursively
 * JSON-encoded strings and parameters carry bindings and enums, so the shape is
 * both richer and more likely to change than a column layout would survive.
 * See docs/meta-api/connector-tools-capability-matrix.md.
 *
 * NO CREDENTIAL MATERIAL HERE, same rule as {@link Connector}. An action
 * describes the request shape; secrets are supplied at deploy time and forwarded
 * straight to Meta.
 */
@Entity
@Table(name = "connector_action")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectorAction {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(name = "connector_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long connectorId;

    /** Stable key the agent uses to invoke this, e.g. product_search. */
    @Column(nullable = false)
    private String name;

    /** The agent reads this to decide WHEN to invoke — vague text means wrong invocations. */
    @Column(nullable = false, length = 1024)
    private String description;

    /**
     * Meta's {@code request_definition}, verbatim JSON. Serialized out as a real
     * object rather than an escaped string so the frontend can hand it straight
     * to the existing request editor.
     */
    @Column(name = "request_definition", nullable = false, columnDefinition = "json")
    @JsonSerialize(converter = RawJsonConverter.class)
    private String requestDefinition;

    @Column(name = "user_auth_required", nullable = false)
    private boolean userAuthRequired;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Emits the stored JSON as JSON, not as a quoted string. Without this the
     * frontend would receive {@code "requestDefinition": "{\"method\":\"POST\"…}"}
     * and have to JSON.parse a field that is already JSON — the same
     * double-encoding that made tool run output unreadable.
     */
    static class RawJsonConverter extends StdConverter<String, com.fasterxml.jackson.databind.JsonNode> {
        private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER =
                new com.fasterxml.jackson.databind.ObjectMapper();

        @Override
        public com.fasterxml.jackson.databind.JsonNode convert(String value) {
            if (value == null || value.isBlank()) {
                return MAPPER.createObjectNode();
            }
            try {
                return MAPPER.readTree(value);
            } catch (Exception e) {
                // Never fail a whole response because one row holds bad JSON —
                // return an empty object and let the row look empty instead.
                return MAPPER.createObjectNode();
            }
        }
    }
}
