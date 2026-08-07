package com.metaagent.platform.domain.waba.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * A Karix esme_addr identity (one api_key each) — replaces waba_karix_credential
 * (2026-08-04, was wrongly modeled as one-credential-per-WABA). An esme_addr
 * carries no waba_id: the same esme_addr can serve phone numbers under
 * different WABAs (confirmed by founder). Scoping is by account_id only —
 * which WABA(s) it's actually used for is entirely a property of
 * PhoneEsmeMapping rows, not of this credential.
 *
 * encryptedApiKey is AES-256-GCM ciphertext (SecretEncryptor) — never stored
 * or logged in plaintext, never returned by any GET endpoint.
 */
@Entity
@Table(name = "karix_esme_credential")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KarixEsmeCredential {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class) // TSIDs overflow JS Number.MAX_SAFE_INTEGER
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "esme_addr", nullable = false, unique = true, length = 64)
    private String esmeAddr;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "encrypted_api_key", nullable = false, columnDefinition = "TEXT")
    private String encryptedApiKey;

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
