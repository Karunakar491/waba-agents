package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Agent {

    public enum Status { draft, active, paused, deleted }

    public enum Channel { whatsapp, messenger, instagram }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    /**
     * Original creator, kept as historical/informational metadata only —
     * NOT the access-control field. Access is derived from wabaId ->
     * waba_account_access (see PhoneNumberAccessGuard, AgentService) once
     * this agent is bound to a WABA. Retained (not dropped) for one release
     * as a safety net per the 2026-07-28 decoupling decision.
     */
    // EL-caught gap (2026-08-07 audit): confirmed live -- GET /agents returns
    // this entity directly, and accountId/updatedBy were the only two Long
    // fields on it missing @JsonSerialize, reaching the client as raw JSON
    // numbers ("accountId":867344590959546368) exceeding
    // Number.MAX_SAFE_INTEGER while id/wabaId right below were correctly
    // annotated -- an inconsistent application of the same fix, same class
    // of bug as F17.
    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    /** Last account to edit this agent — audit stamp, not an ownership field. */
    @Column(name = "updated_by")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long updatedBy;

    /** Null until a phone is bound via the WABA connection flow. Unique when set. */
    @Column(name = "phone_number_id", unique = true)
    private String phoneNumberId;

    /** Internal waba.id (not Meta's WABA ID). Set when a phone is bound. */
    @Column(name = "waba_id")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long wabaId;

    /**
     * Not persisted — populated by AgentAccessService before returning this
     * agent from the API, so the frontend can show "shared with N accounts"
     * (PM's binding condition on the 2026-07-28 decoupling decision). 1 or
     * null means not shared / not yet bound to a WABA.
     */
    @Transient
    private Integer sharedAccountCount;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    /** Shown to end-users in chat (spec 4: max 25 chars). */
    @Column(name = "customer_facing_name", length = 25)
    private String customerFacingName;

    /** Locked after creation — service layer rejects changes (spec 4). */
    @Enumerated(EnumType.STRING)
    @Column
    private Channel channel;

    @Column(length = 50)
    private String tone;

    @Column(length = 50)
    private String language;

    @Column(name = "behavior_rules", columnDefinition = "TEXT")
    private String behaviorRules;

    /**
     * Figma 8.4 Business Persona — the operator-edited sample reply that sets
     * the agent's starting style ("Based on 'Friendly shopkeeper' — edit
     * freely"). Distinct from `tone`, which holds only the preset's label.
     */
    @Column(name = "persona_sample_reply", columnDefinition = "TEXT")
    private String personaSampleReply;

    @Column(nullable = false)
    private boolean enabled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.draft;

    @Column(name = "deployed_at")
    private LocalDateTime deployedAt;

    /** TASK-059: TTL gate for FAQ/Meta reconciliation — null or stale means the
     * next getFaqs() read is allowed to spend one Meta GET call reconciling. */
    @Column(name = "faq_reconciled_at")
    private LocalDateTime faqReconciledAt;

    /** TASK-062: same TTL-gate pattern as faqReconciledAt, one field per
     * domain so each reconciles independently. */
    @Column(name = "file_reconciled_at")
    private LocalDateTime fileReconciledAt;

    @Column(name = "website_reconciled_at")
    private LocalDateTime websiteReconciledAt;

    /** TASK-068: same TTL-gate pattern — corrects status/enabled if this agent
     * was enabled/disabled directly on Meta, outside this app. */
    @Column(name = "status_reconciled_at")
    private LocalDateTime statusReconciledAt;

    /** Meta's opaque agent_id from agent_config/settings — captured write-once on first successful deploy. */
    @Column(name = "meta_agent_id", length = 255)
    private String metaAgentId;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    private String systemPrompt;

    /**
     * Figma 8.1 "About" column — a short, human-written label (e.g. "Handles
     * bulk grocery orders"), NOT a reuse/truncation of systemPrompt (which is
     * the longer instructional prompt driving agent behavior). Optional;
     * null renders as "—" with an "Add a label" affordance in the table.
     */
    @Column(name = "about_label", length = 255)
    private String aboutLabel;

    /** Human handoff toggle (settings.md handoff.enabled) — per-agent, wired into deploy settings PUT. */
    @Column(name = "handoff_enabled", nullable = false)
    @Builder.Default
    private boolean handoffEnabled = false;

    /** Message shown to the customer on handoff (settings.md handoff.message). Nullable — Meta accepts omission. */
    @Column(name = "handoff_message", length = 1000)
    private String handoffMessage;

    /**
     * When handoffEnabled/handoffMessage were last actually pushed to Meta's
     * agent_config/settings via publishHandoffSettings — null means never
     * published. Draft (this row) vs. published (Meta) is considered out of
     * sync whenever updatedAt is after handoffPublishedAt (V49).
     */
    @Column(name = "handoff_published_at")
    private LocalDateTime handoffPublishedAt;

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
