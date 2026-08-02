package com.metaagent.platform.domain.skill.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.skill.dto.SkillDtos;
import com.metaagent.platform.domain.skill.entity.SkillTemplate;
import com.metaagent.platform.domain.skill.service.SkillLibraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class SkillLibraryController {

    private final SkillLibraryService skillLibraryService;

    @PostMapping("/api/v1/skills")
    public ApiResponse<SkillDtos.SkillResponse> create(@Valid @RequestBody SkillDtos.CreateRequest request) {
        return ApiResponse.ok(skillLibraryService.createSkill(request));
    }

    @GetMapping("/api/v1/skills")
    public ApiResponse<List<SkillDtos.SkillResponse>> list(@RequestParam("wabaId") String wabaId) {
        return ApiResponse.ok(skillLibraryService.listSkills(wabaId));
    }

    @PutMapping("/api/v1/skills/{skillId}")
    public ApiResponse<SkillDtos.SkillResponse> update(@PathVariable Long skillId, @Valid @RequestBody SkillDtos.UpdateRequest request) {
        return ApiResponse.ok(skillLibraryService.updateSkill(skillId, request));
    }

    @DeleteMapping("/api/v1/skills/{skillId}")
    public ApiResponse<Void> delete(@PathVariable Long skillId) {
        skillLibraryService.deleteSkill(skillId);
        return ApiResponse.ok();
    }

    @GetMapping("/api/v1/agents/{agentId}/skills-view")
    public ApiResponse<List<SkillDtos.AgentSkillView>> getAgentSkillsView(@PathVariable Long agentId) {
        return ApiResponse.ok(skillLibraryService.getAgentSkillsView(agentId));
    }

    @PostMapping("/api/v1/agents/{agentId}/skills/{agentSkillId}/promote")
    public ApiResponse<Void> promote(@PathVariable Long agentId, @PathVariable Long agentSkillId) {
        skillLibraryService.promote(agentId, agentSkillId);
        return ApiResponse.ok();
    }

    @PostMapping("/api/v1/agents/{agentId}/skills/sync")
    public ApiResponse<SkillDtos.SyncSkillsResponse> sync(@PathVariable Long agentId) {
        return ApiResponse.ok(skillLibraryService.syncSkills(agentId));
    }

    @GetMapping("/api/v1/skill-templates")
    public ApiResponse<List<SkillDtos.SkillTemplateResponse>> listTemplates(
            @RequestParam(value = "industry", required = false) String industry,
            @RequestParam(value = "useCase", required = false) String useCase) {
        return ApiResponse.ok(skillLibraryService.listTemplates(industry, useCase).stream()
                .map(SkillLibraryController::toTemplateResponse).toList());
    }

    @PostMapping("/api/v1/skill-templates/{templateId}/copy")
    public ApiResponse<SkillDtos.SkillResponse> copyTemplate(
            @PathVariable Long templateId, @Valid @RequestBody SkillDtos.CopyTemplateRequest request) {
        return ApiResponse.ok(skillLibraryService.copyTemplate(templateId, request));
    }

    private static SkillDtos.SkillTemplateResponse toTemplateResponse(SkillTemplate template) {
        return new SkillDtos.SkillTemplateResponse(
                String.valueOf(template.getId()),
                template.getTitle(),
                template.getDescription(),
                template.getBody(),
                template.getIndustry(),
                template.getUseCase()
        );
    }
}
