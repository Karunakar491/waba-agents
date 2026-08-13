package com.metaagent.platform.domain.agent.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.skill.dto.SkillDtos;
import com.metaagent.platform.domain.skill.service.SkillLibraryService;
import com.metaagent.platform.domain.templatestudio.iris.AiToolSpec;
import com.metaagent.platform.domain.templatestudio.iris.IrisToolProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Second IrisToolProvider (see wiki/decisions/2026-08-12-iris-generalization
 * -plan.md) — lets Iris read what an operator already saved in the Business
 * Agent creation wizard (currently: Business Persona) and turn it into a
 * real Skill Library entry, without the operator having to repeat
 * themselves in chat. v1 scope is deliberately just create_skill — Iris
 * "recommending the current stage" (i.e. telling the operator what's still
 * missing from Basics/Persona/Knowledge Base/Connectors before Test &
 * Deploy) is a real, separate feature that needs its own tool once each of
 * those steps has a stable read model; not built tonight, flagged rather
 * than faked.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentCreationToolProvider implements IrisToolProvider {

    private final AgentService agentService;
    private final BusinessProfileRepository businessProfileRepository;
    private final SkillLibraryService skillLibraryService;

    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("create_skill",
                    "Create a Skill Library entry for one of the operator's Business Agents. Requires user " +
                    "confirmation before it is actually saved. Prefer grounding the skill's body in that agent's " +
                    "saved Business Persona details (shown below) rather than inventing generic content — e.g. a " +
                    "\"Return Policy\" skill should quote the agent's actual saved return policy, not a generic one.",
                    Map.of("type", "object", "properties", Map.of(
                            "agentId", Map.of("type", "string", "description", "The agent's id, from the list below."),
                            "title", Map.of("type", "string", "description", "Max 64 characters."),
                            "description", Map.of("type", "string", "description", "Max 1024 characters — shown in the Skill Library list."),
                            "body", Map.of("type", "string", "description", "The actual skill instructions given to the agent, max 20000 characters.")),
                            "required", List.of("agentId", "title", "description", "body")),
                    true)
    );

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
                create_skill — never guess when there's more than one.""".formatted(agentList);
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
        if (!"create_skill".equals(toolName)) {
            throw new BusinessException("Unknown tool: " + toolName);
        }
        Long agentId = Long.valueOf(String.valueOf(args.get("agentId")));
        // getAgent() enforces the same account-access check every other
        // agent-scoped endpoint uses — never trust the model's agentId alone.
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
                null, // Iris's create_skill tool schema has no industry/use-case field
                null);
        return Map.of("skill", skillLibraryService.createSkill(request));
    }
}
