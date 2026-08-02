package com.metaagent.platform.infrastructure.meta.audit;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * One row per Meta API call, for debugging real failures against a client's
 * account. Never stores the Meta bearer token (MetaApiClient sets it as a
 * default header, not part of any logged request/response body) or connector
 * secrets — those are redacted before this entity is built. See
 * ApiCallLogRedactor.
 */
@Entity
@Table(name = "api_call_log")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiCallLog {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long accountId;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 512)
    private String path;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "request_body", columnDefinition = "TEXT")
    private String requestBody;

    @Column(name = "response_body", columnDefinition = "TEXT")
    private String responseBody;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "called_at", nullable = false)
    private LocalDateTime calledAt;

    @PrePersist
    protected void onCreate() {
        if (calledAt == null) {
            calledAt = LocalDateTime.now();
        }
    }
}
