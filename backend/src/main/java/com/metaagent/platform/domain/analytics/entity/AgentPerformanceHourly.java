package com.metaagent.platform.domain.analytics.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_performance_hourly")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentPerformanceHourly {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long accountId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(nullable = false)
    private LocalDateTime hour;

    @Column(name = "messages_received", nullable = false)
    private Integer messagesReceived;

    @Column(name = "messages_sent", nullable = false)
    private Integer messagesSent;

    @Column(name = "conversations_opened", nullable = false)
    private Integer conversationsOpened;

    @Column(name = "conversations_closed", nullable = false)
    private Integer conversationsClosed;

    @Column(name = "avg_response_ms", nullable = false)
    private Double avgResponseMs;

    @Column(name = "p95_response_ms", nullable = false)
    private Double p95ResponseMs;

    @Column(nullable = false)
    private Integer errors;
}
