package com.metaagent.platform.domain.iris;

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
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Separate from AiCredentialServiceTest so the platform-default key can be
 * enabled via property override without affecting the "no fallback
 * available" fail-closed test there — a shared Spring context would apply
 * this key to every test in that class.
 */
@TestPropertySource(properties = "iris.default-ai-provider.key=sk-platform-default-key")
class AiCredentialServicePlatformDefaultTest extends IntegrationTestBase {

    @Autowired
    private AiCredentialService credentialService;
    @Autowired
    private AiProviderCredentialRepository credentialRepository;
    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    @BeforeEach
    void setUp() {
        BusinessAccount owner = businessAccountRepository.save(BusinessAccount.builder()
                .name("owner Co")
                .email("owner-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        authenticateAs(owner.getId());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        credentialRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void should_fall_back_to_platform_default_when_account_has_no_key() {
        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.configured()).isFalse();
        assertThat(status.usingPlatformDefault()).isTrue();
        assertThat(status.provider()).isEqualTo("OPENAI");

        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.provider()).isEqualTo("OPENAI");
        assertThat(resolved.apiKey()).isEqualTo("sk-platform-default-key");
        assertThat(resolved.usingPlatformDefault()).isTrue();
    }

    @Test
    void should_prefer_account_key_over_platform_default() {
        credentialService.upsert("CLAUDE", "claude-3-5-sonnet-20241022", "sk-account-key");

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.configured()).isTrue();
        assertThat(status.usingPlatformDefault()).isFalse();

        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.provider()).isEqualTo("CLAUDE");
        assertThat(resolved.apiKey()).isEqualTo("sk-account-key");
        assertThat(resolved.usingPlatformDefault()).isFalse();
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
