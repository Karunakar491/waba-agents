package com.metaagent.platform.domain.agent.dto;

import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UiSkillRequest(
    @NotBlank(message = "Title is required")
    @Size(max = 64)
    String title,

    @NotNull(message = "Component type is required")
    AgentUiSkill.ComponentType componentType,

    @NotNull(message = "Status is required")
    AgentUiSkill.Status status,

    @NotBlank(message = "Instruction is required")
    @Size(max = 1024)
    String instruction
) {}
