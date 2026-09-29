package com.metaagent.platform.domain.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.entity.*;
import com.metaagent.platform.domain.agent.repository.*;
import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * R9 slice 1 — "the moment a phone number is added ... fetch Agents deployed
 * on that from Meta ... sync all these to our DB. Every detail from Meta has
 * to be fetched" (founder, 2026-09-29, docs/user-stories/R9-full-sync-and-meta-parity.md).
 *
 * One category is independent of every other (AC#10 — a partial failure must
 * name exactly which categories succeeded), so each private syncX() call is
 * wrapped separately and never lets one category's failure stop the rest.
 * Meta always wins on disagreement (AC#7): every category here fully
 * overwrites the Meta-owned fields on every matching local row, the same
 * shape ConnectorMirrorService already uses for connectors — this service
 * extends that shape to skills/FAQs/files/websites/business persona rather
 * than inventing a second one.
 *
 * Not yet covered (net new, no existing Meta-read or local entity to sync
 * into — separate slice per docs/jobs/r9-full-sync.md): settings, past
 * business-event history, evals, Meta's insight numbers.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountSyncService {

    private final AgentSkillRepository agentSkillRepository;
    private final AgentFaqRepository agentFaqRepository;
    private final AgentFileRepository agentFileRepository;
    private final AgentWebsiteRepository agentWebsiteRepository;
    private final AgentConnectorRepository agentConnectorRepository;
    private final BusinessProfileRepository businessProfileRepository;
    private final AgentSyncLogRepository agentSyncLogRepository;
    private final ConnectorMirrorService connectorMirrorService;
    private final AgentRepository agentRepository;
    private final AgentEvalCaseRepository agentEvalCaseRepository;
    private final AgentInsightsSnapshotRepository agentInsightsSnapshotRepository;
    private final MetaApiClient metaApiClient;
    private final ObjectMapper objectMapper;

    /**
     * Runs every category for one agent. Best-effort per category — never
     * throws, since a login-time or bulk-import caller must not have its
     * whole request fail because one Meta endpoint is down for one agent.
     */
    public void syncAgent(Agent agent, Long accountId, AgentSyncLog.Trigger trigger) {
        if (agent.getPhoneNumberId() == null) {
            return; // draft, not yet bound to a number — nothing on Meta to fetch
        }
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.SKILLS, this::syncSkills);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.FAQS, this::syncFaqs);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.FILES, this::syncFiles);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.WEBSITES, this::syncWebsites);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.CONNECTORS, this::syncConnectors);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.BUSINESS_PERSONA, this::syncBusinessPersona);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.SETTINGS, this::syncSettings);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.EVAL_CASES, this::syncEvalCases);
        syncCategory(agent, accountId, trigger, AgentSyncLog.Category.INSIGHTS, this::syncInsights);
    }

    private interface CategorySync {
        boolean run(Agent agent, Long accountId) throws Exception; // returns whether anything changed
    }

    private void syncCategory(Agent agent, Long accountId, AgentSyncLog.Trigger trigger,
                               AgentSyncLog.Category category, CategorySync sync) {
        AgentSyncLog.AgentSyncLogBuilder log = AgentSyncLog.builder()
                .accountId(accountId).agentId(agent.getId()).triggerSource(trigger).category(category)
                .syncedAt(LocalDateTime.now());
        try {
            boolean changed = sync.run(agent, accountId);
            agentSyncLogRepository.save(log.status(AgentSyncLog.Status.SUCCESS).changed(changed).build());
        } catch (Exception e) {
            AccountSyncService.log.warn("R9 sync failed: agentId={} category={} error={}", agent.getId(), category, e.getMessage());
            agentSyncLogRepository.save(log.status(AgentSyncLog.Status.FAILED).errorMessage(truncate(e.getMessage())).build());
        }
    }

    // -------------------------------------------------------------------
    // Skills
    // -------------------------------------------------------------------

    @Transactional
    boolean syncSkills(Agent agent, Long accountId) throws Exception {
        List<?> remote = metaApiClient.get(
                MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/skills", agent.getMetaAgentId()),
                List.class);
        if (remote == null) return false;

        boolean changed = false;
        Set<String> remoteIds = new HashSet<>();
        for (Object item : remote) {
            if (!(item instanceof Map<?, ?> m)) continue;
            String metaId = str(m.get("id"));
            Object title = m.get("title");
            Object body = m.get("skill"); // Meta's field is "skill", not "body"
            if (metaId == null || title == null || body == null) continue;
            remoteIds.add(metaId);

            AgentSkill row = agentSkillRepository.findByAgentIdAndMetaSkillId(agent.getId(), metaId)
                    .orElseGet(() -> AgentSkill.builder().accountId(accountId).agentId(agent.getId()).metaSkillId(metaId).build());
            String before = snapshot(row.getTitle(), row.getDescription(), row.getBody());
            row.setTitle(title.toString());
            row.setDescription(m.get("description") != null ? m.get("description").toString() : "");
            row.setBody(body.toString());
            if (row.getStatus() == null) row.setStatus(AgentSkill.Status.published);
            if (!before.equals(snapshot(row.getTitle(), row.getDescription(), row.getBody()))) changed = true;
            agentSkillRepository.save(row);
        }
        // A skill deleted directly on Meta must disappear from our screen too (AC test case 6) —
        // only rows that were themselves pulled from Meta (metaSkillId set) are eligible.
        for (AgentSkill local : agentSkillRepository.findAllByAgentId(agent.getId())) {
            if (local.getMetaSkillId() != null && !remoteIds.contains(local.getMetaSkillId())) {
                agentSkillRepository.delete(local);
                changed = true;
            }
        }
        return changed;
    }

    // -------------------------------------------------------------------
    // FAQs
    // -------------------------------------------------------------------

    @Transactional
    boolean syncFaqs(Agent agent, Long accountId) throws Exception {
        List<?> remote = metaApiClient.get("/" + agent.getPhoneNumberId() + "/agent_config/faq", List.class);
        if (remote == null) return false;

        boolean changed = false;
        Set<String> remoteIds = new HashSet<>();
        for (Object item : remote) {
            if (!(item instanceof Map<?, ?> m)) continue;
            String metaId = str(m.get("id"));
            Object question = m.get("question");
            Object answer = m.get("answer");
            if (metaId == null || question == null || answer == null) continue;
            remoteIds.add(metaId);

            AgentFaq row = agentFaqRepository.findByAgentIdAndMetaFaqId(agent.getId(), metaId)
                    .orElseGet(() -> AgentFaq.builder().accountId(accountId).agentId(agent.getId()).metaFaqId(metaId).build());
            String before = snapshot(row.getQuestion(), row.getAnswer());
            row.setQuestion(question.toString());
            row.setAnswer(answer.toString());
            row.setMetaSynced(true);
            row.setMetaSyncAttempted(true);
            if (row.getStatus() == null) row.setStatus(AgentFaq.Status.published);
            if (!before.equals(snapshot(row.getQuestion(), row.getAnswer()))) changed = true;
            agentFaqRepository.save(row);
        }
        for (AgentFaq local : agentFaqRepository.findAllByAgentId(agent.getId())) {
            if (local.getMetaFaqId() != null && !remoteIds.contains(local.getMetaFaqId())) {
                agentFaqRepository.delete(local);
                changed = true;
            }
        }
        return changed;
    }

    // -------------------------------------------------------------------
    // Files — Meta returns id + file_name only (files.md); mime/size are
    // never authoritative from Meta, so they are seeded on insert and never
    // touched again by this sync (there's nothing Meta could overwrite them
    // with, so "Meta wins" doesn't apply to those two columns).
    // -------------------------------------------------------------------

    @Transactional
    boolean syncFiles(Agent agent, Long accountId) throws Exception {
        List<?> remote = metaApiClient.get("/" + agent.getPhoneNumberId() + "/agent_config/files", List.class);
        if (remote == null) return false;

        boolean changed = false;
        Set<String> remoteIds = new HashSet<>();
        for (Object item : remote) {
            if (!(item instanceof Map<?, ?> m)) continue;
            String metaId = str(m.get("id"));
            Object fileName = m.get("file_name");
            if (metaId == null || fileName == null) continue;
            remoteIds.add(metaId);

            var existing = agentFileRepository.findByAgentIdAndMetaFileId(agent.getId(), metaId);
            if (existing.isEmpty()) {
                agentFileRepository.save(AgentFile.builder()
                        .accountId(accountId).agentId(agent.getId()).metaFileId(metaId)
                        .filename(fileName.toString()).mimeType(guessMimeType(fileName.toString())).sizeBytes(0L)
                        .build());
                changed = true;
            } else if (!existing.get().getFilename().equals(fileName.toString())) {
                existing.get().setFilename(fileName.toString());
                agentFileRepository.save(existing.get());
                changed = true;
            }
        }
        for (AgentFile local : agentFileRepository.findAllByAgentId(agent.getId())) {
            if (local.getMetaFileId() != null && !remoteIds.contains(local.getMetaFileId())) {
                agentFileRepository.delete(local);
                changed = true;
            }
        }
        return changed;
    }

    // -------------------------------------------------------------------
    // Websites
    // -------------------------------------------------------------------

    @Transactional
    boolean syncWebsites(Agent agent, Long accountId) throws Exception {
        List<?> remote = metaApiClient.get("/" + agent.getPhoneNumberId() + "/agent_config/websites", List.class);
        if (remote == null) return false;

        boolean changed = false;
        Set<String> remoteIds = new HashSet<>();
        for (Object item : remote) {
            if (!(item instanceof Map<?, ?> m)) continue;
            String metaId = str(m.get("id"));
            Object url = m.get("url");
            if (metaId == null || url == null) continue;
            remoteIds.add(metaId);

            AgentWebsite row = agentWebsiteRepository.findByAgentIdAndMetaWebsiteId(agent.getId(), metaId)
                    .orElseGet(() -> AgentWebsite.builder().accountId(accountId).agentId(agent.getId()).metaWebsiteId(metaId).build());
            String crawlStatus = m.get("crawl_status") != null ? m.get("crawl_status").toString() : null;
            Integer pagesCrawled = m.get("pages_crawled") instanceof Number n ? n.intValue() : null;
            String before = snapshot(row.getUrl(), row.getCrawlStatus(), String.valueOf(row.getPagesCrawled()));
            row.setUrl(url.toString());
            row.setCrawlStatus(crawlStatus);
            row.setPagesCrawled(pagesCrawled);
            row.setMetaSynced(true);
            if (!before.equals(snapshot(row.getUrl(), row.getCrawlStatus(), String.valueOf(row.getPagesCrawled())))) changed = true;
            agentWebsiteRepository.save(row);
        }
        for (AgentWebsite local : agentWebsiteRepository.findAllByAgentId(agent.getId())) {
            if (local.getMetaWebsiteId() != null && !remoteIds.contains(local.getMetaWebsiteId())) {
                agentWebsiteRepository.delete(local);
                changed = true;
            }
        }
        return changed;
    }

    // -------------------------------------------------------------------
    // Connectors — already has a correct Meta-wins mirror; this category
    // just calls it, so R9 doesn't grow a second implementation of the same
    // upsert shape.
    // -------------------------------------------------------------------

    @Transactional
    boolean syncConnectors(Agent agent, Long accountId) throws Exception {
        List<AgentConnector> before = agentConnectorRepository.findAllByAgentId(agent.getId());
        List<?> remote = metaApiClient.get(
                MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_connectors", agent.getMetaAgentId()),
                List.class);
        if (remote == null) return false;
        List<AgentConnector> after = connectorMirrorService.syncFromMeta(agent, remote);
        return before.size() != after.size() || !sameConnectorSignatures(before, after);
    }

    private boolean sameConnectorSignatures(List<AgentConnector> before, List<AgentConnector> after) {
        Map<String, String> beforeSig = new java.util.HashMap<>();
        for (AgentConnector c : before) beforeSig.put(c.getMetaConnectorId(), c.getName() + "|" + c.getBaseUrl());
        for (AgentConnector c : after) {
            if (!beforeSig.getOrDefault(c.getMetaConnectorId(), "").equals(c.getName() + "|" + c.getBaseUrl())) return false;
        }
        return true;
    }

    // -------------------------------------------------------------------
    // Business persona — no upsert-from-Meta path exists today
    // (BusinessProfileDeployService only ever pushes local -> Meta).
    // -------------------------------------------------------------------

    @Transactional
    @SuppressWarnings("unchecked")
    boolean syncBusinessPersona(Agent agent, Long accountId) throws Exception {
        Map<?, ?> remote;
        try {
            remote = metaApiClient.get("/" + agent.getPhoneNumberId() + "/agent_config/business_info", Map.class);
        } catch (MetaApiException e) {
            if (e.isNotFound()) return false; // nothing set on Meta yet — nothing to sync
            throw e;
        }
        if (remote == null) return false;

        BusinessProfile profile = businessProfileRepository
                .findByPhoneNumberIdAndStatus(agent.getPhoneNumberId(), BusinessProfile.Status.DEPLOYED)
                .orElseGet(() -> BusinessProfile.builder()
                        .accountId(accountId).phoneNumberId(agent.getPhoneNumberId())
                        .status(BusinessProfile.Status.DEPLOYED).build());

        String before = snapshot(profile.getPaymentMethod(), profile.getReturnPolicy(), profile.getPurchaseInfo(),
                profile.getDeliveryAndShipping(), profile.getBusinessDescription(), profile.getContactEmail(),
                profile.getContactHoursOfOperation(), profile.getContactAddress());

        profile.setPaymentMethod(strOrNull(remote.get("payment_method")));
        profile.setReturnPolicy(strOrNull(remote.get("return_policy")));
        profile.setPurchaseInfo(strOrNull(remote.get("purchase_info")));
        profile.setDeliveryAndShipping(strOrNull(remote.get("delivery_and_shipping")));
        profile.setBusinessDescription(strOrNull(remote.get("business_description")));
        if (remote.get("contact_info") instanceof Map<?, ?> contact) {
            profile.setContactEmail(strOrNull(contact.get("email")));
            profile.setContactHoursOfOperation(strOrNull(contact.get("hours_of_operation")));
            profile.setContactAddress(strOrNull(contact.get("address")));
        }
        profile.setDeployedAt(profile.getDeployedAt() != null ? profile.getDeployedAt() : LocalDateTime.now());

        String after = snapshot(profile.getPaymentMethod(), profile.getReturnPolicy(), profile.getPurchaseInfo(),
                profile.getDeliveryAndShipping(), profile.getBusinessDescription(), profile.getContactEmail(),
                profile.getContactHoursOfOperation(), profile.getContactAddress());
        businessProfileRepository.save(profile);
        return !before.equals(after);
    }

    // -------------------------------------------------------------------
    // Settings — ai_audience/followup/never_say_phrases/allowlist have never
    // had a local column before (AgentDeployService only ever read them live
    // and passed them straight back through on every write, to avoid
    // clobbering an operator's real Meta-side config — see its own
    // "preserve followup/ai_audience unchanged" comments). rollout.enabled
    // is deliberately left alone here: AgentService.reconcileStatus already
    // does a TTL-gated Meta-wins overwrite of status/enabled, and running a
    // second settings GET for the same field would just double the Meta
    // calls for no benefit.
    // -------------------------------------------------------------------

    @Transactional
    boolean syncSettings(Agent agent, Long accountId) throws Exception {
        List<?> raw = metaApiClient.get(
                MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/agent_config/settings", agent.getMetaAgentId()),
                List.class);
        Map<?, ?> live = MetaApiClient.findChannelEntry(raw, "whatsapp");
        if (live == null) return false;

        String before = snapshot(agent.getAiAudience(), String.valueOf(agent.getFollowupEnabled()),
                agent.getFollowupMessage(), agent.getNeverSayPhrases(), agent.isHandoffEnabled() + "",
                agent.getHandoffMessage());

        agent.setAiAudience(strOrNull(live.get("ai_audience")));
        if (live.get("followup") instanceof Map<?, ?> followup) {
            agent.setFollowupEnabled(Boolean.TRUE.equals(followup.get("enabled")));
            agent.setFollowupMessage(strOrNull(followup.get("message")));
        }
        if (live.get("handoff") instanceof Map<?, ?> handoff) {
            agent.setHandoffEnabled(Boolean.TRUE.equals(handoff.get("enabled")));
            agent.setHandoffMessage(strOrNull(handoff.get("message")));
        }
        if (live.get("never_say_phrases") instanceof List<?> phrases) {
            agent.setNeverSayPhrases(objectMapper.writeValueAsString(phrases));
        }

        List<?> allowlist;
        try {
            allowlist = metaApiClient.get("/" + agent.getPhoneNumberId() + "/agent_config/allowlist", List.class);
        } catch (Exception e) {
            allowlist = null; // best-effort second call — a failure here doesn't undo the settings half above
        }
        if (allowlist != null) {
            agent.setAllowlistSnapshot(objectMapper.writeValueAsString(allowlist));
        }

        String after = snapshot(agent.getAiAudience(), String.valueOf(agent.getFollowupEnabled()),
                agent.getFollowupMessage(), agent.getNeverSayPhrases(), agent.isHandoffEnabled() + "",
                agent.getHandoffMessage());
        agentRepository.save(agent);
        return !before.equals(after);
    }

    // -------------------------------------------------------------------
    // Eval cases — configuration only (agent-eval.md GET /cases). Running an
    // eval (agent-eval.md POST/GET /run) is a deliberate, costly action a
    // person takes on the Test & Deploy screen (EvalRollupWorker) — this
    // never triggers one. Meta has no "list all past runs" endpoint (only
    // single-job-id polling), so past eval *results* aren't something a
    // passive sync can fetch at all; only the case definitions are.
    // -------------------------------------------------------------------

    @Transactional
    @SuppressWarnings("unchecked")
    boolean syncEvalCases(Agent agent, Long accountId) throws Exception {
        Map<String, Object> response = metaApiClient.get(
                "/" + agent.getPhoneNumberId() + "/agent-eval/cases", Map.class);
        List<?> remote = response != null && response.get("eval_cases") instanceof List<?> l ? l : null;
        if (remote == null) return false;

        boolean changed = false;
        Set<String> remoteIds = new HashSet<>();
        for (Object item : remote) {
            if (!(item instanceof Map<?, ?> m)) continue;
            String metaId = str(m.get("id"));
            if (metaId == null) continue;
            remoteIds.add(metaId);

            AgentEvalCase row = agentEvalCaseRepository.findByAgentIdAndMetaCaseId(agent.getId(), metaId)
                    .orElseGet(() -> AgentEvalCase.builder().accountId(accountId).agentId(agent.getId()).metaCaseId(metaId).build());
            String before = snapshot(row.getScenario(), row.getScenarioVersion(), row.getCategories(),
                    String.valueOf(row.getMaxTurns()), row.getSuccessCriteria());
            row.setScenario(strOrNull(m.get("scenario")));
            row.setScenarioVersion(strOrNull(m.get("scenario_version")));
            row.setCategories(toJson(m.get("categories")));
            row.setMaxTurns(m.get("max_turns") instanceof Number n ? n.intValue() : null);
            row.setSuccessCriteria(toJson(m.get("success_criteria")));
            if (!before.equals(snapshot(row.getScenario(), row.getScenarioVersion(), row.getCategories(),
                    String.valueOf(row.getMaxTurns()), row.getSuccessCriteria()))) {
                changed = true;
            }
            agentEvalCaseRepository.save(row);
        }
        for (AgentEvalCase local : agentEvalCaseRepository.findAllByAgentId(agent.getId())) {
            if (!remoteIds.contains(local.getMetaCaseId())) {
                agentEvalCaseRepository.delete(local);
                changed = true;
            }
        }
        return changed;
    }

    // -------------------------------------------------------------------
    // Insights — pure read, three independent Meta endpoints, entity_id
    // scoped the same way every other endpoint in this codebase is
    // (phoneNumberId + ?agent_id=). One row per agent, overwritten each
    // sync — see AgentInsightsSnapshot's own javadoc for why this isn't an
    // append-only log like the other categories.
    // -------------------------------------------------------------------

    @Transactional
    @SuppressWarnings("unchecked")
    boolean syncInsights(Agent agent, Long accountId) throws Exception {
        java.time.LocalDate end = java.time.LocalDate.now();
        java.time.LocalDate start = end.minusDays(6);
        String range = "start_date=" + start + "&end_date=" + end;

        AgentInsightsSnapshot snap = agentInsightsSnapshotRepository.findByAgentId(agent.getId())
                .orElseGet(() -> AgentInsightsSnapshot.builder().accountId(accountId).agentId(agent.getId()).build());
        String before = snapshot(String.valueOf(snap.getAiThreads()), String.valueOf(snap.getAiHandoffs()),
                snap.getToolCallInsights(), snap.getAgentEventInsights());

        Map<String, Object> conv = metaApiClient.get(
                MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/insights/conversations?" + range + "&metrics=ai_threads&metrics=ai_handoffs", agent.getMetaAgentId()),
                Map.class);
        if (conv != null && conv.get("data") instanceof List<?> rows && !rows.isEmpty() && rows.get(0) instanceof Map<?, ?> row) {
            snap.setAiThreads(metricCount(row.get("ai_threads")));
            snap.setAiHandoffs(metricCount(row.get("ai_handoffs")));
        }

        Map<String, Object> tools = metaApiClient.get(
                MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/insights/tool_calls?" + range, agent.getMetaAgentId()),
                Map.class);
        if (tools != null) snap.setToolCallInsights(toJson(tools.get("data")));

        Map<String, Object> events = metaApiClient.get(
                MetaApiClient.scopedPath("/" + agent.getPhoneNumberId() + "/insights/agent_events?" + range, agent.getMetaAgentId()),
                Map.class);
        if (events != null) snap.setAgentEventInsights(toJson(events.get("data")));

        snap.setRangeStart(start);
        snap.setRangeEnd(end);
        snap.setSyncedAt(LocalDateTime.now());

        String after = snapshot(String.valueOf(snap.getAiThreads()), String.valueOf(snap.getAiHandoffs()),
                snap.getToolCallInsights(), snap.getAgentEventInsights());
        agentInsightsSnapshotRepository.save(snap);
        return !before.equals(after);
    }

    private static Integer metricCount(Object metric) {
        return metric instanceof Map<?, ?> m && m.get("count") instanceof Number n ? n.intValue() : null;
    }

    private String toJson(Object o) {
        if (o == null) return null;
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return null;
        }
    }

    // -------------------------------------------------------------------

    private static String str(Object o) {
        return o != null ? o.toString() : null;
    }

    private static String strOrNull(Object o) {
        return o != null ? o.toString() : null;
    }

    private static String snapshot(String... parts) {
        return String.join("\u0001", java.util.Arrays.stream(parts).map(p -> p == null ? "" : p).toList());
    }

    private static String guessMimeType(String filename) {
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

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 1000 ? s.substring(0, 1000) : s;
    }
}
