package com.metaagent.platform.domain.agent.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.skill.dto.SkillDtos;
import com.metaagent.platform.domain.skill.service.SkillLibraryService;
import com.metaagent.platform.domain.iris.AiToolSpec;
import com.metaagent.platform.domain.iris.IrisToolProvider;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Iris tools for the Business Agent creation wizard: Skill Library create,
 * plus on-agent skill list/get/update/delete. Update and delete write to Meta
 * immediately; create_skill only adds a library catalog row.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentCreationToolProvider implements IrisToolProvider {

    private final AgentService agentService;
    private final BusinessProfileRepository businessProfileRepository;
    private final SkillLibraryService skillLibraryService;
    private final Validator validator;

    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("create_skill",
                    "Create a Skill Library entry for one of the operator's Business Agents (library catalog for the " +
                    "agent's WABA, not an on-agent AgentSkill row). Requires user confirmation before it is actually " +
                    "saved. Prefer grounding the skill's body in that agent's saved Business Persona details (shown " +
                    "below) rather than inventing generic content — e.g. a \"Return Policy\" skill should quote the " +
                    "agent's actual saved return policy, not a generic one.",
                    Map.of("type", "object", "properties", Map.of(
                            "agentId", Map.of("type", "string", "description", "The agent's id, from the list below."),
                            "title", Map.of("type", "string", "description", "Max 64 characters."),
                            "description", Map.of("type", "string", "description", "Max 1024 characters — shown in the Skill Library list."),
                            "body", Map.of("type", "string", "description", "The actual skill instructions given to the agent, max 20000 characters.")),
                            "required", List.of("agentId", "title", "description", "body")),
                    true),
            new AiToolSpec("list_skills",
                    "List skills already attached to one Business Agent (on-agent rows, not the Skill Library catalog).",
                    Map.of("type", "object", "properties", Map.of(
                            "agentId", Map.of("type", "string", "description", "The agent's id.")),
                            "required", List.of("agentId")),
                    false),
            new AiToolSpec("get_skill",
                    "Get one on-agent skill by id.",
                    Map.of("type", "object", "properties", Map.of(
                            "agentId", Map.of("type", "string"),
                            "skillId", Map.of("type", "string")),
                            "required", List.of("agentId", "skillId")),
                    false),
            new AiToolSpec("update_skill",
                    "Replace an on-agent skill's title, description, and instructions. Writes to Meta immediately. Max title 64, description 1024, body 20000. Confirmation required.",
                    Map.of("type", "object", "properties", Map.of(
                            "agentId", Map.of("type", "string"),
                            "skillId", Map.of("type", "string"),
                            "title", Map.of("type", "string"),
                            "description", Map.of("type", "string"),
                            "body", Map.of("type", "string", "description", "Skill instructions; sent to Meta as the 'skill' field.")),
                            "required", List.of("agentId", "skillId", "title", "description", "body")),
                    true),
            new AiToolSpec("delete_skill",
                    "Delete an on-agent skill. Writes to Meta immediately. Confirmation required.",
                    Map.of("type", "object", "properties", Map.of(
                            "agentId", Map.of("type", "string"),
                            "skillId", Map.of("type", "string")),
                            "required", List.of("agentId", "skillId")),
                    true)
    );

    @Override
    public String featureKey() {
        return "agent_creation";
    }

    @Override
    public List<AiToolSpec> tools() {
        return TOOLS;
    }

    @Override
    public String systemPromptFragment(Long accountId) {
        List<Agent> agents = agentService.listAgents();
        if (agents.isEmpty()) {
            return "This operator has no Business Agents yet — if they ask about Skills, tell them to create an agent first.";
        }
        String agentList = agents.stream().map(this::describeAgentWithPersona).collect(Collectors.joining("\n\n"));
        return """
                This operator's Business Agents, each with any Business Persona details already saved for it \
                (blank fields mean nothing was saved yet — never invent a value for one):
                %s
                If they ask you to create a Skill without saying which agent, ask which one (by name) before calling \
                create_skill — never guess when there's more than one. create_skill adds a library entry for the \
                agent's WABA. list_skills / get_skill / update_skill / delete_skill use on-agent AgentSkill ids.""".formatted(agentList);
    }

    private String describeAgentWithPersona(Agent agent) {
        String persona = agent.getPhoneNumberId() == null ? null : findPersona(agent.getPhoneNumberId());
        String personaBlock = persona == null
                ? "  (no Business Persona saved yet)"
                : persona;
        return "- \"%s\" (agentId: %d)\n%s".formatted(agent.getDisplayName(), agent.getId(), personaBlock);
    }

    private String findPersona(String phoneNumberId) {
        BusinessProfile profile = businessProfileRepository.findByPhoneNumberIdAndStatus(phoneNumberId, BusinessProfile.Status.DEPLOYED)
                .or(() -> businessProfileRepository.findByPhoneNumberIdAndStatus(phoneNumberId, BusinessProfile.Status.DRAFT))
                .orElse(null);
        if (profile == null) return null;
        StringBuilder sb = new StringBuilder();
        appendIfPresent(sb, "Business description", profile.getBusinessDescription());
        appendIfPresent(sb, "Return policy", profile.getReturnPolicy());
        appendIfPresent(sb, "Delivery & shipping", profile.getDeliveryAndShipping());
        appendIfPresent(sb, "Payment methods", profile.getPaymentMethod());
        appendIfPresent(sb, "Purchase info", profile.getPurchaseInfo());
        return sb.length() == 0 ? null : sb.toString();
    }

    private void appendIfPresent(StringBuilder sb, String label, String value) {
        if (value != null && !value.isBlank()) {
            sb.append("  ").append(label).append(": ").append(value.strip()).append("\n");
        }
    }

    @Override
    public Map<String, Object> execute(String toolName, Map<String, Object> args, Long accountId) {
        return switch (toolName) {
            case "create_skill" -> createLibrarySkill(parseAgentId(args), args);
            case "list_skills" -> listOnAgentSkills(parseAgentId(args));
            case "get_skill" -> getOnAgentSkill(parseAgentId(args), parseSkillId(args));
            case "update_skill" -> updateOnAgentSkill(parseAgentId(args), parseSkillId(args), args);
            case "delete_skill" -> deleteOnAgentSkill(parseAgentId(args), parseSkillId(args));
            default -> throw new BusinessException("Unknown tool: " + toolName);
        };
    }

    @Override
    public String summarizeResult(String toolName, Map<String, Object> result) {
        if ("list_skills".equals(toolName)) {
            int n = result.get("count") instanceof Number num ? num.intValue() : 0;
            return n == 0 ? "No skills on this agent yet." : "Found " + n + " skills.";
        }
        if ("get_skill".equals(toolName)) {
            Object title = result.get("title");
            return title == null ? "Here is the skill." : "Skill: " + title;
        }
        return IrisToolProvider.super.summarizeResult(toolName, result);
    }

    private Map<String, Object> createLibrarySkill(Long agentId, Map<String, Object> args) {
        Agent agent = agentService.getAgent(agentId);
        if (agent.getWabaId() == null) {
            throw new BusinessException("This agent has no WABA connected yet — connect one before creating a Skill for it.");
        }
        log.info("execute: tool=create_skill agentId={} wabaId={}", agentId, agent.getWabaId());
        SkillDtos.CreateRequest request = new SkillDtos.CreateRequest(
                String.valueOf(agent.getWabaId()),
                String.valueOf(args.get("title")),
                String.valueOf(args.get("description")),
                String.valueOf(args.get("body")),
                null,
                null);
        return Map.of("skill", skillLibraryService.createSkill(request));
    }

    private Map<String, Object> listOnAgentSkills(Long agentId) {
        agentService.getAgent(agentId);
        List<Map<String, Object>> skills = agentService.getSkills(agentId).stream()
                .map(this::toSkillView)
                .toList();
        return Map.of("skills", skills, "count", skills.size());
    }

    private Map<String, Object> getOnAgentSkill(Long agentId, Long skillId) {
        agentService.getAgent(agentId);
        return toSkillView(agentService.getSkill(agentId, skillId));
    }

    private Map<String, Object> updateOnAgentSkill(Long agentId, Long skillId, Map<String, Object> args) {
        agentService.getAgent(agentId);
        SkillRequest request = new SkillRequest(
                String.valueOf(args.get("title")),
                String.valueOf(args.get("description")),
                String.valueOf(args.get("body")));
        validateOrThrow(request);
        log.info("execute: tool=update_skill agentId={} skillId={}", agentId, skillId);
        return toSkillView(agentService.updateSkill(agentId, skillId, request));
    }

    private Map<String, Object> deleteOnAgentSkill(Long agentId, Long skillId) {
        agentService.getAgent(agentId);
        log.info("execute: tool=delete_skill agentId={} skillId={}", agentId, skillId);
        agentService.deleteSkill(agentId, skillId);
        return Map.of("deleted", true, "skillId", String.valueOf(skillId));
    }

    private static Long parseAgentId(Map<String, Object> args) {
        return Long.valueOf(String.valueOf(args.get("agentId")));
    }

    private static Long parseSkillId(Map<String, Object> args) {
        return Long.valueOf(String.valueOf(args.get("skillId")));
    }

    private Map<String, Object> toSkillView(AgentSkill skill) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", String.valueOf(skill.getId()));
        view.put("agentId", String.valueOf(skill.getAgentId()));
        view.put("title", skill.getTitle());
        view.put("description", skill.getDescription());
        view.put("body", skill.getBody());
        if (skill.getMetaSkillId() != null) {
            view.put("metaSkillId", skill.getMetaSkillId());
        }
        return view;
    }

    private <T> void validateOrThrow(T request) {
        Set<ConstraintViolation<T>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .findFirst()
                    .orElse("Validation failed");
            throw new BusinessException(message);
        }
    }
}
