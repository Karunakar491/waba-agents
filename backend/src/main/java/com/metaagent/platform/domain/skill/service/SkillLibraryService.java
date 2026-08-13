package com.metaagent.platform.domain.skill.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentSkillRepository;
import com.metaagent.platform.domain.agent.repository.AgentUiSkillRepository;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.skill.dto.SkillDtos;
import com.metaagent.platform.domain.skill.entity.AgentSkillAttachment;
import com.metaagent.platform.domain.skill.entity.Skill;
import com.metaagent.platform.domain.skill.entity.SkillTemplate;
import com.metaagent.platform.domain.skill.repository.AgentSkillAttachmentRepository;
import com.metaagent.platform.domain.skill.repository.SkillRepository;
import com.metaagent.platform.domain.skill.repository.SkillTemplateRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared Skill Library — first slice of the Library consolidation (supersedes
 * TASK-046's original join-table design with a simpler nullable-wabaId model,
 * matching Agent.wabaId's existing pattern).
 *
 * Editing a Skill here never touches Meta — that's the whole point. An
 * agent's attachment to a Skill only reaches Meta via {@link #syncSkills}, an
 * explicit per-agent action, never automatically on save. This is a
 * deliberate behavior INVERSION from the legacy {@code AgentSkill} path
 * (still untouched, still write-through-to-Meta-immediately) — not an
 * incremental addition. See TASKS.md TASK-050.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SkillLibraryService {

    private final SkillRepository skillRepository;
    private final AgentSkillAttachmentRepository attachmentRepository;
    private final AgentSkillRepository agentSkillRepository;
    private final AgentUiSkillRepository agentUiSkillRepository;
    private final AgentRepository agentRepository;
    private final WabaAccessGuard wabaAccessGuard;
    private final SkillTemplateRepository skillTemplateRepository;
    private final MetaApiClient metaApiClient;
    private final AgentService agentService;

    // ---------------------------------------------------------------------
    // Library CRUD — DB only, never touches Meta.
    // ---------------------------------------------------------------------

    public SkillDtos.SkillResponse createSkill(SkillDtos.CreateRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(request.wabaId());
        requireWabaAccess(wabaId, accountId);

        Skill skill = Skill.builder()
                .accountId(accountId)
                .wabaId(wabaId)
                .title(request.title())
                .description(request.description())
                .body(request.body())
                .industry(request.industry())
                .useCase(request.useCase())
                .build();
        // A brand-new skill has no attachments yet — always Draft.
        return toResponse(skillRepository.save(skill), false, List.of());
    }

    /**
     * TASK-053: a true aggregate — every skill currently live on ANY agent on
     * this WABA, not just Library rows. Legacy AgentSkill rows are NOT
     * deduplicated/shared (two agents can each have their own "identity"
     * skill with different content), so each carries its owning agent's id
     * and name; they are always deployed=true (write-through to Meta
     * immediately — confirmed in TASK-050). Both the Library fetch and the
     * legacy fetch are single batched queries, not a per-item/per-agent loop
     * (EM gate 2026-07-29).
     */
    public List<SkillDtos.SkillResponse> listSkills(String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        requireWabaAccess(wabaId, accountId);

        List<Skill> skills = skillRepository.findAllByWabaId(wabaId);
        List<Long> skillIds = skills.stream().map(Skill::getId).toList();
        List<Long> deployedIds = skillIds.isEmpty() ? List.of() : attachmentRepository.findDeployedSkillIds(skillIds);

        // requireWabaAccess above already verified this account can see this
        // WABA — findAllByWabaId is safe to call directly here (see its
        // internal-use-only javadoc).
        List<Agent> agents = agentRepository.findAllByWabaId(wabaId);
        List<Long> agentIds = agents.stream().map(Agent::getId).toList();
        Map<Long, Agent> agentsById = agents.stream()
                .collect(java.util.stream.Collectors.toMap(Agent::getId, a -> a));

        // Deployments-by-skill (TASK-063): a Library skill can be attached to
        // several agents at once, so "deployed on" is a list, not one field —
        // only synced attachments (deployedAt != null) count as "live on".
        Map<Long, List<SkillDtos.Deployment>> deploymentsBySkillId = new HashMap<>();
        if (!skillIds.isEmpty()) {
            for (AgentSkillAttachment att : attachmentRepository.findAllBySkillIdIn(skillIds)) {
                if (att.getDeployedAt() == null) continue;
                Agent agent = agentsById.get(att.getAgentId());
                if (agent == null) continue;
                deploymentsBySkillId.computeIfAbsent(att.getSkillId(), k -> new ArrayList<>())
                        .add(new SkillDtos.Deployment(String.valueOf(agent.getId()), agent.getDisplayName(), agent.getPhoneNumberId()));
            }
        }

        List<SkillDtos.SkillResponse> result = new ArrayList<>(skills.stream()
                .map(s -> toResponse(s, deployedIds.contains(s.getId()),
                        deploymentsBySkillId.getOrDefault(s.getId(), List.of())))
                .toList());

        if (!agentIds.isEmpty()) {
            for (AgentSkill legacy : agentSkillRepository.findAllByAgentIdIn(agentIds)) {
                Agent agent = agentsById.get(legacy.getAgentId());
                result.add(new SkillDtos.SkillResponse(
                        String.valueOf(legacy.getId()),
                        String.valueOf(wabaId), // AgentSkill has no waba_id column — this is the request's WABA context, not a real field on the entity
                        legacy.getTitle(),
                        legacy.getDescription(),
                        legacy.getBody(),
                        legacy.getUpdatedAt().toString(),
                        true, // legacy writes through to Meta immediately — always deployed
                        "AGENT",
                        String.valueOf(legacy.getAgentId()),
                        agent != null ? agent.getDisplayName() : null,
                        agent != null
                                ? List.of(new SkillDtos.Deployment(String.valueOf(agent.getId()), agent.getDisplayName(), agent.getPhoneNumberId()))
                                : List.of(),
                        null, // legacy AgentSkill has no industry/use_case columns — no tags to show
                        null
                ));
            }
        }
        return result;
    }

    /**
     * F22 (2026-08-07) — cross-agent UI Skills rollup, same shape as listSkills'
     * agent lookup but simpler: no attachments/Draft/deployed concept, UI
     * skills always live directly on their owning agent's phone number.
     */
    public List<SkillDtos.UiSkillView> listUiSkills(String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        requireWabaAccess(wabaId, accountId);

        List<Agent> agents = agentRepository.findAllByWabaId(wabaId);
        List<Long> agentIds = agents.stream().map(Agent::getId).toList();
        if (agentIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Agent> agentsById = agents.stream()
                .collect(java.util.stream.Collectors.toMap(Agent::getId, a -> a));

        return agentUiSkillRepository.findAllByAgentIdIn(agentIds).stream()
                .map(s -> {
                    Agent agent = agentsById.get(s.getAgentId());
                    return new SkillDtos.UiSkillView(
                            String.valueOf(s.getId()),
                            s.getTitle(),
                            s.getComponentType().name(),
                            s.getStatus().name(),
                            s.getInstruction(),
                            String.valueOf(s.getAgentId()),
                            agent != null ? agent.getDisplayName() : null,
                            agent != null ? agent.getPhoneNumberId() : null
                    );
                })
                .toList();
    }

    public SkillDtos.SkillResponse updateSkill(Long skillId, SkillDtos.UpdateRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Skill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));
        requireWabaAccess(skill.getWabaId(), accountId);

        skill.setTitle(request.title());
        skill.setDescription(request.description());
        skill.setBody(request.body());
        // Null-guarded: the existing edit form doesn't send these, and a
        // blind set would silently wipe a copied skill's provenance tags.
        if (request.industry() != null) skill.setIndustry(request.industry());
        if (request.useCase() != null) skill.setUseCase(request.useCase());
        skill = skillRepository.save(skill);
        boolean deployed = !attachmentRepository.findDeployedSkillIds(List.of(skill.getId())).isEmpty();
        return toResponse(skill, deployed, List.of());
    }

    private static SkillDtos.SkillResponse toResponse(Skill skill, boolean deployed, List<SkillDtos.Deployment> deployments) {
        return new SkillDtos.SkillResponse(
                String.valueOf(skill.getId()),
                skill.getWabaId() != null ? String.valueOf(skill.getWabaId()) : null,
                skill.getTitle(),
                skill.getDescription(),
                skill.getBody(),
                skill.getUpdatedAt().toString(),
                deployed,
                "LIBRARY",
                null,
                null,
                deployments,
                skill.getIndustry(),
                skill.getUseCase()
        );
    }

    public void deleteSkill(Long skillId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Skill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));
        requireWabaAccess(skill.getWabaId(), accountId);
        // FK (fk_attachment_skill) restricts this delete while any agent is
        // still attached — intentional: forces an explicit detach/decision
        // rather than silently orphaning an agent's live Meta skill.
        skillRepository.delete(skill);
    }

    private void requireWabaAccess(Long wabaId, Long accountId) {
        if (wabaId == null) {
            throw new BusinessException("You don't have access to this WABA's Skill Library.");
        }
        wabaAccessGuard.requireAccess(wabaId, accountId);
    }

    // ---------------------------------------------------------------------
    // Per-agent view — union of legacy (agent-scoped) and Library-attached skills.
    // ---------------------------------------------------------------------

    public List<SkillDtos.AgentSkillView> getAgentSkillsView(Long agentId) {
        List<SkillDtos.AgentSkillView> views = new ArrayList<>();

        // agentService.getSkills (not the repository directly) — it backfills
        // from Meta first if this agent was imported/reconciled and has never
        // had its skills read locally before (TASK-054). Also does the
        // access-check (getAgent) internally, so no separate call needed here.
        for (AgentSkill legacy : agentService.getSkills(agentId)) {
            views.add(new SkillDtos.AgentSkillView(
                    String.valueOf(legacy.getId()),
                    "AGENT",
                    legacy.getTitle(),
                    legacy.getDescription(),
                    legacy.getBody(),
                    "LIVE", // legacy path still writes through to Meta immediately
                    true,
                    null
            ));
        }

        for (AgentSkillAttachment attachment : attachmentRepository.findAllByAgentId(agentId)) {
            Skill skill = skillRepository.findById(attachment.getSkillId())
                    .orElseThrow(() -> new NotFoundException("Attached skill not found: " + attachment.getSkillId()));
            boolean live = attachment.getDeployedAt() != null && !attachment.getDeployedAt().isBefore(skill.getUpdatedAt());
            views.add(new SkillDtos.AgentSkillView(
                    String.valueOf(attachment.getId()),
                    "LIBRARY",
                    skill.getTitle(),
                    skill.getDescription(),
                    skill.getBody(),
                    live ? "LIVE" : "OUT_OF_SYNC",
                    false,
                    String.valueOf(skill.getId())
            ));
        }
        return views;
    }

    // ---------------------------------------------------------------------
    // Promote — converts one legacy AgentSkill into a Library Skill +
    // attachment. Content is identical and already live on Meta at this
    // instant, so deployedAt = now (in sync from the moment of promotion).
    // ---------------------------------------------------------------------

    @Transactional
    public void promote(Long agentId, Long agentSkillId) {
        Agent agent = agentService.getAgent(agentId);
        if (agent.getWabaId() == null) {
            throw new BusinessException("Connect this agent to a WABA before promoting a skill to the Library.");
        }
        AgentSkill legacy = agentSkillRepository.findByIdAndAgentId(agentSkillId, agentId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));

        Skill skill = skillRepository.save(Skill.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .wabaId(agent.getWabaId())
                .title(legacy.getTitle())
                .description(legacy.getDescription())
                .body(legacy.getBody())
                .build());

        attachmentRepository.save(AgentSkillAttachment.builder()
                .agentId(agentId)
                .skillId(skill.getId())
                .metaSkillId(legacy.getMetaSkillId())
                .deployedAt(LocalDateTime.now())
                .build());

        agentSkillRepository.delete(legacy);
    }

    // ---------------------------------------------------------------------
    // Sync — the only path that pushes a Library skill to Meta. Deliberately
    // NOT wrapped in one @Transactional: each item's Meta call + DB commit is
    // independent, so item 3 of 5 failing never rolls back items 1-2's
    // already-confirmed success (EM gate 2026-07-29 — no all-or-nothing loop).
    // ---------------------------------------------------------------------

    public SkillDtos.SyncSkillsResponse syncSkills(Long agentId) {
        Agent agent = agentService.getAgent(agentId);
        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException("Connect a phone number before syncing skills.");
        }

        List<SkillDtos.SyncItemResult> results = new ArrayList<>();
        for (AgentSkillAttachment attachment : attachmentRepository.findAllByAgentId(agentId)) {
            Skill skill = skillRepository.findById(attachment.getSkillId()).orElse(null);
            if (skill == null) continue; // orphaned attachment — nothing to sync, surfaced elsewhere

            boolean alreadyLive = attachment.getDeployedAt() != null && !attachment.getDeployedAt().isBefore(skill.getUpdatedAt());
            if (alreadyLive) continue; // only push what's actually stale

            results.add(syncOne(agent, attachment, skill));
        }
        return new SkillDtos.SyncSkillsResponse(results);
    }

    private SkillDtos.SyncItemResult syncOne(Agent agent, AgentSkillAttachment attachment, Skill skill) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", skill.getTitle());
        payload.put("description", skill.getDescription());
        payload.put("skill", skill.getBody()); // Meta's field name is "skill", not "body"

        try {
            if (attachment.getMetaSkillId() == null) {
                String syncPath = MetaApiClient.scopedPath(
                        String.format("/%s/agent_config/skills", agent.getPhoneNumberId()), agent.getMetaAgentId());
                Map<?, ?> response = metaApiClient.post(syncPath, payload, Map.class);
                attachment.setMetaSkillId(response != null ? (String) response.get("id") : null);
            } else {
                String syncPath = MetaApiClient.scopedPath(
                        String.format("/%s/agent_config/skills/%s", agent.getPhoneNumberId(), attachment.getMetaSkillId()),
                        agent.getMetaAgentId());
                metaApiClient.put(syncPath, payload, Map.class);
            }
            attachment.setDeployedAt(LocalDateTime.now());
            attachmentRepository.save(attachment);
            return new SkillDtos.SyncItemResult(String.valueOf(attachment.getId()), skill.getTitle(), true, null);
        } catch (Exception e) {
            log.warn("Skill sync failed: agentId={} skillId={} error={}", agent.getId(), skill.getId(), e.getMessage());
            return new SkillDtos.SyncItemResult(String.valueOf(attachment.getId()), skill.getTitle(), false, e.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Reference catalog — global, no waba_id/account_id, every logged-in
    // account sees every template. "Copy" is a one-way INSERT: no live link
    // back to the template, so editing/deprecating a template later never
    // affects anything already copied (EM gate 2026-07-29).
    // ---------------------------------------------------------------------

    public List<SkillTemplate> listTemplates(String industry, String useCase) {
        return skillTemplateRepository.findAll().stream()
                .filter(t -> industry == null || industry.isBlank() || t.getIndustry().equalsIgnoreCase(industry))
                .filter(t -> useCase == null || useCase.isBlank() || t.getUseCase().equalsIgnoreCase(useCase))
                .toList();
    }

    public SkillDtos.SkillResponse copyTemplate(Long templateId, SkillDtos.CopyTemplateRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(request.wabaId());
        requireWabaAccess(wabaId, accountId);

        SkillTemplate template = skillTemplateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Template not found"));

        Skill skill = Skill.builder()
                .accountId(accountId)
                .wabaId(wabaId)
                .title(template.getTitle())
                .description(template.getDescription())
                .body(template.getBody())
                // V43: carry the catalog's provenance across the one-way copy so
                // the Skills Library grid can show real tags instead of none.
                .industry(template.getIndustry())
                .useCase(template.getUseCase())
                .build();
        return toResponse(skillRepository.save(skill), false, List.of()); // freshly copied — no attachments yet, Draft
    }

    private static Long parseId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (Exception e) {
            throw new BusinessException("Invalid id: " + raw);
        }
    }
}
