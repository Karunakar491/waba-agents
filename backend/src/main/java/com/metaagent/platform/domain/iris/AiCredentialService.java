package com.metaagent.platform.domain.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

/**
 * BYOK credential CRUD for Iris — account-scoped, closed-set provider/model
 * (AiProvider), same fail-closed + never-return-raw-key discipline as
 * KarixCredentialService. Server validates provider/model against the
 * enum on every write — the frontend dropdown is never trusted alone.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiCredentialService {

    private final AiProviderCredentialRepository repository;
    private final AiDailyTokenUsageRepository usageRepository;
    private final SecretEncryptor secretEncryptor;

    @Value("${iris.default-ai-provider.provider}")
    private String defaultProvider;

    @Value("${iris.default-ai-provider.model}")
    private String defaultModel;

    /** Blank unless IRIS_DEFAULT_OPENAI_API_KEY is set on the server — never a literal key in source. */
    @Value("${iris.default-ai-provider.key}")
    private String defaultApiKey;

    @Value("${iris.openai-tier.primary-model}")
    private String tierPrimaryModel;

    @Value("${iris.openai-tier.fallback-model}")
    private String tierFallbackModel;

    @Value("${iris.openai-tier.daily-token-budget}")
    private long tierDailyTokenBudget;

    /**
     * 5th field (2026-08-19): the OPENAI tier switch below can pick a
     * different model than whatever the account's own credential or
     * platform default says, so callers need to see what's ACTUALLY
     * running today, not just what's configured -- never a silent
     * divergence between Settings and reality (EM-required).
     */
    public record CredentialStatus(boolean configured, String provider, String model, boolean usingPlatformDefault, String actualModelInUse) {}

    public CredentialStatus getStatus() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return firstCredentialForAccount(accountId)
                .map(c -> new CredentialStatus(true, c.getProvider(), c.getModel(), false, actualModelFor(accountId, c.getProvider(), c.getModel())))
                .orElseGet(() -> hasPlatformDefault()
                        ? new CredentialStatus(false, defaultProvider, defaultModel, true, actualModelFor(accountId, defaultProvider, defaultModel))
                        : new CredentialStatus(false, null, null, false, null));
    }

    private boolean hasPlatformDefault() {
        return defaultApiKey != null && !defaultApiKey.isBlank();
    }

    /**
     * OPENAI-only daily-budget tier switch (2026-08-19): while the account's
     * combined usage on OpenAI's shared free mini-tier bucket is under
     * budget for today, use the better model; once exhausted, the cheaper
     * one for the rest of the day. Deliberately never touches the real
     * advanced tier (gpt-5.4/gpt-5.1/etc.) -- founder's explicit scope
     * choice.
     *
     * EL-caught gap (2026-08-19): only applies when the account's own
     * configured model IS one of the two tier models -- an account that
     * deliberately chose gpt-4o or gpt-4o-mini (still valid OPENAI choices,
     * see AiProvider) must never be silently remapped onto a mini model it
     * never picked. Every other provider/model passes through unchanged.
     */
    private String actualModelFor(Long accountId, String provider, String configuredModel) {
        boolean inTierProgram = AiProvider.OPENAI.name().equals(provider)
                && (tierPrimaryModel.equals(configuredModel) || tierFallbackModel.equals(configuredModel));
        if (!inTierProgram) return configuredModel;
        long usedToday = usageRepository.findByAccountIdAndUsageDate(accountId, LocalDate.now())
                .map(AiDailyTokenUsage::getTokensUsed).orElse(0L);
        return usedToday < tierDailyTokenBudget ? tierPrimaryModel : tierFallbackModel;
    }

    /** Called by IrisConversationService after a real OpenAI turn -- no-op for other providers. */
    public void recordUsage(String provider, Integer totalTokens) {
        if (!AiProvider.OPENAI.name().equals(provider) || totalTokens == null || totalTokens <= 0) return;
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        usageRepository.increment(accountId, LocalDate.now(), totalTokens);
        log.info("recordUsage: accountId={} provider=OPENAI tokens={}", accountId, totalTokens);
    }

    public Map<String, Object> listOptions() {
        return Map.of("providers", AiProvider.allOptions());
    }

    /**
     * EL-caught bug (2026-08-07 audit): the delete-old-provider-rows +
     * save-new-row sequence used to be two unguarded steps — a crash between
     * them left the account with zero credentials, contradicting Iris's own
     * "no key configured" vs "key configured" status. Wrapped in one
     * transaction so it's all-or-nothing.
     */
    @Transactional
    public void upsert(String provider, String model, String apiKey) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        AiProvider providerEnum = parseProvider(provider);
        if (!providerEnum.allowsModel(model)) {
            throw new BusinessException("Model \"" + model + "\" is not supported for provider " + provider + ".");
        }

        // Enforce "one active provider per account" — switching providers
        // replaces the old one rather than leaving two rows, which would
        // make firstCredentialForAccount()'s pick non-deterministic.
        repository.findAllByAccountId(accountId).stream()
                .filter(c -> !c.getProvider().equals(providerEnum.name()))
                .forEach(repository::delete);

        AiProviderCredential credential = repository.findByAccountIdAndProvider(accountId, providerEnum.name())
                .orElseGet(() -> AiProviderCredential.builder().accountId(accountId).provider(providerEnum.name()).build());
        credential.setModel(model);
        credential.setEncryptedApiKey(secretEncryptor.encrypt(apiKey));
        try {
            repository.save(credential);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("A credential for this provider is already configured.");
        }
    }

    /** Decrypted key + model — only ever called from IrisConversationService, never returned via any GET endpoint. */
    ResolvedAiCredential resolveForConversation() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return firstCredentialForAccount(accountId)
                .map(c -> new ResolvedAiCredential(c.getProvider(), actualModelFor(accountId, c.getProvider(), c.getModel()), secretEncryptor.decrypt(c.getEncryptedApiKey()), false))
                .orElseGet(() -> {
                    if (!hasPlatformDefault()) {
                        throw new BusinessException("Iris needs an AI provider key configured first — set one up in Settings.");
                    }
                    return new ResolvedAiCredential(defaultProvider, actualModelFor(accountId, defaultProvider, defaultModel), defaultApiKey, true);
                });
    }

    private AiProvider parseProvider(String provider) {
        try {
            return AiProvider.valueOf(provider);
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Unsupported provider \"" + provider + "\".");
        }
    }

    /**
     * EL-caught bug (2026-08-04): getStatus()/resolveForConversation() used
     * to hardcode AiProvider.CLAUDE.name(), so an account that configured
     * NVIDIA_LLAMA (or any non-CLAUDE provider) would silently never be
     * found — Iris would claim "no key configured" even with one saved.
     * An account has one ACTIVE provider at a time in practice; this picks
     * whichever one exists rather than assuming which provider it is.
     */
    private java.util.Optional<AiProviderCredential> firstCredentialForAccount(Long accountId) {
        return repository.findAllByAccountId(accountId).stream().findFirst();
    }

    record ResolvedAiCredential(String provider, String model, String apiKey, boolean usingPlatformDefault) {}
}
