package com.metaagent.platform.domain.agent.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.agent.dto.AgentRequest;
import com.metaagent.platform.domain.agent.dto.AllowlistRequest;
import com.metaagent.platform.domain.agent.dto.AudienceRequest;
import com.metaagent.platform.domain.agent.dto.AgentTestRequest;
import com.metaagent.platform.domain.agent.dto.AgentTestResponse;
import com.metaagent.platform.domain.agent.dto.BindPhoneRequest;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.GenerateDefaultsRequest;
import com.metaagent.platform.domain.agent.dto.GenerateDefaultsResponse;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.dto.UiSkillRequest;
import com.metaagent.platform.domain.agent.dto.WebsiteRequest;
import com.metaagent.platform.domain.agent.entity.*;
import com.metaagent.platform.domain.agent.service.AgentDefaultsService;
import com.metaagent.platform.domain.agent.service.AgentDeployService;
import com.metaagent.platform.domain.agent.service.AgentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final AgentDeployService agentDeployService;
    private final AgentDefaultsService agentDefaultsService;

    @PostMapping("/generate-defaults")
    public ApiResponse<GenerateDefaultsResponse> generateDefaults(@Valid @RequestBody GenerateDefaultsRequest request) {
        return ApiResponse.ok(agentDefaultsService.generateDefaults(request.businessDescription()));
    }

    @PostMapping
    public ApiResponse<Agent> createAgent(@Valid @RequestBody AgentRequest request) {
        Agent agent = agentService.createAgent(request);
        return ApiResponse.ok(agent);
    }

    @GetMapping
    public ApiResponse<List<Agent>> listAgents() {
        List<Agent> agents = agentService.listAgents();
        return ApiResponse.ok(agents);
    }

    @GetMapping("/{id}")
    public ApiResponse<Agent> getAgent(@PathVariable Long id) {
        Agent agent = agentService.getAgent(id);
        return ApiResponse.ok(agent);
    }

    @PutMapping("/{id}")
    public ApiResponse<Agent> updateAgent(@PathVariable Long id, @Valid @RequestBody AgentRequest request) {
        Agent agent = agentService.updateAgent(id, request);
        return ApiResponse.ok(agent);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteAgent(@PathVariable Long id) {
        agentService.deleteAgent(id);
        return ApiResponse.ok();
    }

    @PutMapping("/{id}/phone")
    public ApiResponse<Agent> bindPhone(@PathVariable Long id, @Valid @RequestBody BindPhoneRequest request) {
        Agent agent = agentService.bindPhone(id, request.phoneNumberId(), request.wabaId());
        return ApiResponse.ok(agent);
    }

    /** Founder-caught gap (2026-08-07): frontend already called this exact path, it never existed. */
    @PostMapping("/{id}/refresh-name")
    public ApiResponse<Agent> refreshName(@PathVariable Long id) {
        return ApiResponse.ok(agentService.refreshName(id));
    }

    @PostMapping("/{id}/deploy")
    public ApiResponse<Agent> deployAgent(@PathVariable Long id) {
        Agent agent = agentDeployService.deploy(id);
        return ApiResponse.ok(agent);
    }

    @PostMapping("/{id}/test")
    public ApiResponse<AgentTestResponse> testAgent(
            @PathVariable Long id,
            @Valid @RequestBody AgentTestRequest request) {
        return ApiResponse.ok(agentDeployService.test(id, request));
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<Agent> pauseAgent(@PathVariable Long id) {
        Agent agent = agentDeployService.pause(id);
        return ApiResponse.ok(agent);
    }

    @GetMapping("/{id}/settings")
    public ApiResponse<List<?>> getSettings(@PathVariable Long id) {
        return ApiResponse.ok(agentDeployService.getSettings(id));
    }

    @PutMapping("/{id}/settings/audience")
    public ApiResponse<Void> updateAiAudience(@PathVariable Long id, @Valid @RequestBody AudienceRequest request) {
        agentDeployService.updateAiAudience(id, request.aiAudience());
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/allowlist")
    public ApiResponse<List<Object>> getAllowlist(@PathVariable Long id) {
        return ApiResponse.ok(agentDeployService.getAllowlist(id));
    }

    @PostMapping("/{id}/allowlist")
    public ApiResponse<Map<String, Object>> addToAllowlist(@PathVariable Long id, @Valid @RequestBody AllowlistRequest request) {
        return ApiResponse.ok(agentDeployService.addToAllowlist(id, request.consumerPhoneNumber()));
    }

    @DeleteMapping("/{id}/allowlist/{entryId}")
    public ApiResponse<Void> removeFromAllowlist(@PathVariable Long id, @PathVariable String entryId) {
        agentDeployService.removeFromAllowlist(id, entryId);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}/meta-agent")
    public ApiResponse<Agent> deleteFromMeta(@PathVariable Long id) {
        Agent agent = agentDeployService.deleteFromMeta(id);
        return ApiResponse.ok(agent);
    }

    // ── Agent Event ───────────────────────────────────────────────────────────

    @PostMapping("/{id}/events")
    public ApiResponse<Map<String, Object>> triggerEvent(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.triggerEvent(id, payload));
    }

    @GetMapping("/{id}/events/{agentEventId}")
    public ApiResponse<Map<String, Object>> getEventStatus(@PathVariable Long id, @PathVariable String agentEventId) {
        return ApiResponse.ok(agentDeployService.getEventStatus(id, agentEventId));
    }

    // "to" (thread-control.md: consumer phone number / WhatsApp ID) is optional
    // but recommended — without it, release() targets the whole number rather
    // than a specific conversation. Pass it whenever the operator is releasing
    // control from a specific conversation's inbox view.
    @PostMapping("/{id}/thread-control/release")
    public ApiResponse<Void> releaseThreadControl(@PathVariable Long id, @RequestParam(required = false) String to) {
        agentDeployService.releaseThreadControl(id, to);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/skills")
    public ApiResponse<List<AgentSkill>> getSkills(@PathVariable Long id) {
        return ApiResponse.ok(agentService.getSkills(id));
    }

    @PostMapping("/{id}/skills")
    public ApiResponse<AgentSkill> addSkill(@PathVariable Long id, @Valid @RequestBody SkillRequest request) {
        AgentSkill skill = agentService.addSkill(id, request);
        return ApiResponse.ok(skill);
    }

    @GetMapping("/{id}/skills/{skillId}")
    public ApiResponse<AgentSkill> getSkill(@PathVariable Long id, @PathVariable Long skillId) {
        return ApiResponse.ok(agentService.getSkill(id, skillId));
    }

    @PutMapping("/{id}/skills/{skillId}")
    public ApiResponse<AgentSkill> updateSkill(@PathVariable Long id, @PathVariable Long skillId, @Valid @RequestBody SkillRequest request) {
        return ApiResponse.ok(agentService.updateSkill(id, skillId, request));
    }

    @DeleteMapping("/{id}/skills/{skillId}")
    public ApiResponse<Void> deleteSkill(@PathVariable Long id, @PathVariable Long skillId) {
        agentService.deleteSkill(id, skillId);
        return ApiResponse.ok();
    }

    // --- UI Skills (F22) — rich-message component skills, distinct from plain text-instruction skills above ---

    @GetMapping("/{id}/ui-skills")
    public ApiResponse<List<AgentUiSkill>> getUiSkills(@PathVariable Long id) {
        return ApiResponse.ok(agentService.getUiSkills(id));
    }

    @PostMapping("/{id}/ui-skills")
    public ApiResponse<AgentUiSkill> addUiSkill(@PathVariable Long id, @Valid @RequestBody UiSkillRequest request) {
        return ApiResponse.ok(agentService.addUiSkill(id, request));
    }

    @GetMapping("/{id}/ui-skills/{uiSkillId}")
    public ApiResponse<AgentUiSkill> getUiSkill(@PathVariable Long id, @PathVariable Long uiSkillId) {
        return ApiResponse.ok(agentService.getUiSkill(id, uiSkillId));
    }

    @PutMapping("/{id}/ui-skills/{uiSkillId}")
    public ApiResponse<AgentUiSkill> updateUiSkill(@PathVariable Long id, @PathVariable Long uiSkillId, @Valid @RequestBody UiSkillRequest request) {
        return ApiResponse.ok(agentService.updateUiSkill(id, uiSkillId, request));
    }

    @DeleteMapping("/{id}/ui-skills/{uiSkillId}")
    public ApiResponse<Void> deleteUiSkill(@PathVariable Long id, @PathVariable Long uiSkillId) {
        agentService.deleteUiSkill(id, uiSkillId);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/faq")
    public ApiResponse<List<AgentFaq>> getFaqs(@PathVariable Long id) {
        return ApiResponse.ok(agentService.getFaqs(id));
    }

    @PostMapping("/{id}/faq")
    public ApiResponse<AgentFaq> addFaq(@PathVariable Long id, @Valid @RequestBody FaqRequest request) {
        AgentFaq faq = agentService.addFaq(id, request);
        return ApiResponse.ok(faq);
    }

    @GetMapping("/{id}/faq/{faqId}")
    public ApiResponse<AgentFaq> getFaq(@PathVariable Long id, @PathVariable Long faqId) {
        return ApiResponse.ok(agentService.getFaq(id, faqId));
    }

    @PutMapping("/{id}/faq/{faqId}")
    public ApiResponse<AgentFaq> updateFaq(@PathVariable Long id, @PathVariable Long faqId, @Valid @RequestBody FaqRequest request) {
        return ApiResponse.ok(agentService.updateFaq(id, faqId, request));
    }

    @DeleteMapping("/{id}/faq/{faqId}")
    public ApiResponse<Void> deleteFaq(@PathVariable Long id, @PathVariable Long faqId) {
        agentService.deleteFaq(id, faqId);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/files")
    public ApiResponse<List<AgentFile>> getFiles(@PathVariable Long id) {
        return ApiResponse.ok(agentService.getFiles(id));
    }

    @PostMapping("/{id}/files")
    public ApiResponse<AgentFile> addFile(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        AgentFile agentFile = agentService.addFile(id, file);
        return ApiResponse.ok(agentFile);
    }

    @GetMapping("/{id}/files/{fileId}")
    public ApiResponse<AgentFile> getFile(@PathVariable Long id, @PathVariable Long fileId) {
        return ApiResponse.ok(agentService.getFile(id, fileId));
    }

    @DeleteMapping("/{id}/files/{fileId}")
    public ApiResponse<Void> deleteFile(@PathVariable Long id, @PathVariable Long fileId) {
        agentService.deleteFile(id, fileId);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/websites")
    public ApiResponse<List<AgentWebsite>> getWebsites(@PathVariable Long id) {
        return ApiResponse.ok(agentService.getWebsites(id));
    }

    @PostMapping("/{id}/websites")
    public ApiResponse<AgentWebsite> addWebsite(@PathVariable Long id, @Valid @RequestBody WebsiteRequest request) {
        AgentWebsite website = agentService.addWebsite(id, request);
        return ApiResponse.ok(website);
    }

    @GetMapping("/{id}/websites/{websiteId}")
    public ApiResponse<AgentWebsite> getWebsite(@PathVariable Long id, @PathVariable Long websiteId) {
        return ApiResponse.ok(agentService.getWebsite(id, websiteId));
    }

    @PutMapping("/{id}/websites/{websiteId}")
    public ApiResponse<AgentWebsite> updateWebsite(@PathVariable Long id, @PathVariable Long websiteId, @Valid @RequestBody WebsiteRequest request) {
        return ApiResponse.ok(agentService.updateWebsite(id, websiteId, request));
    }

    @DeleteMapping("/{id}/websites/{websiteId}")
    public ApiResponse<Void> deleteWebsite(@PathVariable Long id, @PathVariable Long websiteId) {
        agentService.deleteWebsite(id, websiteId);
        return ApiResponse.ok();
    }

    // ── Connectors ────────────────────────────────────────────────────────────

    @GetMapping("/{id}/connectors")
    public ApiResponse<List<Object>> listConnectors(@PathVariable Long id) {
        return ApiResponse.ok(agentDeployService.listConnectors(id));
    }

    @PostMapping("/{id}/connectors")
    public ApiResponse<Map<String, Object>> createConnector(
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.createConnector(id, payload));
    }

    @GetMapping("/{id}/connectors/{connectorId}")
    public ApiResponse<Map<String, Object>> getConnector(@PathVariable Long id, @PathVariable String connectorId) {
        return ApiResponse.ok(agentDeployService.getConnector(id, connectorId));
    }

    @PutMapping("/{id}/connectors/{connectorId}")
    public ApiResponse<Map<String, Object>> updateConnector(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.updateConnector(id, connectorId, payload));
    }

    @DeleteMapping("/{id}/connectors/{connectorId}")
    public ApiResponse<Void> deleteConnector(
            @PathVariable Long id,
            @PathVariable String connectorId) {
        agentDeployService.deleteConnector(id, connectorId);
        return ApiResponse.ok();
    }

    @PutMapping("/{id}/connectors/{connectorId}/api-key")
    public ApiResponse<Map<String, Object>> upsertConnectorApiKey(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.upsertConnectorApiKey(id, connectorId, payload));
    }

    @PutMapping("/{id}/connectors/{connectorId}/certificate")
    public ApiResponse<Map<String, Object>> upsertConnectorCertificate(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.upsertConnectorCertificate(id, connectorId, payload));
    }

    @PutMapping("/{id}/connectors/{connectorId}/oauth")
    public ApiResponse<Map<String, Object>> upsertConnectorOAuth(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.upsertConnectorOAuth(id, connectorId, payload));
    }

    @GetMapping("/{id}/connectors/{connectorId}/logs")
    public ApiResponse<Map<String, Object>> getConnectorLogs(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) String toolId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Boolean includeStats,
            @RequestParam(required = false) Boolean summaryOnly,
            @RequestParam(required = false) Integer topN) {
        return ApiResponse.ok(agentDeployService.getConnectorLogs(id, connectorId, startTime, endTime, toolId, limit, includeStats, summaryOnly, topN));
    }

    // ── Tools ─────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/connectors/{connectorId}/tools")
    public ApiResponse<List<Object>> listTools(
            @PathVariable Long id,
            @PathVariable String connectorId) {
        return ApiResponse.ok(agentDeployService.listTools(id, connectorId));
    }

    @PostMapping("/{id}/connectors/{connectorId}/tools")
    public ApiResponse<Map<String, Object>> createTool(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.createTool(id, connectorId, payload));
    }

    @GetMapping("/{id}/connectors/{connectorId}/tools/{toolId}")
    public ApiResponse<Map<String, Object>> getTool(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @PathVariable String toolId) {
        return ApiResponse.ok(agentDeployService.getTool(id, connectorId, toolId));
    }

    @PutMapping("/{id}/connectors/{connectorId}/tools/{toolId}")
    public ApiResponse<Map<String, Object>> updateTool(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @PathVariable String toolId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.updateTool(id, connectorId, toolId, payload));
    }

    @DeleteMapping("/{id}/connectors/{connectorId}/tools/{toolId}")
    public ApiResponse<Void> deleteTool(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @PathVariable String toolId) {
        agentDeployService.deleteTool(id, connectorId, toolId);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/connectors/{connectorId}/tools/{toolId}/run")
    public ApiResponse<Map<String, Object>> runTool(
            @PathVariable Long id,
            @PathVariable String connectorId,
            @PathVariable String toolId,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(agentDeployService.runTool(id, connectorId, toolId, payload != null ? payload : Map.of()));
    }
}
