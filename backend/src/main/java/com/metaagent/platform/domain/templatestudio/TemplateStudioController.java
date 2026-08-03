package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
    private final WabaKarixCredentialService credentialService;

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

    @GetMapping("/{wabaId}/karix-credential")
    public ApiResponse<WabaKarixCredentialService.CredentialStatus> getCredentialStatus(@PathVariable Long wabaId) {
        return ApiResponse.ok(credentialService.getStatus(wabaId));
    }

    @PutMapping("/{wabaId}/karix-credential")
    public ApiResponse<Void> upsertCredential(@PathVariable Long wabaId, @Valid @RequestBody KarixCredentialRequest request) {
        credentialService.upsert(wabaId, request.esmeAddr(), request.apiKey());
        return ApiResponse.ok();
    }
}
