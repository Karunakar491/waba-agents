package com.metaagent.platform.domain.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Real MySQL via Testcontainers, real SecretEncryptor round-trip. Covers
 * the closed-set provider/model validation (never trust the frontend
 * dropdown alone) and that no DTO ever carries the raw or encrypted key.
 */
class AiCredentialServiceTest extends IntegrationTestBase {

    @Autowired
    private AiCredentialService credentialService;
    @Autowired
    private AiProviderCredentialRepository credentialRepository;
    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    private Long accountId;

    @BeforeEach
    void setUp() {
        BusinessAccount owner = businessAccountRepository.save(BusinessAccount.builder()
                .name("owner Co")
                .email("owner-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = owner.getId();
        authenticateAs(accountId);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        credentialRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void should_save_and_report_status_without_exposing_key() {
        credentialService.upsert("CLAUDE", "claude-3-5-sonnet-20241022", "sk-real-key-abc");

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.configured()).isTrue();
        assertThat(status.provider()).isEqualTo("CLAUDE");
        assertThat(status.model()).isEqualTo("claude-3-5-sonnet-20241022");
        assertThat(status.usingPlatformDefault()).isFalse();
        // CredentialStatus has exactly 4 fields (configured/provider/model/
        // usingPlatformDefault) — no field exists to accidentally expose the
        // key even if someone tried.
        assertThat(AiCredentialService.CredentialStatus.class.getRecordComponents()).hasSize(4);
    }

    @Test
    void should_reject_unsupported_provider() {
        assertThatThrownBy(() -> credentialService.upsert("GEMINI", "gemini-1.5-pro", "sk-key"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Unsupported provider");
    }

    @Test
    void should_reject_model_not_in_providers_allowlist() {
        assertThatThrownBy(() -> credentialService.upsert("CLAUDE", "gpt-4o", "sk-key"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not supported");
    }

    @Test
    void should_work_for_a_non_claude_provider_not_just_claude() {
        // EL-caught bug: getStatus()/resolveForConversation() used to
        // hardcode AiProvider.CLAUDE.name(), so a NVIDIA_LLAMA credential
        // was silently invisible to both — Iris claimed "not configured"
        // even with a real key saved.
        credentialService.upsert("NVIDIA_LLAMA", "meta/llama-3.3-70b-instruct", "nvapi-real-key");

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.configured()).isTrue();
        assertThat(status.provider()).isEqualTo("NVIDIA_LLAMA");

        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.provider()).isEqualTo("NVIDIA_LLAMA");
        assertThat(resolved.apiKey()).isEqualTo("nvapi-real-key");
    }

    @Test
    void should_replace_prior_provider_when_switching() {
        credentialService.upsert("CLAUDE", "claude-3-5-sonnet-20241022", "sk-claude-key");
        credentialService.upsert("NVIDIA_LLAMA", "meta/llama-3.3-70b-instruct", "nvapi-new-key");

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.provider()).isEqualTo("NVIDIA_LLAMA");
        assertThat(credentialRepository.findAll()).hasSize(1);
    }

    @Test
    void should_decrypt_real_key_for_conversation_use() {
        credentialService.upsert("CLAUDE", "claude-3-5-haiku-20241022", "sk-real-key-xyz");
        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.apiKey()).isEqualTo("sk-real-key-xyz");
        assertThat(resolved.model()).isEqualTo("claude-3-5-haiku-20241022");
    }

    @Test
    void should_fail_closed_when_no_credential_configured() {
        assertThatThrownBy(() -> credentialService.resolveForConversation())
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("needs an AI provider key");
    }

    private void authenticateAs(Long accId) {
        TenantDetails tenantDetails = new TenantDetails(accId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }
}
