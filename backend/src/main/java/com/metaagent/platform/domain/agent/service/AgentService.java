package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.AgentRequest;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.dto.UiSkillRequest;
import com.metaagent.platform.domain.agent.dto.WebsiteRequest;
import com.metaagent.platform.domain.agent.entity.*;
import com.metaagent.platform.domain.agent.repository.*;
import com.metaagent.platform.domain.conversation.repository.ConversationRepository;
import com.metaagent.platform.domain.conversation.repository.MessageRepository;
import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final AgentRepository agentRepository;
    private final AgentSkillRepository agentSkillRepository;
    private final AgentUiSkillRepository agentUiSkillRepository;
    private final AgentFaqRepository agentFaqRepository;
    private final AgentFileRepository agentFileRepository;
    private final AgentWebsiteRepository agentWebsiteRepository;
    private final AgentWebsitePageRepository agentWebsitePageRepository;
    private final WabaRepository wabaRepository;
    private final WabaAccessGuard wabaAccessGuard;
    private final AgentAccessService agentAccessService;
    private final MetaApiClient metaApiClient;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final WebhookRawRepository webhookRawRepository;
    private final MetaMirrorReconciler metaMirrorReconciler;
    private final PhoneNumberSnapshotRepository phoneNumberSnapshotRepository;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "docx");

    // Per-agentId lock — two accounts editing the same shared Agent concurrently
    // (updateAgent/bindPhone) must not interleave. Copy of the pattern already
    // proven in BusinessProfileDeployService; not yet extracted to a shared
    // utility (only 2 concrete uses so far — see that class's own comment).
    private final java.util.concurrent.ConcurrentHashMap<Long, Object> agentLocks = new java.util.concurrent.ConcurrentHashMap<>();

    // --- Agent CRUD ---

    @Transactional
    public Agent createAgent(AgentRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();

        // Agents are created without a phone (draft). Eligibility check and Meta
        // provisioning happen at phone binding time — see bindPhone().
        Agent agent = Agent.builder()
                .accountId(accountId)
                .displayName(request.displayName())
                .customerFacingName(request.customerFacingName())
                .channel(request.channel())
                .systemPrompt(request.systemPrompt())
                .tone(request.tone())
                .language(request.language())
                .behaviorRules(request.behaviorRules())
                .handoffEnabled(request.handoffEnabled())
                .handoffMessage(request.handoffMessage())
                .enabled(false)
                .build();
        return agentRepository.save(agent);
    }

    /**
     * Wizard autosave + settings edits. Channel is locked after creation (spec 4):
     * once set it can never change — enforced here, not just in the UI.
     */
    @Transactional
    public Agent updateAgent(Long agentId, AgentRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        synchronized (lockFor(agentId)) {
            Agent agent = getAgent(agentId);

            if (request.channel() != null && agent.getChannel() != null
                    && request.channel() != agent.getChannel()) {
                throw new BusinessException("Channel can't be changed after the agent is created.");
            }
            if (agent.getChannel() == null && request.channel() != null) {
                agent.setChannel(request.channel());
            }

            agent.setDisplayName(request.displayName());
            agent.setCustomerFacingName(request.customerFacingName());
            agent.setSystemPrompt(request.systemPrompt());
            agent.setTone(request.tone());
            agent.setLanguage(request.language());
            agent.setBehaviorRules(request.behaviorRules());
            agent.setHandoffEnabled(request.handoffEnabled());
            agent.setHandoffMessage(request.handoffMessage());
            agent.setUpdatedBy(accountId);
            return agentRepository.save(agent);
        }
    }

    private Object lockFor(Long agentId) {
        return agentLocks.computeIfAbsent(agentId, k -> new Object());
    }

    /**
     * Binds a WABA phone number to an agent (spec section 5).
     * Meta-first: eligibility check + provisioning before the DB write.
     * Race-safe: unique index on agent.phone_number_id — a concurrent bind of the
     * same number fails on save, never silently double-binds.
     */
    @Transactional
    public Agent bindPhone(Long agentId, String phoneNumberId, Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        synchronized (lockFor(agentId)) {
            Agent agent = getAgent(agentId);

            // Caller's account must have an access grant on this WABA — no
            // cross-tenant references. Any account with a grant may bind to
            // it, not just the WABA's original registering account (2026-07-28
            // decoupling decision).
            Waba waba = wabaRepository.findById(wabaId)
                    .orElseThrow(() -> new NotFoundException("WABA not found"));
            wabaAccessGuard.requireAccess(waba.getId(), accountId);

            // Phone must actually belong to that WABA on Meta
            if (!phoneBelongsToWaba(waba.getWabaId(), phoneNumberId)) {
                throw new BusinessException("This phone number doesn't belong to the selected WABA.");
            }

            // Pre-check for a friendly error (the unique index is the real guard)
            agentRepository.findByPhoneNumberId(phoneNumberId)
                    .filter(other -> !other.getId().equals(agentId))
                    .ifPresent(other -> {
                        throw new BusinessException("This phone number is already connected to another agent.");
                    });

            // 1. Meta eligibility check
            String eligibilityPath = String.format("/%s/agent_eligibility", phoneNumberId);
            try {
                Map<?, ?> eligibility = metaApiClient.get(eligibilityPath, Map.class);
                if (eligibility == null || !Boolean.TRUE.equals(eligibility.get("is_eligible"))) {
                    throw new BusinessException("Phone number is not eligible for Meta Business Agent");
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessException("Meta isn't responding. Wait a moment and try again.");
            }

            // 2. Provision on Meta — disabled until user activates.
            // Settings PUT is a full replace (settings.md) — an imported/pre-
            // existing Meta-side number may already have a real followup
            // config, audience restriction, or handoff message configured
            // directly on Meta; hardcoding these to off/EVERYONE (as this
            // used to) silently destroyed them at connect time, before an
            // operator ever saw the config. Read the live WhatsApp-channel
            // entry first, hydrate this agent's own handoff fields from it
            // (a fresh local Agent row has never seen this), and carry
            // followup/ai_audience through unchanged. Same fix as
            // AgentDeployService.putSettings — see Wave 1a.
            String settingsPath = String.format("/%s/agent_config/settings", phoneNumberId);
            Map<String, Object> live;
            try {
                List<?> currentSettings = metaApiClient.get(settingsPath, List.class);
                live = MetaApiClient.findChannelEntry(currentSettings, "whatsapp");
            } catch (Exception e) {
                live = null;
            }
            // EL-caught (2026-08-03): only hydrate when the local row has
            // nothing configured yet. handoff.message is optional per
            // settings.md's own schema — a live entry with enabled=true and
            // no message would otherwise null out a handoff message the
            // operator already configured locally (in the wizard, before
            // ever binding a phone) but hasn't deployed yet. That's a
            // regression of the exact class this fix exists to prevent.
            if (live != null && agent.getHandoffMessage() == null && !agent.isHandoffEnabled()
                    && live.get("handoff") instanceof Map<?, ?> liveHandoff) {
                agent.setHandoffEnabled(Boolean.TRUE.equals(liveHandoff.get("enabled")));
                Object msg = liveHandoff.get("message");
                agent.setHandoffMessage(msg != null ? msg.toString() : null);
            }

            Map<String, Object> settingsPayload = new HashMap<>();
            settingsPayload.put("rollout", Map.of("enabled", false));
            settingsPayload.put("handoff", agent.getHandoffMessage() != null
                    ? Map.of("enabled", agent.isHandoffEnabled(), "message", agent.getHandoffMessage())
                    : Map.of("enabled", agent.isHandoffEnabled()));
            settingsPayload.put("followup", live != null && live.get("followup") != null ? live.get("followup") : Map.of("enabled", false));
            settingsPayload.put("ai_audience", live != null && live.get("ai_audience") != null ? live.get("ai_audience") : "EVERYONE");
            try {
                metaApiClient.put(settingsPath, settingsPayload, Map.class);
            } catch (Exception e) {
                throw new BusinessException("Meta provisioning failed: " + e.getMessage());
            }

            // 3. Bind in DB — unique index wins any race
            agent.setPhoneNumberId(phoneNumberId);
            agent.setWabaId(wabaId);
            agent.setUpdatedBy(accountId);
            try {
                return agentRepository.saveAndFlush(agent);
            } catch (DataIntegrityViolationException e) {
                throw new BusinessException("This phone number is already connected to another agent.");
            }
        }
    }

    private boolean phoneBelongsToWaba(String metaWabaId, String phoneNumberId) {
        Map<?, ?> response;
        try {
            response = metaApiClient.graphGet("/" + metaWabaId + "/phone_numbers", Map.class);
        } catch (Exception e) {
            log.warn("WABA phone membership check failed: wabaId={} error={}", metaWabaId, e.getMessage());
            throw new BusinessException("Meta isn't responding. Wait a moment and try again.");
        }
        Object data = response != null ? response.get("data") : null;
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> phone && phoneNumberId.equals(String.valueOf(phone.get("id")))) {
                    return true;
                }
            }
        }
        return false;
    }

    public List<Agent> listAgents() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return agentAccessService.listAccessible(accountId);
    }

    public Agent getAgent(Long id) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return agentAccessService.getAccessible(id, accountId);
    }

    /**
     * Founder-caught gap (2026-08-07): the frontend's "retry resolving this
     * agent's real name from Meta" button called this exact endpoint, which
     * never existed on the backend at all — a dead 404 button. Also fixes
     * the source: WabaAgentReconciliationService now tries displayPhoneNumber
     * first on creation, so this is really only needed for agents imported
     * before that fix, or where no phone snapshot had synced yet at
     * import time.
     */
    @Transactional
    public Agent refreshName(Long id) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Agent agent = agentAccessService.getAccessible(id, accountId);
        if (agent.getPhoneNumberId() == null || !agent.getDisplayName().startsWith("Imported agent (")) {
            return agent;
        }
        phoneNumberSnapshotRepository.findByAccountIdAndPhoneNumberId(accountId, agent.getPhoneNumberId())
                .map(PhoneNumberSnapshot::getDisplayPhoneNumber)
                .filter(name -> name != null && !name.isBlank())
                .ifPresent(agent::setDisplayName);
        return agentRepository.save(agent);
    }

    /**
     * TASK-068 (founder-reported gap): status/enabled are only ever updated
     * by this app's own deploy()/pause() buttons — if an agent is enabled or
     * disabled directly on Meta (outside this app), our DB silently keeps
     * showing the old state forever. Reactive, TTL-gated (10 min, same as
     * reconcileFiles/Websites/DisplayName) — reads the real
     * agent_config/settings rollout.enabled and corrects status/enabled if
     * they disagree. Best-effort: a slow/failing Meta call just leaves the
     * existing DB value on screen, never blocks the caller (the Dashboard's
     * phone inventory, via WabaService).
     */
    public void reconcileStatus(Agent agent) {
        if (agent.getPhoneNumberId() == null || agent.getStatus() == Agent.Status.draft || agent.getStatus() == Agent.Status.deleted) {
            return;
        }

        LocalDateTime lastReconciled = agent.getStatusReconciledAt();
        if (lastReconciled != null && lastReconciled.isAfter(LocalDateTime.now().minusMinutes(META_RECONCILE_TTL_MINUTES))) {
            return;
        }

        try {
            List<?> settings = metaApiClient.get("/" + agent.getPhoneNumberId() + "/agent_config/settings", List.class);
            Map<?, ?> entry = MetaApiClient.findChannelEntry(settings, "whatsapp");

            // EL-caught (2026-08-03): no whatsapp entry found is UNKNOWN, not
            // "disabled" — a malformed/channel-less response (or a number
            // whose settings haven't propagated yet) must never be treated
            // as confirmation that a live agent is off. Leave the existing
            // status untouched rather than writing a guess.
            if (entry == null) {
                log.warn("No whatsapp channel entry in settings response — leaving existing status as-is: agentId={}", agent.getId());
                return;
            }

            boolean realEnabled = entry.get("rollout") instanceof Map<?, ?> rollout
                    && Boolean.TRUE.equals(rollout.get("enabled"));

            if (realEnabled && agent.getStatus() != Agent.Status.active) {
                agent.setStatus(Agent.Status.active);
            } else if (!realEnabled && agent.getStatus() == Agent.Status.active) {
                agent.setStatus(Agent.Status.paused);
            }
            agent.setEnabled(realEnabled);
            agent.setStatusReconciledAt(LocalDateTime.now());
            agentRepository.save(agent);
        } catch (Exception e) {
            log.warn("Status reconciliation failed for agentId={} — leaving existing status as-is: {}", agent.getId(), e.getMessage());
        }
    }

    /**
     * Full cascade delete — matches the Danger Zone UI promise ("permanently deletes
     * this agent and all its data"). Child tables use ON DELETE RESTRICT (a defensive
     * default from migration time, not a data-retention policy — no compliance/audit
     * requirement was found for conversation data; webhook_raw already auto-purges after
     * 30 days via WebhookRetentionJob), so we delete child rows explicitly, in FK-safe
     * order, before the agent row.
     * Website pages -> websites -> faqs -> skills -> files use plain derived
     * deleteAllByAgentId (entity-by-entity) — fine, these are low-cardinality per agent.
     * Messages, conversations, and webhook_raw use explicit @Modifying @Query bulk
     * DELETE instead — an agent can have thousands of these, so entity-by-entity would N+1.
     */
    @Transactional
    public void deleteAgent(Long id) {
        Agent agent = getAgent(id);

        agentWebsitePageRepository.deleteAllByAgentId(id);
        agentWebsiteRepository.deleteAllByAgentId(id);
        agentFaqRepository.deleteAllByAgentId(id);
        agentSkillRepository.deleteAllByAgentId(id);
        agentUiSkillRepository.deleteAllByAgentId(id);
        agentFileRepository.deleteAllByAgentId(id);
        messageRepository.deleteAllByAgentId(id);
        conversationRepository.deleteAllByAgentId(id);
        webhookRawRepository.deleteAllByAgentId(id);

        agentRepository.delete(agent);
    }

    // --- Skills Management ---

    @Transactional
    public AgentSkill addSkill(Long agentId, SkillRequest request) {
        Agent agent = getAgent(agentId);

        // 1. Sync to Meta first
        String syncPath = MetaApiClient.scopedPath(String.format("/%s/agent_config/skills", agent.getPhoneNumberId()), agent.getMetaAgentId());
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", request.title());
        payload.put("description", request.description());
        payload.put("skill", request.body()); // Meta's field name is "skill", not "body" — confirmed via live 400s (2026-07-28)
        
        String metaSkillId;
        try {
            Map<?, ?> response = metaApiClient.post(syncPath, payload, Map.class);
            metaSkillId = response != null ? (String) response.get("id") : UUID.randomUUID().toString();
        } catch (Exception e) {
            throw new BusinessException("Failed to sync skill to Meta: " + e.getMessage());
        }

        // 2. Save in DB
        AgentSkill skill = AgentSkill.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .agentId(agentId)
                .metaSkillId(metaSkillId)
                .title(request.title())
                .description(request.description())
                .body(request.body())
                .build();
        return agentSkillRepository.save(skill);
    }

    @Transactional
    public void deleteSkill(Long agentId, Long skillId) {
        Agent agent = getAgent(agentId);
        AgentSkill skill = agentSkillRepository.findByIdAndAgentId(skillId, agentId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));

        // 1. Meta first — throws BusinessException on failure; DB delete never reached
        String syncPath = MetaApiClient.scopedPath(
                String.format("/%s/agent_config/skills/%s", agent.getPhoneNumberId(), skill.getMetaSkillId()),
                agent.getMetaAgentId());
        metaApiClient.delete(syncPath);

        // 2. DB delete only if Meta succeeded
        agentSkillRepository.delete(skill);
    }

    /** Reads from our local mirror, not a live Meta proxy — same convention as getFaqs(). */
    public List<AgentSkill> getSkills(Long agentId) {
        Agent agent = getAgent(agentId);
        metaMirrorReconciler.ensureSkillsBackfilled(agent, SecurityContextHelper.getRequiredAccountId());
        return agentSkillRepository.findAllByAgentId(agentId);
    }

    public AgentSkill getSkill(Long agentId, Long skillId) {
        getAgent(agentId);
        return agentSkillRepository.findByIdAndAgentId(skillId, agentId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));
    }

    @Transactional
    public AgentSkill updateSkill(Long agentId, Long skillId, SkillRequest request) {
        Agent agent = getAgent(agentId);
        AgentSkill skill = agentSkillRepository.findByIdAndAgentId(skillId, agentId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));

        // 1. Meta first — full replace, same field-name rule as create
        String syncPath = MetaApiClient.scopedPath(
                String.format("/%s/agent_config/skills/%s", agent.getPhoneNumberId(), skill.getMetaSkillId()),
                agent.getMetaAgentId());
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", request.title());
        payload.put("description", request.description());
        payload.put("skill", request.body());
        try {
            metaApiClient.put(syncPath, payload, Map.class);
        } catch (Exception e) {
            throw new BusinessException("Failed to update skill on Meta: " + e.getMessage());
        }

        // 2. Update local mirror only if Meta succeeded
        skill.setTitle(request.title());
        skill.setDescription(request.description());
        skill.setBody(request.body());
        return agentSkillRepository.save(skill);
    }

    // --- UI Skills Management (F22) ---
    // Distinct Meta surface from agent_config/skills above -- a UI skill
    // tells the agent WHEN/HOW to send a rich-message component (carousel,
    // CTA button, interactive list, location request); it does not carry the
    // component's own content, Meta's schema for it is just a routing/
    // trigger definition. `flow` component_type is intentionally excluded
    // (Flows out of scope, see F9). Base path is api.facebook.com (the
    // default restClient), not the Graph API -- confirmed against
    // docs/meta-api/ui-skills.md, no live call made yet as of this write.

    private static String uiSkillPath(Agent agent) {
        return "/" + agent.getPhoneNumberId() + "/agent-ui-skills";
    }

    @Transactional
    public AgentUiSkill addUiSkill(Long agentId, UiSkillRequest request) {
        Agent agent = getAgent(agentId);
        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException("Connect a phone number before adding a UI skill.");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", request.title());
        payload.put("component_type", request.componentType().name());
        payload.put("status", request.status().name());
        payload.put("instruction", request.instruction());

        String metaUiSkillId;
        try {
            Map<?, ?> response = metaApiClient.post(uiSkillPath(agent), payload, Map.class);
            metaUiSkillId = response != null ? (String) response.get("id") : null;
        } catch (Exception e) {
            throw new BusinessException("Failed to create UI skill on Meta: " + e.getMessage());
        }

        AgentUiSkill skill = AgentUiSkill.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .agentId(agentId)
                .metaUiSkillId(metaUiSkillId)
                .title(request.title())
                .componentType(request.componentType())
                .status(request.status())
                .instruction(request.instruction())
                .build();
        return agentUiSkillRepository.save(skill);
    }

    /** Reads from our local mirror -- no reconciler backfill yet (genuinely new capability, nothing live on Meta predates this). */
    public List<AgentUiSkill> getUiSkills(Long agentId) {
        getAgent(agentId);
        return agentUiSkillRepository.findAllByAgentId(agentId);
    }

    public AgentUiSkill getUiSkill(Long agentId, Long uiSkillId) {
        getAgent(agentId);
        return agentUiSkillRepository.findByIdAndAgentId(uiSkillId, agentId)
                .orElseThrow(() -> new NotFoundException("UI skill not found"));
    }

    @Transactional
    public AgentUiSkill updateUiSkill(Long agentId, Long uiSkillId, UiSkillRequest request) {
        Agent agent = getAgent(agentId);
        AgentUiSkill skill = agentUiSkillRepository.findByIdAndAgentId(uiSkillId, agentId)
                .orElseThrow(() -> new NotFoundException("UI skill not found"));

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", request.title());
        payload.put("component_type", request.componentType().name());
        payload.put("status", request.status().name());
        payload.put("instruction", request.instruction());
        try {
            metaApiClient.put(uiSkillPath(agent) + "/" + skill.getMetaUiSkillId(), payload, Map.class);
        } catch (Exception e) {
            throw new BusinessException("Failed to update UI skill on Meta: " + e.getMessage());
        }

        skill.setTitle(request.title());
        skill.setComponentType(request.componentType());
        skill.setStatus(request.status());
        skill.setInstruction(request.instruction());
        return agentUiSkillRepository.save(skill);
    }

    @Transactional
    public void deleteUiSkill(Long agentId, Long uiSkillId) {
        Agent agent = getAgent(agentId);
        AgentUiSkill skill = agentUiSkillRepository.findByIdAndAgentId(uiSkillId, agentId)
                .orElseThrow(() -> new NotFoundException("UI skill not found"));

        try {
            metaApiClient.delete(uiSkillPath(agent) + "/" + skill.getMetaUiSkillId());
        } catch (Exception e) {
            throw new BusinessException("Failed to delete UI skill on Meta: " + e.getMessage());
        }
        agentUiSkillRepository.delete(skill);
    }

    // --- FAQ Management ---

    private static final long META_RECONCILE_TTL_MINUTES = 10;

    public List<AgentFaq> getFaqs(Long agentId) {
        Agent agent = getAgent(agentId);
        metaMirrorReconciler.ensureFaqsBackfilled(agent, SecurityContextHelper.getRequiredAccountId());
        metaMirrorReconciler.reconcileFaqs(agent);
        return agentFaqRepository.findAllByAgentId(agentId);
    }

    public AgentFaq getFaq(Long agentId, Long faqId) {
        getAgent(agentId);
        return agentFaqRepository.findByIdAndAgentId(faqId, agentId)
                .orElseThrow(() -> new NotFoundException("FAQ not found"));
    }

    @Transactional
    public AgentFaq addFaq(Long agentId, FaqRequest request) {
        Agent agent = getAgent(agentId);

        // Sync to Meta only if the agent already has a phone number bound.
        // Draft agents (no phone) save locally; sync happens at deploy time.
        String metaFaqId = UUID.randomUUID().toString();
        boolean syncAttempted = agent.getPhoneNumberId() != null;
        boolean metaSynced = !syncAttempted; // draft agents: nothing to sync yet, not a failure
        if (syncAttempted) {
            String syncPath = String.format("/%s/agent_config/faq", agent.getPhoneNumberId());
            Map<String, Object> payload = new HashMap<>();
            payload.put("question", request.question());
            payload.put("answer", request.answer());
            try {
                Map<?, ?> response = metaApiClient.post(syncPath, payload, Map.class);
                if (response != null && response.get("id") != null) {
                    metaFaqId = (String) response.get("id");
                }
                metaSynced = true;
            } catch (Exception e) {
                log.warn("Meta FAQ sync failed for agentId={} — saved locally only: {}", agentId, e.getMessage());
            }
        }

        AgentFaq faq = AgentFaq.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .agentId(agentId)
                .metaFaqId(metaFaqId)
                .metaSynced(metaSynced)
                .metaSyncAttempted(syncAttempted)
                .question(request.question())
                .answer(request.answer())
                .build();
        return agentFaqRepository.save(faq);
    }

    @Transactional
    public void deleteFaq(Long agentId, Long faqId) {
        Agent agent = getAgent(agentId);
        AgentFaq faq = agentFaqRepository.findByIdAndAgentId(faqId, agentId)
                .orElseThrow(() -> new NotFoundException("FAQ not found"));

        // 1. Sync delete to Meta only if agent has a phone number bound.
        // Draft agents (no phone) have local-only FAQs — delete from DB directly.
        //
        // KNOWN GAP, explicitly deferred (EL flagged during TASK-059 review,
        // not silently missed): if the Meta delete call fails here, we still
        // delete the local row below — so the FAQ keeps answering live on
        // WhatsApp with zero local trace left to ever detect or retry the
        // failed delete. This is worse than the addFaq/updateFaq failure
        // case, where metaSynced=false at least leaves a visible row. Fixing
        // this properly needs a "pending delete" tombstone concept (keep the
        // row, hide it from getFaqs, retry the Meta delete on next
        // reconcile) — real scope, not a one-line fix, and out of bounds for
        // this P0 pass. Not building it now; flagged here for a follow-up task.
        if (agent.getPhoneNumberId() != null) {
            String syncPath = String.format("/%s/agent_config/faq/%s", agent.getPhoneNumberId(), faq.getMetaFaqId());
            try {
                metaApiClient.delete(syncPath);
            } catch (Exception e) {
                log.warn("Meta FAQ delete sync failed for agentId={} faqId={} — deleting locally only, Meta may still have this FAQ live: {}", agentId, faqId, e.getMessage());
            }
        }

        // 2. Always delete from DB
        agentFaqRepository.delete(faq);
    }

    @Transactional
    public AgentFaq updateFaq(Long agentId, Long faqId, FaqRequest request) {
        Agent agent = getAgent(agentId);
        AgentFaq faq = agentFaqRepository.findByIdAndAgentId(faqId, agentId)
                .orElseThrow(() -> new NotFoundException("FAQ not found"));

        // Sync to Meta only if bound — same "draft agents are local-only" rule as addFaq
        if (agent.getPhoneNumberId() != null) {
            String syncPath = MetaApiClient.scopedPath(
                    String.format("/%s/agent_config/faq/%s", agent.getPhoneNumberId(), faq.getMetaFaqId()),
                    agent.getMetaAgentId());
            Map<String, Object> payload = new HashMap<>();
            payload.put("question", request.question());
            payload.put("answer", request.answer());
            try {
                metaApiClient.put(syncPath, payload, Map.class);
                faq.setMetaSynced(true);
                faq.setMetaSyncAttempted(true);
            } catch (Exception e) {
                // Same tolerance as addFaq/deleteFaq: local state stays authoritative,
                // Meta drift is logged not thrown — a transient Meta outage must not
                // block an operator from fixing a typo in their own FAQ content.
                // metaSynced=false makes this visible instead of silent (TASK-059).
                // metaSyncAttempted=true — a real attempt happened and failed,
                // unlike a draft-agent row where nothing was attempted at all.
                faq.setMetaSynced(false);
                faq.setMetaSyncAttempted(true);
                log.warn("Meta FAQ update sync failed for agentId={} faqId={} — updating locally only: {}", agentId, faqId, e.getMessage());
            }
        }

        faq.setQuestion(request.question());
        faq.setAnswer(request.answer());
        return agentFaqRepository.save(faq);
    }

    // --- File Ingestion & Guardrails ---

    @Transactional
    public AgentFile addFile(Long agentId, MultipartFile file) {
        Agent agent = getAgent(agentId);

        // Ingestion Guardrail: Size check (10MB limit)
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("File size exceeds 10MB limit");
        }

        // Ingestion Guardrail: Extension check (strictly PDF/Docx)
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            throw new BusinessException("Filename is missing");
        }
        String extension = getFileExtension(originalFilename);
        if (!ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new BusinessException("Unsupported file type. Only PDF and DOCX files are allowed.");
        }

        // 1. Sync to Meta first (multipart/form-data)
        String syncPath = String.format("/%s/agent_config/files", agent.getPhoneNumberId());
        String metaFileId;
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file_name", originalFilename);
            
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return originalFilename;
                }
            };
            body.add("file", fileResource);

            Map<?, ?> response = metaApiClient.post(syncPath, body, Map.class);
            metaFileId = response != null ? (String) response.get("id") : UUID.randomUUID().toString();
        } catch (Exception e) {
            throw new BusinessException("Failed to upload file to Meta: " + e.getMessage());
        }

        // 2. Save in DB
        AgentFile agentFile = AgentFile.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .agentId(agentId)
                .metaFileId(metaFileId)
                .filename(originalFilename)
                .mimeType(file.getContentType())
                .sizeBytes(file.getSize())
                .build();
        return agentFileRepository.save(agentFile);
    }

    @Transactional
    public void deleteFile(Long agentId, Long fileId) {
        Agent agent = getAgent(agentId);
        AgentFile file = agentFileRepository.findByIdAndAgentId(fileId, agentId)
                .orElseThrow(() -> new NotFoundException("File not found"));

        // 1. Meta first — throws BusinessException on failure; DB delete never reached
        String syncPath = String.format("/%s/agent_config/files/%s", agent.getPhoneNumberId(), file.getMetaFileId());
        metaApiClient.delete(syncPath);

        // 2. DB delete only if Meta succeeded
        agentFileRepository.delete(file);
    }

    /** Meta's files API has no update verb — list/single read only, no PUT. */
    public List<AgentFile> getFiles(Long agentId) {
        Agent agent = getAgent(agentId);
        metaMirrorReconciler.ensureFilesBackfilled(agent, SecurityContextHelper.getRequiredAccountId());
        metaMirrorReconciler.reconcileFiles(agent);
        return agentFileRepository.findAllByAgentId(agentId);
    }

    public AgentFile getFile(Long agentId, Long fileId) {
        getAgent(agentId);
        return agentFileRepository.findByIdAndAgentId(fileId, agentId)
                .orElseThrow(() -> new NotFoundException("File not found"));
    }

    // --- Website Crawling & Ingestion Guardrails ---

    @Transactional
    public AgentWebsite addWebsite(Long agentId, WebsiteRequest request) {
        Agent agent = getAgent(agentId);

        // 1. Sync to Meta first
        String syncPath = String.format("/%s/agent_config/websites", agent.getPhoneNumberId());
        Map<String, Object> payload = new HashMap<>();
        payload.put("url", request.url());

        String metaWebsiteId;
        try {
            Map<?, ?> response = metaApiClient.post(syncPath, payload, Map.class);
            metaWebsiteId = response != null ? (String) response.get("id") : UUID.randomUUID().toString();
        } catch (Exception e) {
            throw new BusinessException("Failed to sync website to Meta: " + e.getMessage());
        }

        // 2. Save in DB
        AgentWebsite website = AgentWebsite.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .agentId(agentId)
                .metaWebsiteId(metaWebsiteId)
                .url(request.url())
                .crawlStatus("pending")
                .pagesCrawled(0)
                .build();
        // Meta crawls the website natively — no local crawl needed
        return agentWebsiteRepository.save(website);
    }

    @Transactional
    public void deleteWebsite(Long agentId, Long websiteId) {
        Agent agent = getAgent(agentId);
        AgentWebsite website = agentWebsiteRepository.findByIdAndAgentId(websiteId, agentId)
                .orElseThrow(() -> new NotFoundException("Website not found"));

        // 1. Meta first — throws BusinessException on failure; DB deletes never reached
        String syncPath = String.format("/%s/agent_config/websites/%s", agent.getPhoneNumberId(), website.getMetaWebsiteId());
        metaApiClient.delete(syncPath);

        // 2. Clean up crawled pages from DB
        agentWebsitePageRepository.deleteAllByWebsiteId(websiteId);

        // 3. Delete website from DB
        agentWebsiteRepository.delete(website);
    }

    public List<AgentWebsite> getWebsites(Long agentId) {
        Agent agent = getAgent(agentId);
        metaMirrorReconciler.ensureWebsitesBackfilled(agent, SecurityContextHelper.getRequiredAccountId());
        metaMirrorReconciler.reconcileWebsites(agent);
        return agentWebsiteRepository.findAllByAgentId(agentId);
    }

    /**
     * Scheduler entry point — bundles every per-domain backfill+reconcile pair
     * (Skills/FAQs/Files/Websites) for one agent, called from a background
     * job with no request/SecurityContext, hence the explicit accountId param
     * instead of the getSkills()/getFaqs()/etc. public methods (which require
     * SecurityContextHelper.getRequiredAccountId() through getAgent()'s access
     * check — never call that from an async/scheduled thread, no context to
     * read). Delegates to MetaMirrorReconciler, which owns all backfill/
     * reconcile logic (roadmap item 44 extraction). Status (active/paused vs
     * Meta) is intentionally NOT bundled here — it runs on its own,
     * shorter-cadence tier since it drives the Dashboard's "needs attention"
     * view and doesn't need the heavier per-domain calls.
     */
    public void syncAgentDetails(Agent agent, Long accountId) {
        metaMirrorReconciler.syncAgentDetails(agent, accountId);
    }

    /**
     * TASK-065 aggregate view: every file/website across every agent on a
     * WABA. Unlike listSkills (which does a live per-skill reconciliation
     * gate), this reads local rows only — reconcileFiles/reconcileWebsites
     * already run reactively on each agent's own per-agent getFiles/
     * getWebsites call, so metaSynced here reflects whatever the last
     * per-agent view triggered, not a fresh check on every aggregate load.
     */
    public List<com.metaagent.platform.domain.agent.dto.FileLibraryDtos.FileRow> getAllFilesForWaba(Long wabaId, Long accountId) {
        List<Agent> agents = requireWabaAgents(wabaId, accountId);
        Map<Long, Agent> agentsById = agents.stream().collect(java.util.stream.Collectors.toMap(Agent::getId, a -> a));
        List<Long> agentIds = agents.stream().map(Agent::getId).toList();
        if (agentIds.isEmpty()) return List.of();

        List<com.metaagent.platform.domain.agent.dto.FileLibraryDtos.FileRow> rows = new ArrayList<>();
        for (AgentFile f : agentFileRepository.findAllByAgentIdIn(agentIds)) {
            Agent agent = agentsById.get(f.getAgentId());
            rows.add(new com.metaagent.platform.domain.agent.dto.FileLibraryDtos.FileRow(
                    String.valueOf(f.getId()), f.getFilename(), f.isMetaSynced(),
                    String.valueOf(f.getAgentId()), agent != null ? agent.getDisplayName() : null,
                    agent != null ? agent.getPhoneNumberId() : null,
                    f.getCreatedAt().toString()));
        }
        return rows;
    }

    public List<com.metaagent.platform.domain.agent.dto.FileLibraryDtos.WebsiteRow> getAllWebsitesForWaba(Long wabaId, Long accountId) {
        List<Agent> agents = requireWabaAgents(wabaId, accountId);
        Map<Long, Agent> agentsById = agents.stream().collect(java.util.stream.Collectors.toMap(Agent::getId, a -> a));
        List<Long> agentIds = agents.stream().map(Agent::getId).toList();
        if (agentIds.isEmpty()) return List.of();

        List<com.metaagent.platform.domain.agent.dto.FileLibraryDtos.WebsiteRow> rows = new ArrayList<>();
        for (AgentWebsite w : agentWebsiteRepository.findAllByAgentIdIn(agentIds)) {
            Agent agent = agentsById.get(w.getAgentId());
            rows.add(new com.metaagent.platform.domain.agent.dto.FileLibraryDtos.WebsiteRow(
                    String.valueOf(w.getId()), w.getUrl(), w.isMetaSynced(),
                    String.valueOf(w.getAgentId()), agent != null ? agent.getDisplayName() : null,
                    agent != null ? agent.getPhoneNumberId() : null,
                    w.getUpdatedAt().toString()));
        }
        return rows;
    }

    private List<Agent> requireWabaAgents(Long wabaId, Long accountId) {
        wabaAccessGuard.requireAccess(wabaId, accountId);
        return agentRepository.findAllByWabaId(wabaId);
    }

    public AgentWebsite getWebsite(Long agentId, Long websiteId) {
        getAgent(agentId);
        return agentWebsiteRepository.findByIdAndAgentId(websiteId, agentId)
                .orElseThrow(() -> new NotFoundException("Website not found"));
    }

    /**
     * Updates the crawl URL on Meta and syncs whatever crawl state Meta
     * returns back into our mirror — Meta owns crawl_status/pages_crawled
     * asynchronously after our writes, so every successful write is also a
     * read-back opportunity, not just a blind proxy.
     */
    @Transactional
    public AgentWebsite updateWebsite(Long agentId, Long websiteId, WebsiteRequest request) {
        Agent agent = getAgent(agentId);
        AgentWebsite website = agentWebsiteRepository.findByIdAndAgentId(websiteId, agentId)
                .orElseThrow(() -> new NotFoundException("Website not found"));

        String syncPath = MetaApiClient.scopedPath(
                String.format("/%s/agent_config/websites/%s", agent.getPhoneNumberId(), website.getMetaWebsiteId()),
                agent.getMetaAgentId());
        Map<String, Object> payload = Map.of("url", request.url());
        Map<?, ?> response;
        try {
            response = metaApiClient.put(syncPath, payload, Map.class);
        } catch (Exception e) {
            throw new BusinessException("Failed to update website on Meta: " + e.getMessage());
        }

        website.setUrl(request.url());
        if (response != null && response.get("crawl_status") != null) {
            website.setCrawlStatus(response.get("crawl_status").toString());
        }
        if (response != null && response.get("pages_crawled") instanceof Number n) {
            website.setPagesCrawled(n.intValue());
        }
        return agentWebsiteRepository.save(website);
    }

    private String getFileExtension(String filename) {
        int lastIndex = filename.lastIndexOf('.');
        if (lastIndex == -1) {
            return "";
        }
        return filename.substring(lastIndex + 1);
    }
}
