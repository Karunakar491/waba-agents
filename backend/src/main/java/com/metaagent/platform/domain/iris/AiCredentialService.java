package com.metaagent.platform.domain.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * BYOK credential CRUD for Iris — account-scoped, closed-set provider/model
 * (AiProvider), same fail-closed + never-return-raw-key discipline as
 * KarixCredentialService. Server validates provider/model against the
 * enum on every write — the frontend dropdown is never trusted alone.
 */
@Service
@RequiredArgsConstructor
public class AiCredentialService {

    private final AiProviderCredentialRepository repository;
    private final SecretEncryptor secretEncryptor;

    @Value("${iris.default-ai-provider.provider}")
    private String defaultProvider;

    @Value("${iris.default-ai-provider.model}")
    private String defaultModel;

    /** Blank unless IRIS_DEFAULT_OPENAI_API_KEY is set on the server — never a literal key in source. */
    @Value("${iris.default-ai-provider.key}")
    private String defaultApiKey;

    public record CredentialStatus(boolean configured, String provider, String model, boolean usingPlatformDefault) {}

    public CredentialStatus getStatus() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return firstCredentialForAccount(accountId)
                .map(c -> new CredentialStatus(true, c.getProvider(), c.getModel(), false))
                .orElseGet(() -> hasPlatformDefault()
                        ? new CredentialStatus(false, defaultProvider, defaultModel, true)
                        : new CredentialStatus(false, null, null, false));
    }

    private boolean hasPlatformDefault() {
        return defaultApiKey != null && !defaultApiKey.isBlank();
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
                .map(c -> new ResolvedAiCredential(c.getProvider(), c.getModel(), secretEncryptor.decrypt(c.getEncryptedApiKey()), false))
                .orElseGet(() -> {
                    if (!hasPlatformDefault()) {
                        throw new BusinessException("Iris needs an AI provider key configured first — set one up in Settings.");
                    }
                    return new ResolvedAiCredential(defaultProvider, defaultModel, defaultApiKey, true);
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
