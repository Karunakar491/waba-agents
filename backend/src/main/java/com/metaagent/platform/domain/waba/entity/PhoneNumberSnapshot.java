package com.metaagent.platform.domain.waba.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

/**
 * Cache for {@code WabaDtos.AccountPhoneNumber}, written by the login-
 * triggered background sync (TASK-055). Scoped per (accountId,
 * phoneNumberId) — agent visibility on a phone number is account-specific
 * (PhoneNumberAccessGuard), so this cannot be scoped by WABA alone.
 */
@Entity
@Table(name = "phone_number_snapshot")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PhoneNumberSnapshot {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "phone_number_id", nullable = false, length = 64)
    private String phoneNumberId;

    @Column(name = "display_phone_number", length = 32)
    private String displayPhoneNumber;

    @Column(name = "verified_name")
    private String verifiedName;

    @Column(name = "waba_id", length = 32)
    private String wabaId;

    @Column(name = "waba_label", length = 100)
    private String wabaLabel;

    @Column(name = "has_agent", nullable = false)
    private boolean hasAgent;

    @Column(name = "agent_id")
    private Long agentId;

    @Column(name = "agent_name")
    private String agentName;

    @Column(name = "agent_status", length = 16)
    private String agentStatus;

    /** TASK-061 — quality_rating is the leading indicator before WhatsApp
     * restricts/bans a number; previously never requested from Meta at all. */
    @Column(name = "quality_rating", length = 16)
    private String qualityRating;

    @Column(name = "name_status", length = 32)
    private String nameStatus;

    @Column(name = "messaging_limit_tier", length = 32)
    private String messagingLimitTier;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;
}
