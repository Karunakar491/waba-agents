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

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 2026-08-19 OpenAI mini-tier daily-budget switch. Separate test class (not
 * added to AiCredentialServiceTest) so the property override doesn't affect
 * that class's own tests, same reasoning as AiCredentialServicePlatformDefaultTest.
 */
@TestPropertySource(properties = {
        "iris.openai-tier.primary-model=gpt-5.4-mini",
        "iris.openai-tier.fallback-model=gpt-5-mini",
        "iris.openai-tier.daily-token-budget=1000",
})
class AiCredentialServiceTierSwitchTest extends IntegrationTestBase {

    @Autowired
    private AiCredentialService credentialService;
    @Autowired
    private AiDailyTokenUsageRepository usageRepository;
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
        credentialService.upsert("OPENAI", "gpt-5.4-mini", "sk-openai-key");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        usageRepository.deleteAll();
        credentialRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void should_use_primary_model_when_under_daily_budget() {
        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.actualModelInUse()).isEqualTo("gpt-5.4-mini");

        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.model()).isEqualTo("gpt-5.4-mini");
    }

    @Test
    void should_switch_to_fallback_model_once_daily_budget_is_exceeded() {
        usageRepository.increment(accountId, LocalDate.now(), 1500);

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.actualModelInUse()).isEqualTo("gpt-5-mini");

        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.model()).isEqualTo("gpt-5-mini");
    }

    @Test
    void recordUsage_increments_the_daily_counter_atomically() {
        credentialService.recordUsage("OPENAI", 400);
        credentialService.recordUsage("OPENAI", 300);

        long total = usageRepository.findByAccountIdAndUsageDate(accountId, LocalDate.now())
                .map(AiDailyTokenUsage::getTokensUsed).orElse(0L);
        assertThat(total).isEqualTo(700);
    }

    @Test
    void recordUsage_is_a_no_op_for_non_openai_providers_and_null_tokens() {
        credentialService.recordUsage("CLAUDE", 500);
        credentialService.recordUsage("OPENAI", null);

        assertThat(usageRepository.findByAccountIdAndUsageDate(accountId, LocalDate.now())).isEmpty();
    }

    @Test
    void does_not_remap_an_account_that_deliberately_configured_a_non_tier_openai_model() {
        // gpt-4o is still a valid OPENAI choice (see AiProvider) -- an account
        // that picked it deliberately must never be silently swapped onto a
        // tier model it never chose, even with the daily budget blown way over.
        credentialService.upsert("OPENAI", "gpt-4o", "sk-openai-gpt4o-key");
        usageRepository.increment(accountId, LocalDate.now(), 5000);

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.model()).isEqualTo("gpt-4o");
        assertThat(status.actualModelInUse()).isEqualTo("gpt-4o");

        AiCredentialService.ResolvedAiCredential resolved = credentialService.resolveForConversation();
        assertThat(resolved.model()).isEqualTo("gpt-4o");
    }

    @Test
    void tiering_does_not_affect_non_openai_providers() {
        credentialService.upsert("CLAUDE", "claude-3-5-sonnet-20241022", "sk-claude-key");
        usageRepository.increment(accountId, LocalDate.now(), 5000);

        AiCredentialService.CredentialStatus status = credentialService.getStatus();
        assertThat(status.provider()).isEqualTo("CLAUDE");
        assertThat(status.actualModelInUse()).isEqualTo("claude-3-5-sonnet-20241022");
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
