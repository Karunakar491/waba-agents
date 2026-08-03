package com.metaagent.platform.domain.waba.entity;

import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

/**
 * Per-WABA Karix RCM API credentials (esme_addr + api_key) — needed to mint
 * a karix-mcp JWT (POST /oauth/token) scoped to THIS waba_id. Separate
 * table from Waba (not a column on it): different lifecycle — staff-entered,
 * rotatable, Karix-issued, not Meta-sourced. Confirmed necessary (not
 * speculative) 2026-08-04: karix-mcp's own auth ties one JWT to one
 * waba_id, and this platform manages many different client WABAs, each
 * requiring its own Karix-issued credential (no single master credential
 * covers all clients).
 *
 * apiKey is encrypted at rest via SecretEncryptor — never stored or logged
 * in plaintext. No GET endpoint ever returns the decrypted value; decrypt
 * only happens at outbound-call time (see TemplateStudioClient).
 */
@Entity
@Table(name = "waba_karix_credential")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WabaKarixCredential {

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    private Long id;

    @Column(name = "waba_id", nullable = false, unique = true)
    private Long wabaId;

    @Column(name = "esme_addr", nullable = false, length = 64)
    private String esmeAddr;

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
