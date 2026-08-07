package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * REST surface for Template Studio, proxied through TemplateStudioClient to
 * karix-mcp. Path prefix /api/v1/templates is what ModuleAccessFilter routes
 * to the TEMPLATE_STUDIO entitlement — do not move these off that prefix
 * without updating the filter.
 */
@RestController
@RequestMapping("/api/v1/templates")
@RequiredArgsConstructor
public class TemplateStudioController {

    private final TemplateStudioService templateStudioService;
    private final KarixCredentialService credentialService;

    /** EM-caught gap (2026-08-07 audit): karix-mcp had no health visibility from this platform at all. */
    @GetMapping("/karix-mcp-health")
    public ApiResponse<Map<String, Object>> karixMcpHealth() {
        return ApiResponse.ok(Map.of("healthy", templateStudioService.isKarixMcpHealthy()));
    }

    @PostMapping("/{wabaId}")
    public ApiResponse<Map<String, Object>> createTemplate(@PathVariable Long wabaId, @Valid @RequestBody TemplateRequest request) {
        return ApiResponse.ok(templateStudioService.createTemplate(wabaId, request.toKarixPayload()));
    }

    @DeleteMapping("/{wabaId}/{templateId}")
    public ApiResponse<Void> deleteTemplate(@PathVariable Long wabaId, @PathVariable String templateId) {
        templateStudioService.deleteTemplate(wabaId, templateId);
        return ApiResponse.ok();
    }

    @GetMapping("/{wabaId}")
    public ApiResponse<Map<String, Object>> listTemplates(@PathVariable Long wabaId,
                                                           @RequestParam(required = false) String status) {
        return ApiResponse.ok(templateStudioService.listTemplates(wabaId, status));
    }

    @GetMapping("/{wabaId}/audit-log")
    public ApiResponse<Map<String, Object>> getAuditLog(@PathVariable Long wabaId,
                                                         @RequestParam(required = false) String pathPrefix) {
        return ApiResponse.ok(templateStudioService.getAuditLog(wabaId, pathPrefix));
    }

    @GetMapping("/{wabaId}/{templateId}")
    public ApiResponse<Map<String, Object>> getTemplate(@PathVariable Long wabaId, @PathVariable String templateId) {
        return ApiResponse.ok(templateStudioService.getTemplate(wabaId, templateId));
    }

    @PostMapping("/{wabaId}/{templateId}/edit")
    public ApiResponse<Map<String, Object>> editTemplate(@PathVariable Long wabaId, @PathVariable String templateId,
                                                          @Valid @RequestBody EditTemplateRequest request) {
        return ApiResponse.ok(templateStudioService.editTemplate(wabaId, templateId, request.toKarixPayload()));
    }

    @PostMapping(value = "/{wabaId}/media", consumes = "multipart/form-data")
    public ApiResponse<Map<String, Object>> uploadMedia(@PathVariable Long wabaId,
                                                         @RequestParam("category") String category,
                                                         @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(templateStudioService.uploadMedia(wabaId, category, file));
    }

    @PostMapping(value = "/{wabaId}/bulk-import", consumes = "multipart/form-data")
    public ApiResponse<Map<String, Object>> bulkImport(@PathVariable Long wabaId, @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(templateStudioService.bulkImport(wabaId, file));
    }

    @GetMapping("/{wabaId}/bulk-import/{jobId}")
    public ApiResponse<Map<String, Object>> getBulkImportStatus(@PathVariable Long wabaId, @PathVariable String jobId) {
        return ApiResponse.ok(templateStudioService.getBulkImportStatus(wabaId, jobId));
    }

    @GetMapping("/{wabaId}/phone-mappings")
    public ApiResponse<List<KarixCredentialService.MappingView>> listMappings(@PathVariable Long wabaId) {
        return ApiResponse.ok(credentialService.listMappings(wabaId));
    }

    @GetMapping("/{wabaId}/unmapped-phones")
    public ApiResponse<List<String>> listUnmappedPhoneNumbers(@PathVariable Long wabaId) {
        return ApiResponse.ok(credentialService.listUnmappedPhoneNumbers(wabaId));
    }

    @GetMapping("/esme-options")
    public ApiResponse<List<KarixCredentialService.EsmeOption>> listEsmeOptions() {
        return ApiResponse.ok(credentialService.listEsmeOptions());
    }

    @PostMapping("/{wabaId}/phone-mappings/existing-esme")
    public ApiResponse<Void> mapToExistingEsme(@PathVariable Long wabaId, @Valid @RequestBody MapExistingEsmeRequest request) {
        credentialService.mapToExistingEsme(wabaId, request.phoneNumberId(), request.esmeCredentialId());
        return ApiResponse.ok();
    }

    @PostMapping("/{wabaId}/phone-mappings/new-esme")
    public ApiResponse<Void> mapToNewEsme(@PathVariable Long wabaId, @Valid @RequestBody MapNewEsmeRequest request) {
        credentialService.mapToNewEsme(wabaId, request.phoneNumberId(), request.esmeAddr(), request.label(), request.apiKey());
        return ApiResponse.ok();
    }

    /**
     * FIX-034 (2026-08-07 audit): a phone mapped to the wrong esme credential
     * previously had no fix path short of a raw DB update — this closes it.
     */
    @PutMapping("/{wabaId}/phone-mappings/existing-esme")
    public ApiResponse<Void> remapToExistingEsme(@PathVariable Long wabaId, @Valid @RequestBody MapExistingEsmeRequest request) {
        credentialService.remapToExistingEsme(wabaId, request.phoneNumberId(), request.esmeCredentialId());
        return ApiResponse.ok();
    }
}
