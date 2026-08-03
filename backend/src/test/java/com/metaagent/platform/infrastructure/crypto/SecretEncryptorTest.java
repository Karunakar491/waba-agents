package com.metaagent.platform.infrastructure.crypto;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecretEncryptorTest {

    private static final String KEY_A = Base64.getEncoder().encodeToString("a".repeat(32).getBytes());
    private static final String KEY_B = Base64.getEncoder().encodeToString("b".repeat(32).getBytes());

    @Test
    void should_round_trip_encrypt_and_decrypt() {
        SecretEncryptor encryptor = new SecretEncryptor(KEY_A);
        String plaintext = "sk_live_karix_api_key_abc123";

        String encrypted = encryptor.encrypt(plaintext);

        assertThat(encrypted).isNotEqualTo(plaintext);
        assertThat(encryptor.decrypt(encrypted)).isEqualTo(plaintext);
    }

    @Test
    void should_produce_different_ciphertext_each_call_same_plaintext() {
        // Random IV per call — same plaintext must not produce identical
        // ciphertext twice (would leak that two secrets are equal).
        SecretEncryptor encryptor = new SecretEncryptor(KEY_A);
        String plaintext = "same-secret";

        String first = encryptor.encrypt(plaintext);
        String second = encryptor.encrypt(plaintext);

        assertThat(first).isNotEqualTo(second);
        assertThat(encryptor.decrypt(first)).isEqualTo(plaintext);
        assertThat(encryptor.decrypt(second)).isEqualTo(plaintext);
    }

    @Test
    void should_fail_to_decrypt_with_wrong_key() {
        SecretEncryptor encryptorA = new SecretEncryptor(KEY_A);
        SecretEncryptor encryptorB = new SecretEncryptor(KEY_B);
        String encrypted = encryptorA.encrypt("secret");

        assertThatThrownBy(() -> encryptorB.decrypt(encrypted))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void should_fail_to_decrypt_tampered_ciphertext() {
        SecretEncryptor encryptor = new SecretEncryptor(KEY_A);
        String encrypted = encryptor.encrypt("secret");
        byte[] bytes = Base64.getDecoder().decode(encrypted);
        bytes[bytes.length - 1] ^= 0x01; // flip a bit in the GCM tag/ciphertext
        String tampered = Base64.getEncoder().encodeToString(bytes);

        assertThatThrownBy(() -> encryptor.decrypt(tampered))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void should_reject_a_key_that_is_not_32_bytes() {
        String shortKey = Base64.getEncoder().encodeToString("too-short".getBytes());
        assertThatThrownBy(() -> new SecretEncryptor(shortKey))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }
}
