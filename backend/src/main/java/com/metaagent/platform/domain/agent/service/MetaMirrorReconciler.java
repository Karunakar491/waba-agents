package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentFaq;
import com.metaagent.platform.domain.agent.entity.AgentFile;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.entity.AgentWebsite;
import com.metaagent.platform.domain.agent.repository.AgentFaqRepository;
import com.metaagent.platform.domain.agent.repository.AgentFileRepository;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentSkillRepository;
import com.metaagent.platform.domain.agent.repository.AgentWebsiteRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Extracted from AgentService (roadmap item 44): every "keep our local mirror
 * honest against Meta" concern for one agent — backfill (create local rows
 * for content that only exists live on Meta, e.g. an imported agent) and
 * reconcile (flip meta_synced when local/Meta drift after the fact). Each
 * pair is reactive (fires on that domain's own read, never a fresh Meta call
 * from an aggregate multi-agent listing) and best-effort — never throws, logs
 * a warning and leaves existing state as-is on failure. See AgentService's
 * getSkills/getFaqs/getFiles/getWebsites callers for the original per-domain
 * task history (TASK-054, TASK-059, TASK-061/062).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetaMirrorReconciler {

    private final AgentRepository agentRepository;
    private final AgentSkillRepository agentSkillRepository;
    private final AgentFaqRepository agentFaqRepository;
    private final AgentFileRepository agentFileRepository;
    private final AgentWebsiteRepository agentWebsiteRepository;
    private final MetaApiClient metaApiClient;

    private static final long META_RECONCILE_TTL_MINUTES = 10;

    /**
     * Scheduler entry point — bundles every per-domain backfill+reconcile pair
     * (Skills/FAQs/Files/Websites) for one agent, called from a background
     * job with no request/SecurityContext, hence the explicit accountId param
     * instead of AgentService's getSkills()/getFaqs()/etc. public methods
     * (which require SecurityContextHelper.getRequiredAccountId() through
     * getAgent()'s access check — never call that from an async/scheduled
     * thread, no context to read). Each of the 4 calls is already
     * independently try/catch/log.warn safe, so one domain failing never
     * blocks the other 3 for this agent.
     */
    public void syncAgentDetails(Agent agent, Long accountId) {
        ensureSkillsBackfilled(agent, accountId);
        ensureFaqsBackfilled(agent, accountId);
        reconcileFaqs(agent);
        ensureFilesBackfilled(agent, accountId);
        reconcileFiles(agent);
        ensureWebsitesBackfilled(agent, accountId);
        reconcileWebsites(agent);
    }

    /**
     * TASK-054: an agent discovered via reconciliation (found already live on
     * Meta, not built through our own wizard) may have real skills configured
     * directly on Meta that we've never recorded locally — our Skills feature
     * only reads from this local mirror, never live from Meta. No-op if
     * local rows already exist; on empty, fetch once from Meta and mirror
     * into agent_skill. Same try/catch/log.warn "don't fail the primary read"
     * pattern already used in WabaAgentReconciliationService — never throws.
     */
    void ensureSkillsBackfilled(Agent agent, Long accountId) {
        if (!agentSkillRepository.findAllByAgentId(agent.getId()).isEmpty()) return;
        if (agent.getPhoneNumberId() == null) return;

        try {
            String path = MetaApiClient.scopedPath(
                    String.format("/%s/agent_config/skills", agent.getPhoneNumberId()), agent.getMetaAgentId());
            List<?> remoteSkills = metaApiClient.get(path, List.class);
            if (remoteSkills == null) return;

            for (Object item : remoteSkills) {
                if (!(item instanceof Map<?, ?> skill)) continue;
                Object id = skill.get("id");
                Object title = skill.get("title");
                Object description = skill.get("description");
                Object body = skill.get("skill"); // Meta's field name is "skill", not "body"
                if (title == null || body == null) continue;

                agentSkillRepository.save(AgentSkill.builder()
                        .accountId(accountId)
                        .agentId(agent.getId())
                        .metaSkillId(id != null ? id.toString() : null)
                        .title(title.toString())
                        .description(description != null ? description.toString() : "")
                        .body(body.toString())
                        .build());
            }
        } catch (Exception e) {
            log.warn("Skill backfill failed: agentId={} error={}", agent.getId(), e.getMessage());
        }
    }

    /**
     * Same gap as TASK-054's ensureSkillsBackfilled, just never closed for FAQs:
     * an agent discovered via reconciliation (imported, not built through our
     * wizard) can have real FAQs live on Meta with zero local agent_faq rows.
     * reconcileFaqs() alone can never fix this — it only flips meta_synced on
     * rows that already exist locally, it has no path to create a row from
     * nothing. No-op if local rows already exist (never overwrites a real edit
     * in progress) or the agent has no phoneNumberId yet (draft, nothing to
     * fetch). Same try/catch/log.warn "never fail the primary read" pattern
     * as ensureSkillsBackfilled — best-effort, reactive, single-agent-read
     * only.
     */
    void ensureFaqsBackfilled(Agent agent, Long accountId) {
        if (!agentFaqRepository.findAllByAgentId(agent.getId()).isEmpty()) return;
        if (agent.getPhoneNumberId() == null) return;

        try {
            String path = String.format("/%s/agent_config/faq", agent.getPhoneNumberId());
            List<?> remoteFaqs = metaApiClient.get(path, List.class);
            if (remoteFaqs == null) return;

            for (Object item : remoteFaqs) {
                if (!(item instanceof Map<?, ?> faq)) continue;
                Object id = faq.get("id");
                Object question = faq.get("question");
                Object answer = faq.get("answer");
                if (question == null || answer == null) continue;

                agentFaqRepository.save(AgentFaq.builder()
                        .accountId(accountId)
                        .agentId(agent.getId())
                        .metaFaqId(id != null ? id.toString() : null)
                        .question(question.toString())
                        .answer(answer.toString())
                        .build());
            }
        } catch (Exception e) {
            log.warn("FAQ backfill failed: agentId={} error={}", agent.getId(), e.getMessage());
        }
    }

    /**
     * TASK-059 (P0): before this, a failed Meta sync in addFaq/updateFaq only
     * logged a WARN — nothing ever confirmed whether our DB and Meta's actual
     * FAQ list still agreed, so a silent sync failure could sit undetected
     * indefinitely. Reactive, fires on the single-agent read (never from an
     * aggregate multi-agent listing, same rule as Skills' ensureSkillsBackfilled)
     * — never throws, best-effort.
     *
     * TTL-gated (`Agent.faqReconciledAt`) — only spends a Meta call if this
     * agent's FAQs haven't been reconciled in the last
     * {@value #META_RECONCILE_TTL_MINUTES} minutes. Skips any row where
     * `metaSyncAttempted` is false — a draft agent's FAQs are created with
     * `metaSyncAttempted=false` and a random locally-generated `metaFaqId`;
     * comparing those against Meta's real FAQ list would falsely flag them
     * "Not synced" when they were never supposed to be there yet.
     *
     * Pulls Meta's live FAQ list once, marks any attempted-but-not-found row
     * as metaSynced=false (covers both "the push silently failed" and
     * "someone deleted/changed it on Meta directly, outside this app"), and
     * marks any row that IS present back to true — so a transient failure
     * that later self-heals doesn't stay flagged forever.
     */
    void reconcileFaqs(Agent agent) {
        if (agent.getPhoneNumberId() == null) return;

        LocalDateTime lastReconciled = agent.getFaqReconciledAt();
        if (lastReconciled != null && lastReconciled.isAfter(LocalDateTime.now().minusMinutes(META_RECONCILE_TTL_MINUTES))) {
            return;
        }

        List<AgentFaq> localFaqs = agentFaqRepository.findAllByAgentId(agent.getId());
        List<AgentFaq> attemptedFaqs = localFaqs.stream().filter(AgentFaq::isMetaSyncAttempted).toList();

        try {
            if (!attemptedFaqs.isEmpty()) {
                // No scopedPath/agent_id here — addFaq/deleteFaq's Meta calls
                // for this same resource never scope by agent_id either (only
                // updateFaq does, a pre-existing inconsistency, not something
                // to imitate for a new call). Confirmed live: adding
                // ?agent_id= to this GET caused a real Meta 500 on every call.
                String path = String.format("/%s/agent_config/faq", agent.getPhoneNumberId());
                List<?> remoteFaqs = metaApiClient.get(path, List.class);

                var remoteIds = new java.util.HashSet<String>();
                if (remoteFaqs != null) {
                    for (Object item : remoteFaqs) {
                        if (item instanceof Map<?, ?> faq && faq.get("id") != null) {
                            remoteIds.add(String.valueOf(faq.get("id")));
                        }
                    }
                }

                for (AgentFaq local : attemptedFaqs) {
                    boolean present = local.getMetaFaqId() != null && remoteIds.contains(local.getMetaFaqId());
                    if (local.isMetaSynced() != present) {
                        local.setMetaSynced(present);
                        agentFaqRepository.save(local);
                    }
                }
            }
            agent.setFaqReconciledAt(LocalDateTime.now());
            agentRepository.save(agent);
        } catch (Exception e) {
            log.warn("FAQ reconciliation failed for agentId={} — leaving existing meta_synced flags as-is: {}", agent.getId(), e.getMessage());
        }
    }

    /**
     * Same gap as ensureSkillsBackfilled/ensureFaqsBackfilled, closed here too:
     * reconcileFiles() below only flips meta_synced on rows that already exist
     * locally — it has no path to create a row for an imported agent with real
     * files on Meta and zero local rows. Meta's file list only returns `id`
     * and `file_name` (confirmed in docs/meta-api/files.md) — no mime type or
     * size — so those two NOT NULL columns get an honest placeholder
     * (inferred from the filename extension, "application/octet-stream" if
     * unrecognized; size 0, genuinely unknown) rather than fabricating a value
     * Meta never reported.
     */
    void ensureFilesBackfilled(Agent agent, Long accountId) {
        if (!agentFileRepository.findAllByAgentId(agent.getId()).isEmpty()) return;
        if (agent.getPhoneNumberId() == null) return;

        try {
            String path = String.format("/%s/agent_config/files", agent.getPhoneNumberId());
            List<?> remoteFiles = metaApiClient.get(path, List.class);
            if (remoteFiles == null) return;

            for (Object item : remoteFiles) {
                if (!(item instanceof Map<?, ?> file)) continue;
                Object id = file.get("id");
                Object fileName = file.get("file_name");
                if (fileName == null) continue;

                agentFileRepository.save(AgentFile.builder()
                        .accountId(accountId)
                        .agentId(agent.getId())
                        .metaFileId(id != null ? id.toString() : null)
                        .filename(fileName.toString())
                        .mimeType(guessMimeTypeFromFilename(fileName.toString()))
                        .sizeBytes(0L)
                        .build());
            }
        } catch (Exception e) {
            log.warn("File backfill failed: agentId={} error={}", agent.getId(), e.getMessage());
        }
    }

    private static String guessMimeTypeFromFilename(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".doc")) return "application/msword";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return "application/octet-stream";
    }

    /**
     * TASK-062: second item of the TASK-061 Meta-sync backlog. Same shape as
     * reconcileFaqs (TASK-059) — reactive (single-agent read only), TTL-gated
     * (Agent.fileReconciledAt, 10 min) so it doesn't call Meta on every read,
     * best-effort (never throws). Simpler than FAQ's version: addFile
     * already throws hard on a failed Meta upload, so there's no
     * "local-only, never attempted" row state to filter out here — every
     * local row implies its Meta create call already succeeded. The only
     * drift this can find is content changed/deleted directly on Meta,
     * outside this app.
     */
    void reconcileFiles(Agent agent) {
        if (agent.getPhoneNumberId() == null) return;

        LocalDateTime lastReconciled = agent.getFileReconciledAt();
        if (lastReconciled != null && lastReconciled.isAfter(LocalDateTime.now().minusMinutes(META_RECONCILE_TTL_MINUTES))) {
            return;
        }

        List<AgentFile> localFiles = agentFileRepository.findAllByAgentId(agent.getId());
        try {
            if (!localFiles.isEmpty()) {
                String path = String.format("/%s/agent_config/files", agent.getPhoneNumberId());
                List<?> remoteFiles = metaApiClient.get(path, List.class);
                var remoteIds = new java.util.HashSet<String>();
                if (remoteFiles != null) {
                    for (Object item : remoteFiles) {
                        if (item instanceof Map<?, ?> f && f.get("id") != null) {
                            remoteIds.add(String.valueOf(f.get("id")));
                        }
                    }
                }
                for (AgentFile local : localFiles) {
                    boolean present = local.getMetaFileId() != null && remoteIds.contains(local.getMetaFileId());
                    if (local.isMetaSynced() != present) {
                        local.setMetaSynced(present);
                        agentFileRepository.save(local);
                    }
                }
            }
            agent.setFileReconciledAt(LocalDateTime.now());
            agentRepository.save(agent);
        } catch (Exception e) {
            log.warn("File reconciliation failed for agentId={} — leaving existing meta_synced flags as-is: {}", agent.getId(), e.getMessage());
        }
    }

    /**
     * Same gap as ensureFilesBackfilled, closed here too — reconcileWebsites()
     * below only flips meta_synced on rows that already exist locally. Meta's
     * website response includes url/crawl_status/pages_crawled directly
     * (docs/meta-api/websites.md), so unlike Files this is a full-fidelity
     * backfill, no placeholder fields needed.
     */
    void ensureWebsitesBackfilled(Agent agent, Long accountId) {
        if (!agentWebsiteRepository.findAllByAgentId(agent.getId()).isEmpty()) return;
        if (agent.getPhoneNumberId() == null) return;

        try {
            String path = String.format("/%s/agent_config/websites", agent.getPhoneNumberId());
            List<?> remoteWebsites = metaApiClient.get(path, List.class);
            if (remoteWebsites == null) return;

            for (Object item : remoteWebsites) {
                if (!(item instanceof Map<?, ?> site)) continue;
                Object id = site.get("id");
                Object url = site.get("url");
                if (url == null) continue;

                Object crawlStatus = site.get("crawl_status");
                Object pagesCrawled = site.get("pages_crawled");

                agentWebsiteRepository.save(AgentWebsite.builder()
                        .accountId(accountId)
                        .agentId(agent.getId())
                        .metaWebsiteId(id != null ? id.toString() : null)
                        .url(url.toString())
                        .crawlStatus(crawlStatus != null ? crawlStatus.toString() : null)
                        .pagesCrawled(pagesCrawled instanceof Number n ? n.intValue() : null)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Website backfill failed: agentId={} error={}", agent.getId(), e.getMessage());
        }
    }

    /** TASK-062 — same shape as reconcileFiles/reconcileFaqs. See reconcileFiles's javadoc. */
    void reconcileWebsites(Agent agent) {
        if (agent.getPhoneNumberId() == null) return;

        LocalDateTime lastReconciled = agent.getWebsiteReconciledAt();
        if (lastReconciled != null && lastReconciled.isAfter(LocalDateTime.now().minusMinutes(META_RECONCILE_TTL_MINUTES))) {
            return;
        }

        List<AgentWebsite> localWebsites = agentWebsiteRepository.findAllByAgentId(agent.getId());
        try {
            if (!localWebsites.isEmpty()) {
                String path = String.format("/%s/agent_config/websites", agent.getPhoneNumberId());
                List<?> remoteWebsites = metaApiClient.get(path, List.class);
                var remoteIds = new java.util.HashSet<String>();
                if (remoteWebsites != null) {
                    for (Object item : remoteWebsites) {
                        if (item instanceof Map<?, ?> w && w.get("id") != null) {
                            remoteIds.add(String.valueOf(w.get("id")));
                        }
                    }
                }
                for (AgentWebsite local : localWebsites) {
                    boolean present = local.getMetaWebsiteId() != null && remoteIds.contains(local.getMetaWebsiteId());
                    if (local.isMetaSynced() != present) {
                        local.setMetaSynced(present);
                        agentWebsiteRepository.save(local);
                    }
                }
            }
            agent.setWebsiteReconciledAt(LocalDateTime.now());
            agentRepository.save(agent);
        } catch (Exception e) {
            log.warn("Website reconciliation failed for agentId={} — leaving existing meta_synced flags as-is: {}", agent.getId(), e.getMessage());
        }
    }
}
