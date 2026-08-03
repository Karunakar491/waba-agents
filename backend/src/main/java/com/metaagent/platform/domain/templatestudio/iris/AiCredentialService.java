package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

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

    public record CredentialStatus(boolean configured, String provider, String model) {}

    public CredentialStatus getStatus() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return repository.findByAccountIdAndProvider(accountId, AiProvider.CLAUDE.name())
                .map(c -> new CredentialStatus(true, c.getProvider(), c.getModel()))
                .orElse(new CredentialStatus(false, null, null));
    }

    public Map<String, Object> listOptions() {
        return Map.of("providers", AiProvider.allOptions());
    }

    public void upsert(String provider, String model, String apiKey) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        AiProvider providerEnum = parseProvider(provider);
        if (!providerEnum.allowsModel(model)) {
            throw new BusinessException("Model \"" + model + "\" is not supported for provider " + provider + ".");
        }

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
        AiProviderCredential credential = repository.findByAccountIdAndProvider(accountId, AiProvider.CLAUDE.name())
                .orElseThrow(() -> new BusinessException(
                        "Iris needs an AI provider key configured first — set one up in Settings."));
        return new ResolvedAiCredential(credential.getProvider(), credential.getModel(), secretEncryptor.decrypt(credential.getEncryptedApiKey()));
    }

    private AiProvider parseProvider(String provider) {
        try {
            return AiProvider.valueOf(provider);
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Unsupported provider \"" + provider + "\".");
        }
    }

    record ResolvedAiCredential(String provider, String model, String apiKey) {}
}
