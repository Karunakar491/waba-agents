package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.dto.AgentDeleteResult;
import com.metaagent.platform.domain.agent.dto.AgentDeleteResult.Step;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import com.metaagent.platform.domain.persona.service.BusinessProfileDeployService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * "Delete this agent" — everywhere, not just in our database.
 *
 * <p>Meta has no single call that removes an agent and everything attached to
 * it. {@code DELETE /{phoneNumberId}/delete_agent} removes the agent config,
 * but we cannot verify it also clears the business persona, skills, UI skills
 * and connectors on that number — and the failure mode is silent and
 * expensive: the number gets rebound to a new agent that inherits a previous
 * client's configuration. So we empty each resource explicitly first, then
 * call delete_agent.
 *
 * <p>Every Meta step is best-effort and independently recorded. One failing
 * step must not abort the rest (that would leave the number in a worse,
 * half-emptied state than if we had never started) and must not be swallowed
 * (that would tell the operator Meta is clean when it isn't). Hence
 * {@link AgentDeleteResult} rather than void.
 *
 * <p>Ordering note: {@code docs/meta-api/} documents no ordering requirement
 * between delete_agent and its attached resources. delete_agent goes last for
 * fallback value only — if it fails, everything else is already emptied.
 *
 * <p>Not {@code @Transactional}: this method makes several sequential HTTP
 * calls to Meta, and holding a database transaction open across them would tie
 * a connection up for the duration. The local cascade delete is a single
 * proxied call into {@link AgentService#deleteAgent(Long)}, which keeps its own
 * transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentTeardownService {

    private final AgentService agentService;
    private final AgentDeployService agentDeployService;
    private final BusinessProfileDeployService businessProfileDeployService;

    public AgentDeleteResult deleteEverywhere(Long agentId) {
        Agent agent = agentService.getAgent(agentId);
        String phoneNumberId = agent.getPhoneNumberId();

        List<Step> steps = new ArrayList<>();

        if (phoneNumberId == null) {
            // A draft agent was never provisioned on Meta, so there is nothing
            // to tear down and no reason to demand it be paused first. Refusing
            // here would make draft agents permanently undeletable.
            steps.add(Step.skipped("Meta teardown",
                    "This agent was never connected to a phone number, so nothing exists on Meta."));
        } else {
            // Guardrail, backend-enforced rather than left to the UI: from here
            // on we mutate a real client's live WhatsApp number. It must have
            // already stopped responding before we start emptying it.
            //
            // A draft is exempt, and must be: the create wizard binds the phone
            // number on its very first step, so an abandoned wizard leaves a
            // draft that has a phoneNumberId but has never answered anyone.
            // Requiring a pause there deadlocked it permanently — pause rejects
            // drafts with "Agent is not currently active", so the agent could
            // be neither paused nor deleted, and it held its phone number
            // hostage against every future attempt. Testing this on the
            // deployed app took the last free number on the account and made
            // creating any new agent impossible (2026-09-03).
            if (agent.getStatus() != Agent.Status.paused && agent.getStatus() != Agent.Status.draft) {
                throw new BusinessException(
                        "Pause this agent before deleting it — deleting clears its configuration on Meta, "
                                + "and that must not happen while it is still answering customers.");
            }
            steps.add(clearBusinessPersona(phoneNumberId));
            steps.addAll(deleteConnectors(agentId));
            steps.addAll(deleteSkills(agentId));
            steps.addAll(deleteUiSkills(agentId));
            steps.add(deleteAgentConfig(agentId, phoneNumberId));
        }

        // Local cleanup runs regardless of Meta-side outcome. Blocking it on a
        // Meta failure would leave the operator with an agent they cannot get
        // rid of — the exact problem this feature exists to fix.
        agentService.deleteAgent(agentId);

        AgentDeleteResult result = AgentDeleteResult.of(steps);
        if (!result.metaFullyCleaned()) {
            log.warn("Agent {} deleted locally but Meta teardown was incomplete: {}", agentId, result.steps());
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // Steps — each returns its own outcome, none throws
    // -------------------------------------------------------------------------

    /** business_info.md documents DELETE / as "reset business info to defaults". */
    private Step clearBusinessPersona(String phoneNumberId) {
        String name = "Business persona";
        try {
            businessProfileDeployService.resetLive(phoneNumberId);
            return Step.succeeded(name, "Reset to defaults on Meta.");
        } catch (Exception e) {
            return Step.failed(name, message(e));
        }
    }

    private List<Step> deleteConnectors(Long agentId) {
        String name = "Connectors";
        List<Object> connectors;
        try {
            connectors = agentDeployService.listConnectors(agentId);
        } catch (Exception e) {
            return List.of(Step.failed(name, "Could not list connectors on Meta: " + message(e)));
        }
        if (connectors.isEmpty()) {
            return List.of(Step.skipped(name, "No connectors on this agent."));
        }

        List<Step> steps = new ArrayList<>();
        for (Object connector : connectors) {
            String connectorId = idOf(connector);
            if (connectorId == null) {
                steps.add(Step.failed(name, "Meta returned a connector with no id; it was left in place."));
                continue;
            }
            String label = name + ": " + connectorId;
            try {
                agentDeployService.deleteConnector(agentId, connectorId);
                steps.add(Step.succeeded(label, "Deleted from Meta."));
            } catch (Exception e) {
                steps.add(Step.failed(label, message(e)));
            }
        }
        return steps;
    }

    private List<Step> deleteSkills(Long agentId) {
        String name = "Skills";
        List<AgentSkill> skills;
        try {
            skills = agentService.getSkills(agentId);
        } catch (Exception e) {
            return List.of(Step.failed(name, "Could not list skills: " + message(e)));
        }
        if (skills.isEmpty()) {
            return List.of(Step.skipped(name, "No skills on this agent."));
        }

        List<Step> steps = new ArrayList<>();
        for (AgentSkill skill : skills) {
            String label = name + ": " + skill.getTitle();
            try {
                agentService.deleteSkill(agentId, skill.getId());
                steps.add(Step.succeeded(label, "Deleted from Meta."));
            } catch (Exception e) {
                steps.add(Step.failed(label, message(e)));
            }
        }
        return steps;
    }

    private List<Step> deleteUiSkills(Long agentId) {
        String name = "UI skills";
        List<AgentUiSkill> uiSkills;
        try {
            uiSkills = agentService.getUiSkills(agentId);
        } catch (Exception e) {
            return List.of(Step.failed(name, "Could not list UI skills: " + message(e)));
        }
        if (uiSkills.isEmpty()) {
            return List.of(Step.skipped(name, "No UI skills on this agent."));
        }

        List<Step> steps = new ArrayList<>();
        for (AgentUiSkill uiSkill : uiSkills) {
            String label = name + ": " + uiSkill.getTitle();
            try {
                agentService.deleteUiSkill(agentId, uiSkill.getId());
                steps.add(Step.succeeded(label, "Deleted from Meta."));
            } catch (Exception e) {
                steps.add(Step.failed(label, message(e)));
            }
        }
        return steps;
    }

    private Step deleteAgentConfig(Long agentId, String phoneNumberId) {
        String name = "Agent configuration";
        try {
            agentDeployService.deleteFromMeta(agentId);
            return Step.succeeded(name, "Removed from " + phoneNumberId + " on Meta.");
        } catch (Exception e) {
            return Step.failed(name, message(e));
        }
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /** Meta returns connectors as bare JSON objects (see AgentDeployService.listConnectors). */
    private String idOf(Object connector) {
        if (connector instanceof Map<?, ?> map) {
            Object id = map.get("id");
            return id == null ? null : String.valueOf(id);
        }
        return null;
    }

    /** Exception messages are shown to the operator, so never surface a bare null. */
    private String message(Exception e) {
        String message = e.getMessage();
        return (message == null || message.isBlank()) ? e.getClass().getSimpleName() : message;
    }
}
