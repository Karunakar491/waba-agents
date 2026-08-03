package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.waba.entity.WabaKarixCredential;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.repository.WabaKarixCredentialRepository;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Admin-entry path for per-WABA Karix credentials (esme_addr + api_key) —
 * staff-entered once Karix issues them for a client's WABA, no self-serve
 * flow. The API key is NEVER returned once saved (see getStatus()) —
 * decrypt only happens inside TemplateStudioService at outbound-call time.
 */
@Service
@RequiredArgsConstructor
public class WabaKarixCredentialService {

    private final WabaAccountAccessRepository wabaAccountAccessRepository;
    private final WabaKarixCredentialRepository credentialRepository;
    private final SecretEncryptor secretEncryptor;

    public void upsert(Long wabaId, String esmeAddr, String apiKey) {
        requireAccess(wabaId);
        WabaKarixCredential credential = credentialRepository.findByWabaId(wabaId)
                .orElseGet(() -> WabaKarixCredential.builder().wabaId(wabaId).build());
        credential.setEsmeAddr(esmeAddr);
        credential.setEncryptedApiKey(secretEncryptor.encrypt(apiKey));
        credentialRepository.save(credential);
    }

    /** Existence + esmeAddr only — never the API key, encrypted or not. */
    public CredentialStatus getStatus(Long wabaId) {
        requireAccess(wabaId);
        return credentialRepository.findByWabaId(wabaId)
                .map(c -> new CredentialStatus(true, c.getEsmeAddr()))
                .orElse(new CredentialStatus(false, null));
    }

    private void requireAccess(Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        if (!wabaAccountAccessRepository.existsByWabaIdAndAccountId(wabaId, accountId)) {
            throw new NotFoundException("WABA not found");
        }
    }

    public record CredentialStatus(boolean configured, String esmeAddr) {}
}
