package com.metaagent.platform.domain.agent.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One row per agent, overwritten on every sync — Meta's own conversation,
 * tool-call and event insight numbers (conversation-insights.md,
 * tool-call-insights.md, agent-event-insights.md), all pure read, all real
 * Meta data we author nothing of. agent_sync_log already carries the "when
 * was this last checked" history; this table only needs the latest values.
 */
@Entity
@Table(name = "agent_insights_snapshot")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentInsightsSnapshot {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(name = "agent_id", nullable = false, unique = true)
    private Long agentId;

    @Column(name = "range_start")
    private LocalDate rangeStart;

    @Column(name = "range_end")
    private LocalDate rangeEnd;

    /** insights/conversations — conversations the agent replied in at least once in range. */
    @Column(name = "ai_threads")
    private Integer aiThreads;

    /** insights/conversations — LIVE queue depth, ignores the date range (conversation-insights.md). */
    @Column(name = "ai_handoffs")
    private Integer aiHandoffs;

    /** JSON array, verbatim from Meta. */
    @Column(name = "tool_call_insights", columnDefinition = "TEXT")
    private String toolCallInsights;

    /** JSON array, verbatim from Meta. */
    @Column(name = "agent_event_insights", columnDefinition = "TEXT")
    private String agentEventInsights;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @PrePersist
    protected void onCreate() {
        if (syncedAt == null) syncedAt = LocalDateTime.now();
    }
}
