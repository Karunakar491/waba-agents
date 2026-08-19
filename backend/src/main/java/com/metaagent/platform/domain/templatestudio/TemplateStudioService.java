package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.waba.entity.KarixEsmeCredential;
import com.metaagent.platform.domain.waba.entity.PhoneEsmeMapping;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.KarixEsmeCredentialRepository;
import com.metaagent.platform.domain.waba.repository.PhoneEsmeMappingRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateStudioService {

    private final WabaRepository wabaRepository;
    private final WabaAccessGuard wabaAccessGuard;
    private final PhoneEsmeMappingRepository phoneEsmeMappingRepository;
    private final KarixEsmeCredentialRepository esmeCredentialRepository;
    private final SecretEncryptor secretEncryptor;
    private final TemplateStudioClient templateStudioClient;

    /**
     * EM-caught gap (2026-08-07 audit): no health check existed for karix-mcp
     * despite it being a critical-path dependency for both Iris and Template
     * Studio. No tenant/WABA scoping needed — karix-mcp's /health is
     * unauthenticated and account-agnostic.
     */
    public boolean isKarixMcpHealthy() {
        return templateStudioClient.isHealthy();
    }

    public Map<String, Object> createTemplate(Long wabaId, Map<String, Object> payload) {
        ResolvedCredential cred = resolveCredential(wabaId);
        log.info("createTemplate: wabaId={} karixWabaId={} templateName={}", wabaId, cred.karixWabaId(), payload.get("template_name"));
        Map<String, Object> result = templateStudioClient.createTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), payload);
        log.info("createTemplate result: wabaId={} responseKeys={}", wabaId, result != null ? result.keySet() : null);
        return result;
    }

    public void deleteTemplate(Long wabaId, String templateId) {
        ResolvedCredential cred = resolveCredential(wabaId);
        log.info("deleteTemplate: wabaId={} karixWabaId={} templateId={}", wabaId, cred.karixWabaId(), templateId);
        templateStudioClient.deleteTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), templateId);
        log.info("deleteTemplate succeeded: wabaId={} templateId={}", wabaId, templateId);
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
        log.info("editTemplate: wabaId={} karixWabaId={} templateId={}", wabaId, cred.karixWabaId(), templateId);
        Map<String, Object> result = templateStudioClient.editTemplate(cred.esmeAddr(), cred.apiKey(), cred.karixWabaId(), templateId, payload);
        log.info("editTemplate result: wabaId={} templateId={} responseKeys={}", wabaId, templateId, result != null ? result.keySet() : null);
        return result;
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

    /**
     * Template operations are approved by Meta at the WABA level, not per
     * phone number, so any phone's mapped esme_addr credential under this
     * WABA is equally valid for a create/edit/list call — picks the
     * earliest-configured mapping deterministically (2026-08-19: switched
     * from unordered findFirstByWabaId, which could silently resolve a
     * stale/mismatched esme credential when a WABA had more than one phone
     * mapping, causing Karix to return an empty template list even though
     * a valid credential existed on a different mapping for the same WABA).
     */
    public ResolvedCredential resolveCredential(Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        wabaAccessGuard.requireAccess(wabaId, accountId);
        Waba waba = wabaRepository.findById(wabaId)
                .orElseThrow(() -> new NotFoundException("WABA not found"));
        PhoneEsmeMapping mapping = phoneEsmeMappingRepository.findFirstByWabaIdOrderByIdAsc(wabaId)
                .orElseThrow(() -> new BusinessException(
                        "No phone number on this WABA has a Karix credential configured yet — set one up in Settings."));
        KarixEsmeCredential credential = esmeCredentialRepository.findById(mapping.getEsmeCredentialId())
                .orElseThrow(() -> new BusinessException("Karix credential not found for the mapped phone number."));

        log.info("resolveCredential: wabaId={} resolved esmeAddr={} via phoneEsmeMapping.id={} (deterministic, oldest mapping)",
                wabaId, credential.getEsmeAddr(), mapping.getId());
        return new ResolvedCredential(
                credential.getEsmeAddr(),
                secretEncryptor.decrypt(credential.getEncryptedApiKey()),
                waba.getWabaId());
    }

    /** Public so KarixMessagingClient (Iris's in-house send capability) can reuse this same resolution — never duplicate it. */
    public record ResolvedCredential(String esmeAddr, String apiKey, String karixWabaId) {}
}
