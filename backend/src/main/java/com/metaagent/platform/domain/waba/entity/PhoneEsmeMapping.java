package com.metaagent.platform.domain.waba.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * Maps one phone number (under one WABA) to the KarixEsmeCredential used to
 * send/manage templates for it. Many phones can point to the same
 * credential (confirmed by founder — one esme_addr, six phone numbers, in
 * real Karix data). phoneNumberId is Meta's phone_number_id, matching
 * PhoneNumberSnapshot.phoneNumberId — NOT an FK, since the snapshot is a
 * resyncable cache and this mapping must survive a resync.
 */
@Entity
@Table(name = "phone_esme_mapping")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PhoneEsmeMapping {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "waba_id", nullable = false)
    private Long wabaId;

    @Column(name = "phone_number_id", nullable = false, length = 64)
    private String phoneNumberId;

    @Column(name = "esme_credential_id", nullable = false)
    private Long esmeCredentialId;

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
