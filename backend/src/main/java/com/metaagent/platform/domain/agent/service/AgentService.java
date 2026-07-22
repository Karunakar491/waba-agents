package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.AgentRequest;
import com.metaagent.platform.domain.agent.dto.FaqRequest;
import com.metaagent.platform.domain.agent.dto.SkillRequest;
import com.metaagent.platform.domain.agent.dto.WebsiteRequest;
import com.metaagent.platform.domain.agent.entity.*;
import com.metaagent.platform.domain.agent.repository.*;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
    private final AgentFaqRepository agentFaqRepository;
    private final AgentFileRepository agentFileRepository;
    private final AgentWebsiteRepository agentWebsiteRepository;
    private final AgentWebsitePageRepository agentWebsitePageRepository;
    private final WabaRepository wabaRepository;
    private final MetaApiClient metaApiClient;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "docx");

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
        return agentRepository.save(agent);
    }

    /**
     * Binds a WABA phone number to an agent (spec section 5).
     * Meta-first: eligibility check + provisioning before the DB write.
     * Race-safe: unique index on agent.phone_number_id — a concurrent bind of the
     * same number fails on save, never silently double-binds.
     */
    @Transactional
    public Agent bindPhone(Long agentId, String phoneNumberId, Long wabaId) {
        Agent agent = getAgent(agentId);

        // WABA must belong to the caller's account — no cross-tenant references
        Waba waba = wabaRepository.findByIdAndAccountId(wabaId, agent.getAccountId())
                .orElseThrow(() -> new NotFoundException("WABA not found"));

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

        // 2. Provision on Meta — disabled until user activates
        // Settings PUT is a full replace — always send all fields (spec rule)
        String settingsPath = String.format("/%s/agent_config/settings", phoneNumberId);
        Map<String, Object> settingsPayload = Map.of(
                "rollout", Map.of("enabled", false),
                "handoff", Map.of("enabled", false),
                "followup", Map.of("enabled", false),
                "ai_audience", "EVERYONE"
        );
        try {
            metaApiClient.put(settingsPath, settingsPayload, Map.class);
        } catch (Exception e) {
            throw new BusinessException("Meta provisioning failed: " + e.getMessage());
        }

        // 3. Bind in DB — unique index wins any race
        agent.setPhoneNumberId(phoneNumberId);
        agent.setWabaId(wabaId);
        try {
            return agentRepository.saveAndFlush(agent);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("This phone number is already connected to another agent.");
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
        return agentRepository.findAllByAccountId(accountId);
    }

    public Agent getAgent(Long id) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return agentRepository.findByIdAndAccountId(id, accountId)
                .orElseThrow(() -> new NotFoundException("Agent not found"));
    }

    @Transactional
    public void deleteAgent(Long id) {
        Agent agent = getAgent(id);
        // Note: CASCADE is RESTRICTED, so DB foreign keys prevent deleting agents with active items
        agentRepository.delete(agent);
    }

    // --- Skills Management ---

    @Transactional
    public AgentSkill addSkill(Long agentId, SkillRequest request) {
        Agent agent = getAgent(agentId);

        // 1. Sync to Meta first
        String syncPath = String.format("/%s/agent_config/skills", agent.getPhoneNumberId());
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", request.title());
        payload.put("description", request.description());
        payload.put("body", request.body());
        
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
        String syncPath = String.format("/%s/agent_config/skills/%s", agent.getPhoneNumberId(), skill.getMetaSkillId());
        metaApiClient.delete(syncPath);

        // 2. DB delete only if Meta succeeded
        agentSkillRepository.delete(skill);
    }

    // --- FAQ Management ---

    @Transactional
    public AgentFaq addFaq(Long agentId, FaqRequest request) {
        Agent agent = getAgent(agentId);

        // Sync to Meta only if the agent already has a phone number bound.
        // Draft agents (no phone) save locally; sync happens at deploy time.
        String metaFaqId = UUID.randomUUID().toString();
        if (agent.getPhoneNumberId() != null) {
            String syncPath = String.format("/%s/agent_config/faq", agent.getPhoneNumberId());
            Map<String, Object> payload = new HashMap<>();
            payload.put("question", request.question());
            payload.put("answer", request.answer());
            try {
                Map<?, ?> response = metaApiClient.post(syncPath, payload, Map.class);
                if (response != null && response.get("id") != null) {
                    metaFaqId = (String) response.get("id");
                }
            } catch (Exception e) {
                log.warn("Meta FAQ sync failed for agentId={} — saved locally only: {}", agentId, e.getMessage());
            }
        }

        AgentFaq faq = AgentFaq.builder()
                .accountId(SecurityContextHelper.getRequiredAccountId())
                .agentId(agentId)
                .metaFaqId(metaFaqId)
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
        if (agent.getPhoneNumberId() != null) {
            String syncPath = String.format("/%s/agent_config/faq/%s", agent.getPhoneNumberId(), faq.getMetaFaqId());
            try {
                metaApiClient.delete(syncPath);
            } catch (Exception e) {
                log.warn("Meta FAQ delete sync failed for agentId={} faqId={} — deleting locally only: {}", agentId, faqId, e.getMessage());
            }
        }

        // 2. Always delete from DB
        agentFaqRepository.delete(faq);
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

    private String getFileExtension(String filename) {
        int lastIndex = filename.lastIndexOf('.');
        if (lastIndex == -1) {
            return "";
        }
        return filename.substring(lastIndex + 1);
    }
}
