package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.entity.WabaKarixCredential;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.repository.WabaKarixCredentialRepository;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Proxies Template Studio operations to karix-mcp's REST API — this is the
 * ONLY class that calls TemplateStudioClient, same "single point of
 * contact" discipline as MetaApiClient for Meta calls. Tenant isolation:
 * every method verifies the caller's account actually has access to the
 * target WABA (existsByWabaIdAndAccountId) before touching Karix
 * credentials — same fail-closed pattern as AgentAccessService/WabaService.
 */
@Service
@RequiredArgsConstructor
public class TemplateStudioService {

    private final WabaRepository wabaRepository;
    private final WabaAccountAccessRepository wabaAccountAccessRepository;
    private final WabaKarixCredentialRepository credentialRepository;
    private final SecretEncryptor secretEncryptor;
    private final TemplateStudioClient templateStudioClient;

    public Map<String, Object> createTemplate(Long wabaId, Map<String, Object> payload) {
        ResolvedCredential cred = resolveCredential(wabaId);
        return templateStudioClient.createTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), payload);
    }

    public void deleteTemplate(Long wabaId, String templateId) {
        ResolvedCredential cred = resolveCredential(wabaId);
        templateStudioClient.deleteTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), templateId);
    }

    public Map<String, Object> bulkImport(Long wabaId, MultipartFile file) {
        ResolvedCredential cred = resolveCredential(wabaId);
        try {
            return templateStudioClient.bulkImport(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(),
                    file.getOriginalFilename(), file.getBytes());
        } catch (IOException e) {
            throw new BusinessException("Could not read the uploaded file: " + e.getMessage());
        }
    }

    public Map<String, Object> getBulkImportStatus(Long wabaId, String jobId) {
        ResolvedCredential cred = resolveCredential(wabaId);
        return templateStudioClient.getBulkImportStatus(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), jobId);
    }

    public Map<String, Object> listTemplates(Long wabaId, String status) {
        ResolvedCredential cred = resolveCredential(wabaId);
        return templateStudioClient.listTemplates(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), status);
    }

    public Map<String, Object> getTemplate(Long wabaId, String templateId) {
        ResolvedCredential cred = resolveCredential(wabaId);
        return templateStudioClient.getTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), templateId);
    }

    public Map<String, Object> editTemplate(Long wabaId, String templateId, Map<String, Object> payload) {
        ResolvedCredential cred = resolveCredential(wabaId);
        return templateStudioClient.editTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), templateId, payload);
    }

    public Map<String, Object> getAuditLog(Long wabaId, String pathPrefix) {
        ResolvedCredential cred = resolveCredential(wabaId);
        return templateStudioClient.getAuditLog(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), pathPrefix);
    }

    public Map<String, Object> uploadMedia(Long wabaId, String category, MultipartFile file) {
        ResolvedCredential cred = resolveCredential(wabaId);
        try {
            return templateStudioClient.uploadMedia(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(),
                    file.getOriginalFilename(), file.getContentType(), category, file.getBytes());
        } catch (IOException e) {
            throw new BusinessException("Could not read the uploaded file: " + e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private ResolvedCredential resolveCredential(Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        if (!wabaAccountAccessRepository.existsByWabaIdAndAccountId(wabaId, accountId)) {
            throw new NotFoundException("WABA not found");
        }
        Waba waba = wabaRepository.findById(wabaId)
                .orElseThrow(() -> new NotFoundException("WABA not found"));
        WabaKarixCredential credential = credentialRepository.findByWabaId(wabaId)
                .orElseThrow(() -> new BusinessException(
                        "Karix credentials aren't configured for this WABA yet — contact your Karix account manager."));

        return new ResolvedCredential(
                credential.getEsmeAddr(),
                secretEncryptor.decrypt(credential.getEncryptedApiKey()),
                waba.getWabaId());
    }

    private record ResolvedCredential(String esmeAddr, String apiKey, String karixWabaId) {}
}
