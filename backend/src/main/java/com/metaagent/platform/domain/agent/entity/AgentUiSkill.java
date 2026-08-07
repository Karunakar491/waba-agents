package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_ui_skill")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentUiSkill {

    public enum ComponentType {
        carousel_quick_reply, carousel_url, cta_url, image, interactive_list, location, location_request
    }

    public enum Status { enabled, disabled }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long agentId;

    @Column(name = "meta_ui_skill_id")
    private String metaUiSkillId;

    @Column(nullable = false, length = 64)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", nullable = false, length = 32)
    private ComponentType componentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status;

    @Column(nullable = false, length = 1024)
    private String instruction;

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
