package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.BackgroundCallContext;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.entity.WabaAccountAccess;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * WABA registry — validate against Meta, persist, list.
 * Reads the agent domain (already-connected flags) but never writes it.
 * Phone-to-agent binding lives in AgentService (spec: agent domain owns Agent writes).
 *
 * Graph API calls (phone_numbers, WABA info) use graphGet() — graph.facebook.com/v19.0.
 * Agent API calls would use get() — api.facebook.com — but this service has none currently.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WabaService {

    private final WabaRepository wabaRepository;
    private final WabaAccountAccessRepository wabaAccountAccessRepository;
    private final WabaAccessGuard wabaAccessGuard;
    private final WabaAgentReconciliationService reconciliationService;
    private final PhoneNumberAccessGuard phoneNumberAccessGuard;
    private final AgentRepository agentRepository;
    private final AgentService agentService;
    private final PhoneNumberSnapshotRepository phoneNumberSnapshotRepository;
    private final MetaApiClient metaApiClient;
    @Qualifier("metaSyncExecutor")
    private final ThreadPoolTaskExecutor metaSyncExecutor;

    /**
     * Validates a WABA ID against Meta and returns its phone numbers with agent mappings.
     * Error mapping per spec 5.4 — each Meta failure mode gets a distinct message.
     */
    public WabaDtos.ValidateResponse validate(String wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();

        Map<?, ?> waba;
        try {
            waba = metaApiClient.graphGet("/" + wabaId + "?fields=id,name", Map.class);
        } catch (MetaApiException e) {
            if (e.isNotFound()) {
                throw new BusinessException("This WABA ID doesn't exist on Meta. Check the ID and try again.");
            }
            if (e.isAccessDenied()) {
                throw new BusinessException("This WABA isn't managed by Karix. Contact your Karix account manager.");
            }
            throw new BusinessException("Meta isn't responding. Wait a moment and try again.");
        } catch (Exception e) {
            log.warn("WABA validation failed: wabaId={} error={}", wabaId, e.getMessage());
            throw new BusinessException("Meta isn't responding. Wait a moment and try again.");
        }

        String wabaName = waba != null && waba.get("name") != null ? waba.get("name").toString() : "";
        List<WabaDtos.PhoneNumber> phones = fetchPhonesFromMeta(wabaId, accountId);

        return new WabaDtos.ValidateResponse(wabaId, wabaName, phones);
    }

    /**
     * Returns phone numbers for a registered WABA with agent mapping, and
     * triggers reconciliation (grant access + import any live-on-Meta agent
     * this platform hasn't seen yet) — this is the "viewing a WABA's phone
     * list" trigger point for the 2026-07-28 decoupling decision.
     * Used by the WABA detail view — read side effects only (reconciliation).
     */
    public List<WabaDtos.PhoneNumber> getPhones(String wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        // Canonical row for this external WABA ID — any account that's ever
        // registered it, not just the caller (2026-07-28 decoupling: WABA
        // access is granted via waba_account_access, not exclusive creation).
        Waba waba = wabaRepository.findFirstByWabaIdOrderByIdAsc(wabaId)
                .orElseThrow(() -> new BusinessException("WABA not found"));
        wabaAccessGuard.requireAccess(waba.getId(), accountId);

        List<WabaDtos.PhoneNumber> phones = fetchPhonesFromMeta(wabaId, accountId);
        try {
            reconciliationService.reconcile(waba.getId(), accountId,
                    phones.stream().map(WabaDtos.PhoneNumber::phoneNumberId).toList());
        } catch (Exception e) {
            // Reconciliation is best-effort — the phone list must still render.
            log.warn("Agent reconciliation failed for wabaId={}: {}", wabaId, e.getMessage());
        }
        return phones;
    }

    @Transactional
    public Waba create(String wabaId, String label) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Waba waba;

        // Canonical row: reuse whichever account registered this external ID
        // first, rather than creating a second Waba row per account for the
        // same WABA (2026-07-28 decoupling — WABA sharing needs one row that
        // all granted accounts point at).
        var existing = wabaRepository.findFirstByWabaIdOrderByIdAsc(wabaId);
        if (existing.isPresent()) {
            // Not updating the label here on purpose: the row is now shared
            // across every granted account, so a later account re-registering
            // the same WABA must not silently rename it for everyone else.
            // Known Phase-1 simplification: per-account nicknames for a
            // shared WABA aren't supported yet — flagged for a later pass.
            waba = existing.get();
            grantAccessIfMissing(waba.getId(), accountId);
        } else {
            try {
                waba = wabaRepository.save(Waba.builder()
                        .accountId(accountId)
                        .wabaId(wabaId)
                        .label(label)
                        .build());
                grantAccessIfMissing(waba.getId(), accountId);
            } catch (DataIntegrityViolationException e) {
                // Concurrent create of the same WABA — unique (account_id, waba_id) wins the race.
                waba = wabaRepository.findFirstByWabaIdOrderByIdAsc(wabaId)
                        .orElseThrow(() -> new BusinessException("WABA registration failed. Try again."));
                grantAccessIfMissing(waba.getId(), accountId);
            }
        }

        // Phone-sync trigger (TASK-056) lives at the CONTROLLER layer, not
        // here — PhoneNumberSyncService itself depends on WabaService (to
        // call listAllPhonesForAccountId), so calling it from here would be
        // a circular bean dependency. See WabaController.create().
        return waba;
    }

    private void grantAccessIfMissing(Long wabaId, Long accountId) {
        if (wabaAccountAccessRepository.existsByWabaIdAndAccountId(wabaId, accountId)) {
            return;
        }
        try {
            wabaAccountAccessRepository.save(WabaAccountAccess.builder()
                    .wabaId(wabaId)
                    .accountId(accountId)
                    .grantedBy(accountId)
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Concurrent grant — fine, unique index did its job.
        }
    }

    public List<Waba> list() {
        return listForAccount(SecurityContextHelper.getRequiredAccountId());
    }

    /** Explicit-accountId variant — for callers with no request-scoped
     * SecurityContext, e.g. an @Async login-sync job running on a background
     * thread (TASK-055). */
    public List<Waba> listForAccount(Long accountId) {
        List<Long> wabaIds = wabaAccountAccessRepository.findAllByAccountId(accountId).stream()
                .map(WabaAccountAccess::getWabaId)
                .toList();
        return wabaRepository.findAllById(wabaIds);
    }

    /**
     * Every phone number across every WABA this account can see, tagged with
     * agent-deployed status — backs the Dashboard summary. One Meta call per
     * WABA (operators manage under 10 WABAs each — sequential is fine; see
     * EM gate 2026-07-29). A single WABA's Meta call failing must not blank
     * the whole dashboard: caught and skipped, named in unavailableWabaLabels,
     * so the numbers Meta *did* return for every other WABA still render.
     */
    public WabaDtos.AccountPhonesResponse listAllPhonesForAccount() {
        return listAllPhonesForAccountId(SecurityContextHelper.getRequiredAccountId());
    }

    /** One WABA's fetched phone list, paired with the WABA it came from — carried
     * through wave 1 so wave 2 doesn't need to re-look-up which WABA a phone belongs to. */
    private record WabaPhones(Waba waba, List<WabaDtos.PhoneNumber> phones) {}

    /**
     * Explicit-accountId variant — for the @Async login-sync job (TASK-055),
     * which runs on a background thread with no request-scoped SecurityContext.
     *
     * Two flat parallel waves on the bounded metaSyncExecutor, not nested
     * futures — a Dashboard load with N WABAs and M phones used to make
     * N+M sequential Meta round-trips (confirmed live: ~500-2000ms each,
     * several seconds total on a cold cache). Deliberately NOT wave-1-task
     * spawning-and-joining-wave-2-tasks on the same pool: that's a real
     * thread-pool-starvation risk (outer tasks blocked in .join() can
     * exhaust the pool before inner tasks ever get a thread). Two separate
     * waves, each flat and joined from the calling thread (not from inside
     * a pooled worker), avoids that entirely: wave 1 fetches every WABA's
     * phone list concurrently; wave 2 reconciles + builds a row for every
     * phone across every WABA, also concurrently, once wave 1 is fully done.
     *
     * BackgroundCallContext is set/cleared per spawned task — a thread pool
     * worker doesn't inherit the calling request's SecurityContext, so
     * without this every Meta call made from here would log
     * api_call_log.account_id as NULL (see BackgroundCallContext's own
     * javadoc — same fix already applied to the scheduler and
     * PhoneNumberSyncService).
     */
    public WabaDtos.AccountPhonesResponse listAllPhonesForAccountId(Long accountId) {
        List<Waba> wabas = listForAccount(accountId);
        List<String> unavailable = new CopyOnWriteArrayList<>();

        // Wave 1: fetch every WABA's phone list concurrently.
        List<CompletableFuture<WabaPhones>> fetchFutures = wabas.stream()
                .map(waba -> CompletableFuture.supplyAsync(() -> {
                    BackgroundCallContext.set(accountId);
                    try {
                        return new WabaPhones(waba, fetchPhonesFromMeta(waba.getWabaId(), accountId));
                    } catch (Exception e) {
                        log.warn("Dashboard phone inventory: WABA {} unavailable — {}", waba.getWabaId(), e.getMessage());
                        unavailable.add(waba.getLabel());
                        return new WabaPhones(waba, List.of());
                    } finally {
                        BackgroundCallContext.clear();
                    }
                }, metaSyncExecutor))
                .toList();
        List<WabaPhones> perWaba = fetchFutures.stream().map(CompletableFuture::join).toList();

        // Wave 2: reconcile + build a row for every phone across every WABA, concurrently.
        record PhoneTask(Waba waba, WabaDtos.PhoneNumber phone) {}
        List<PhoneTask> allTasks = perWaba.stream()
                .flatMap(wp -> wp.phones().stream().map(p -> new PhoneTask(wp.waba(), p)))
                .toList();

        List<CompletableFuture<WabaDtos.AccountPhoneNumber>> rowFutures = allTasks.stream()
                .map(task -> CompletableFuture.supplyAsync(() -> {
                    BackgroundCallContext.set(accountId);
                    try {
                        return buildPhoneRow(task.phone(), task.waba(), accountId);
                    } finally {
                        BackgroundCallContext.clear();
                    }
                }, metaSyncExecutor))
                .toList();
        List<WabaDtos.AccountPhoneNumber> allPhones = rowFutures.stream().map(CompletableFuture::join).toList();

        return new WabaDtos.AccountPhonesResponse(allPhones, unavailable, LocalDateTime.now().toString());
    }

    /** Gate agentId/agentStatus behind the exact same check fetchPhonesFromMeta
     * already uses for the agent's name — hasAccess() is keyed off the bound
     * agent's OWN wabaId (a specific DB row), not the Waba row being iterated.
     * Two Waba rows can share the same real Meta WABA ID without granting each
     * other's access (confirmed live 2026-07-29: an agent whose row only grants
     * a different account showed id+status leaking here despite
     * connectedAgentName correctly coming back null). */
    private WabaDtos.AccountPhoneNumber buildPhoneRow(WabaDtos.PhoneNumber phone, Waba waba, Long accountId) {
        boolean visible = phoneNumberAccessGuard.hasAccess(accountId, phone.phoneNumberId());
        var boundAgent = visible
                ? agentRepository.findByPhoneNumberId(phone.phoneNumberId())
                : Optional.<Agent>empty();
        boundAgent.ifPresent(agentService::reconcileStatus);
        return new WabaDtos.AccountPhoneNumber(
                phone.phoneNumberId(),
                phone.displayPhoneNumber(),
                phone.verifiedName(),
                waba.getWabaId(),
                waba.getLabel(),
                phone.alreadyConnected(),
                boundAgent.map(a -> String.valueOf(a.getId())).orElse(null),
                phone.connectedAgentName(),
                boundAgent.map(a -> a.getStatus().name()).orElse(null),
                phone.qualityRating(),
                phone.nameStatus(),
                phone.messagingLimitTier()
        );
    }

    /**
     * TASK-055: cache-first read for the Dashboard. Reads the login-sync
     * snapshot if one exists for this account; only falls back to the live,
     * N-Meta-calls path (above) if the cache is empty — e.g. a brand-new
     * account whose first login-sync hasn't completed yet. The reactive
     * live-call path is NOT removed — same "kept as fallback" pattern as
     * TASK-054's Skills backfill.
     */
    public WabaDtos.AccountPhonesResponse getCachedOrLivePhonesForAccount() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        List<PhoneNumberSnapshot> cached = phoneNumberSnapshotRepository.findAllByAccountId(accountId);
        if (cached.isEmpty()) {
            return listAllPhonesForAccountId(accountId);
        }

        List<WabaDtos.AccountPhoneNumber> phones = cached.stream()
                .map(s -> new WabaDtos.AccountPhoneNumber(
                        s.getPhoneNumberId(),
                        s.getDisplayPhoneNumber(),
                        s.getVerifiedName(),
                        s.getWabaId(),
                        s.getWabaLabel(),
                        s.isHasAgent(),
                        s.getAgentId() != null ? String.valueOf(s.getAgentId()) : null,
                        s.getAgentName(),
                        s.getAgentStatus(),
                        s.getQualityRating(),
                        s.getNameStatus(),
                        s.getMessagingLimitTier()
                ))
                .toList();
        // All rows for one account are written in a single sync run (PhoneNumberSyncService
        // replace-in-place) — same syncedAt for every row, so the first is representative.
        String syncedAt = cached.get(0).getSyncedAt().toString();
        return new WabaDtos.AccountPhonesResponse(phones, List.of(), syncedAt);
    }

    /**
     * Read-only summary of what's already configured on Meta for a phone number —
     * used to warn before connecting or deploying onto a number that isn't clean.
     * Keyed only by phoneNumberId (no agent record required to exist yet), so this
     * stays in the WABA domain rather than depending on AgentService/AgentDeployService.
     * No per-phone tenant table exists pre-connect — requiring an authenticated caller
     * is the only ownership check possible at this stage; the Meta token itself is
     * scoped to WABAs Karix manages.
     * A 404 on any single GET means nothing is configured on that facet yet — safe,
     * treated as empty for that facet only. Any other failure fails that facet's
     * check closed; the caller must not treat a partial answer as "nothing configured".
     */
    @SuppressWarnings("unchecked") // Meta returns dynamic JSON arrays for these three list endpoints
    public WabaDtos.DeployPreflightResponse deployPreflight(String phoneNumberId) {
        SecurityContextHelper.getRequiredAccountId();

        boolean agentIdPresent;
        try {
            // EL-caught (2026-08-03, same channel-blindness bug class as the
            // Wave 1a settings-array fix): matching on ANY channel entry's
            // agent_id means a messenger-only agent on this number would
            // make this true for WhatsApp too. Only the whatsapp entry counts.
            List<?> settings = metaApiClient.get("/" + phoneNumberId + "/agent_config/settings", List.class);
            Map<String, Object> whatsappEntry = MetaApiClient.findChannelEntry(settings, "whatsapp");
            agentIdPresent = whatsappEntry != null && whatsappEntry.get("agent_id") != null;
        } catch (MetaApiException e) {
            // 404 means no settings configured on this number yet — safe, not a conflict.
            if (e.isNotFound()) {
                agentIdPresent = false;
            } else {
                log.warn("Deploy preflight settings check failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
                throw new BusinessException("Couldn't verify existing agent configuration on this number — try again.");
            }
        } catch (Exception e) {
            log.warn("Deploy preflight settings check failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
            throw new BusinessException("Couldn't verify existing agent configuration on this number — try again.");
        }

        int skillCount;
        try {
            List<?> skills = metaApiClient.get("/" + phoneNumberId + "/agent_config/skills", List.class);
            skillCount = skills != null ? skills.size() : 0;
        } catch (MetaApiException e) {
            // 404 means no skills configured on this number yet — safe, not a conflict.
            if (e.isNotFound()) {
                skillCount = 0;
            } else {
                log.warn("Deploy preflight skills check failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
                throw new BusinessException("Couldn't verify existing agent configuration on this number — try again.");
            }
        } catch (Exception e) {
            log.warn("Deploy preflight skills check failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
            throw new BusinessException("Couldn't verify existing agent configuration on this number — try again.");
        }

        List<String> connectorNames = new ArrayList<>();
        try {
            List<?> connectors = metaApiClient.get("/" + phoneNumberId + "/agent_connectors", List.class);
            if (connectors != null) {
                for (Object entry : connectors) {
                    if (entry instanceof Map<?, ?> m && m.get("name") != null) {
                        connectorNames.add(m.get("name").toString());
                    }
                }
            }
        } catch (MetaApiException e) {
            // 404 means no connectors configured on this number yet — safe, not a conflict.
            if (!e.isNotFound()) {
                log.warn("Deploy preflight connectors check failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
                throw new BusinessException("Couldn't verify existing agent configuration on this number — try again.");
            }
        } catch (Exception e) {
            log.warn("Deploy preflight connectors check failed: phoneNumberId={} error={}", phoneNumberId, e.getMessage());
            throw new BusinessException("Couldn't verify existing agent configuration on this number — try again.");
        }

        return new WabaDtos.DeployPreflightResponse(agentIdPresent, skillCount, connectorNames);
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * Fetches phone numbers for a WABA from Meta Graph API and enriches each
     * with the agent currently mapped to it. Agent name is shown to any
     * account with waba_account_access on that agent's WABA — not just its
     * original creator (2026-07-28 decoupling decision: shared WABA means
     * shared visibility of what's on it, by design).
     * Extracted so both validate() and getPhones() share the same logic without duplication.
     */
    private List<WabaDtos.PhoneNumber> fetchPhonesFromMeta(String wabaId, Long accountId) {
        Map<?, ?> phonesResponse;
        try {
            // TASK-061 (P0): explicit fields= — without it Meta only returns
            // its default set (id, display_phone_number, verified_name), so
            // quality_rating/name_status/messaging_limit_tier were silently
            // never requested at all. quality_rating in particular is the
            // leading indicator before WhatsApp restricts/bans a number —
            // this app had zero visibility into it until now.
            phonesResponse = metaApiClient.graphGet(
                    "/" + wabaId + "/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,name_status,messaging_limit_tier",
                    Map.class);
        } catch (Exception e) {
            log.warn("WABA phone list failed: wabaId={} error={}", wabaId, e.getMessage());
            throw new BusinessException("Could not fetch phone numbers from Meta. Try again.");
        }

        List<WabaDtos.PhoneNumber> phones = new ArrayList<>();
        Object data = phonesResponse != null ? phonesResponse.get("data") : null;
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> phone) {
                    String phoneNumberId = str(phone.get("id"));
                    var boundAgent = agentRepository.findByPhoneNumberId(phoneNumberId);
                    String boundName = boundAgent
                            .filter(a -> phoneNumberAccessGuard.hasAccess(accountId, phoneNumberId))
                            .map(Agent::getDisplayName)
                            .orElse(null);
                    // Shape unconfirmed — neither this project's docs/meta-api/ nor a
                    // response we've seen live document quality_rating's exact JSON
                    // shape. Defensively tries a flat "quality_rating" string first,
                    // then a nested {"quality_score": {"score": ...}} shape (both seen
                    // in different WhatsApp Cloud API contexts elsewhere), falls back
                    // to "" — never throws either way (EL review, 2026-07-30).
                    phones.add(new WabaDtos.PhoneNumber(
                            phoneNumberId,
                            str(phone.get("display_phone_number")),
                            str(phone.get("verified_name")),
                            boundAgent.isPresent(),
                            boundName,
                            extractQualityRating(phone),
                            str(phone.get("name_status")),
                            str(phone.get("messaging_limit_tier"))
                    ));
                }
            }
        }
        return phones;
    }

    private static String extractQualityRating(Map<?, ?> phone) {
        Object flat = phone.get("quality_rating");
        if (flat != null) return flat.toString();
        Object nested = phone.get("quality_score");
        if (nested instanceof Map<?, ?> score && score.get("score") != null) {
            return score.get("score").toString();
        }
        return "";
    }

    private static String str(Object o) {
        return o != null ? o.toString() : "";
    }
}
