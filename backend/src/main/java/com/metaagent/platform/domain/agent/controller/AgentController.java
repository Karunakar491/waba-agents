package com.metaagent.platform.domain.agent.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.agent.dto.AgentRequest;
import com.metaagent.platform.domain.agent.dto.BindPhoneRequest;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.GenerateDefaultsRequest;
import com.metaagent.platform.domain.agent.dto.GenerateDefaultsResponse;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
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

    @PostMapping("/{id}/deploy")
    public ApiResponse<Agent> deployAgent(@PathVariable Long id) {
        Agent agent = agentDeployService.deploy(id);
        return ApiResponse.ok(agent);
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<Agent> pauseAgent(@PathVariable Long id) {
        Agent agent = agentDeployService.pause(id);
        return ApiResponse.ok(agent);
    }

    @PostMapping("/{id}/skills")
    public ApiResponse<AgentSkill> addSkill(@PathVariable Long id, @Valid @RequestBody SkillRequest request) {
        AgentSkill skill = agentService.addSkill(id, request);
        return ApiResponse.ok(skill);
    }

    @DeleteMapping("/{id}/skills/{skillId}")
    public ApiResponse<Void> deleteSkill(@PathVariable Long id, @PathVariable Long skillId) {
        agentService.deleteSkill(id, skillId);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/faq")
    public ApiResponse<AgentFaq> addFaq(@PathVariable Long id, @Valid @RequestBody FaqRequest request) {
        AgentFaq faq = agentService.addFaq(id, request);
        return ApiResponse.ok(faq);
    }

    @DeleteMapping("/{id}/faq/{faqId}")
    public ApiResponse<Void> deleteFaq(@PathVariable Long id, @PathVariable Long faqId) {
        agentService.deleteFaq(id, faqId);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/files")
    public ApiResponse<AgentFile> addFile(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        AgentFile agentFile = agentService.addFile(id, file);
        return ApiResponse.ok(agentFile);
    }

    @DeleteMapping("/{id}/files/{fileId}")
    public ApiResponse<Void> deleteFile(@PathVariable Long id, @PathVariable Long fileId) {
        agentService.deleteFile(id, fileId);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/websites")
    public ApiResponse<AgentWebsite> addWebsite(@PathVariable Long id, @Valid @RequestBody WebsiteRequest request) {
        AgentWebsite website = agentService.addWebsite(id, request);
        return ApiResponse.ok(website);
    }

    @DeleteMapping("/{id}/websites/{websiteId}")
    public ApiResponse<Void> deleteWebsite(@PathVariable Long id, @PathVariable Long websiteId) {
        agentService.deleteWebsite(id, websiteId);
        return ApiResponse.ok();
    }
}
