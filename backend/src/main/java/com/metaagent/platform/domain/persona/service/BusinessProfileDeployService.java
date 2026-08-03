package com.metaagent.platform.domain.persona.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.persona.dto.BusinessProfileDtos.SaveRequest;
import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import com.metaagent.platform.domain.persona.entity.BusinessProfile.Status;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.waba.service.PhoneNumberAccessGuard;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Deploys a BusinessProfile draft to Meta's agent_config/business_info — a
 * single structured object per phone number with no history on Meta's side.
 * We keep the history Meta doesn't: deploying archives whatever was DEPLOYED
 * for that number before pushing the new one live.
 *
 * Rule (same as AgentDeployService): Meta API first, DB second. If the PUT to
 * Meta fails after we've locally archived the prior DEPLOYED row, that row is
 * restored to DEPLOYED — our DB must never claim "nothing live" while Meta
 * still has the old profile live.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BusinessProfileDeployService {

    private final BusinessProfileRepository repository;
    private final MetaApiClient metaApiClient;
    private final PhoneNumberAccessGuard phoneNumberAccessGuard;

    // One lock per phone number — prevents two concurrent deploys to the same
    // number from interleaving the archive/PUT sequence and corrupting history.
    private final ConcurrentHashMap<String, Object> deployLocks = new ConcurrentHashMap<>();

    public BusinessProfile createDraft(SaveRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        BusinessProfile draft = BusinessProfile.builder()
                .accountId(accountId)
                .status(Status.DRAFT)
                .build();
        applyFields(draft, request);
        return repository.save(draft);
    }

    public BusinessProfile updateDraft(Long id, SaveRequest request) {
        BusinessProfile draft = loadOwnedDraft(id);
        applyFields(draft, request);
        return repository.save(draft);
    }

    public void deleteDraft(Long id) {
        BusinessProfile draft = loadOwnedDraft(id);
        repository.delete(draft);
    }

    public List<BusinessProfile> listDrafts() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return repository.findAllByAccountIdAndStatus(accountId, Status.DRAFT);
    }

    public BusinessProfile getLive(String phoneNumberId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        phoneNumberAccessGuard.requireAccess(accountId, phoneNumberId);
        return repository.findByPhoneNumberIdAndStatus(phoneNumberId, Status.DEPLOYED)
                .orElseGet(() -> ensureBackfilled(phoneNumberId, accountId));
    }

    /**
     * Wave 1b (2026-08-03): an agent discovered via reconciliation (imported,
     * not built through this app's wizard) can have real business_info
     * already configured directly on Meta with zero local BusinessProfile
     * row — confirmed live (Wave 0 verification) for a real production
     * number. Same bug class already fixed for Skills/FAQs/Files/Websites
     * via AgentService's ensure*Backfilled methods; this was the one domain
     * that never got it. Reactive (fires on read, not a background job) and
     * best-effort — never fails the primary getLive() read; a Meta hiccup
     * just leaves the operator seeing "no persona yet", same as today.
     *
     * EL-caught race (2026-08-03): this is reachable from an ordinary page
     * load, so two concurrent getLive() calls missing the same not-yet-
     * backfilled number is routine, not exotic — both would otherwise save
     * their own DEPLOYED row, and findByPhoneNumberIdAndStatus (an Optional
     * lookup) would then throw IncorrectResultSizeDataAccessException for
     * every future call on that number, permanently. Takes the same
     * deployLocks lock as deploy()/resetLive() and re-checks for an existing
     * row *inside* the lock before ever saving one.
     */
    private BusinessProfile ensureBackfilled(String phoneNumberId, Long accountId) {
        Object lock = deployLocks.computeIfAbsent(phoneNumberId, k -> new Object());
        synchronized (lock) {
            // Another thread may have backfilled (or deployed) between the
            // outer check and acquiring this lock — re-check before writing.
            BusinessProfile existing = repository
                    .findByPhoneNumberIdAndStatus(phoneNumberId, Status.DEPLOYED)
                    .orElse(null);
            if (existing != null) {
                return existing;
            }

            try {
                Map<?, ?> live = getBusinessInfo(phoneNumberId);
                if (live == null || live.isEmpty()) {
                    return null;
                }
                BusinessProfile discovered = fromMetaResponse(live, phoneNumberId);
                // Unlike deploy()'s drift-recording use of fromMetaResponse
                // (genuinely unmanaged, accountId stays null per this
                // entity's own convention), this row is being actively
                // surfaced to the requesting account right now — attribute it.
                discovered.setAccountId(accountId);
                discovered.setStatus(Status.DEPLOYED);
                discovered.setArchivedAt(null);
                discovered.setDeployedAt(LocalDateTime.now());
                return repository.save(discovered);
            } catch (Exception e) {
                log.warn("Business info backfill failed for phoneNumberId={}: {}", phoneNumberId, e.getMessage());
                return null;
            }
        }
    }

    public List<BusinessProfile> getHistory(String phoneNumberId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        phoneNumberAccessGuard.requireAccess(accountId, phoneNumberId);
        return repository.findAllByPhoneNumberIdAndStatusOrderByArchivedAtDesc(phoneNumberId, Status.ARCHIVED);
    }

    /**
     * Deploy sequence: GET current live object -> archive prior DEPLOYED row
     * (or record drift as an unmanaged archived row) -> PUT the draft's fields
     * -> flip the draft to DEPLOYED. Any failure before the PUT succeeds aborts
     * with no local state change beyond the archive, which is rolled back on
     * PUT failure.
     */
    @Transactional
    public BusinessProfile deploy(Long draftId, String phoneNumberId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        BusinessProfile draft = loadOwnedDraft(draftId);
        phoneNumberAccessGuard.requireAccess(accountId, phoneNumberId);

        Object lock = deployLocks.computeIfAbsent(phoneNumberId, k -> new Object());
        synchronized (lock) {
            // Step 1: read Meta's current live object. A failure here aborts
            // before any local state changes — nothing to roll back.
            Map<?, ?> liveOnMeta = getBusinessInfo(phoneNumberId);

            // Step 2: archive whatever we already track as DEPLOYED for this number.
            BusinessProfile priorDeployed = repository
                    .findByPhoneNumberIdAndStatus(phoneNumberId, Status.DEPLOYED)
                    .orElse(null);

            if (priorDeployed != null) {
                priorDeployed.setStatus(Status.ARCHIVED);
                priorDeployed.setArchivedAt(LocalDateTime.now());
                repository.save(priorDeployed);
            } else if (liveOnMeta != null && !liveOnMeta.isEmpty()) {
                // Drift: Meta has a live object we never deployed ourselves.
                // Record it as an unmanaged archived row so history isn't lost.
                repository.save(fromMetaResponse(liveOnMeta, phoneNumberId));
            }

            // Step 3: push the draft to Meta.
            try {
                putBusinessInfo(phoneNumberId, draft);
            } catch (Exception e) {
                // Roll back: restore prior DEPLOYED status so our DB never
                // diverges from what's actually still live on Meta.
                if (priorDeployed != null) {
                    priorDeployed.setStatus(Status.DEPLOYED);
                    priorDeployed.setArchivedAt(null);
                    repository.save(priorDeployed);
                }
                throw new BusinessException("Meta business info update failed — nothing was changed: " + e.getMessage());
            }

            // Step 4: confirmed live on Meta — reflect it locally.
            draft.setStatus(Status.DEPLOYED);
            draft.setPhoneNumberId(phoneNumberId);
            draft.setDeployedAt(LocalDateTime.now());
            draft.setArchivedAt(null);
            return repository.save(draft);
        }
    }

    /**
     * Resets Meta's live business_info to defaults and archives whatever was
     * DEPLOYED locally — same lock as deploy() since a reset racing a deploy
     * on the same number is a real interleaving risk, unlike the other new
     * read/update endpoints added in this pass (2026-07-28 PM+EM gate).
     */
    @Transactional
    public void resetLive(String phoneNumberId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        phoneNumberAccessGuard.requireAccess(accountId, phoneNumberId);

        Object lock = deployLocks.computeIfAbsent(phoneNumberId, k -> new Object());
        synchronized (lock) {
            try {
                metaApiClient.delete("/" + phoneNumberId + "/agent_config/business_info");
            } catch (Exception e) {
                throw new BusinessException("Meta business info reset failed — nothing was changed: " + e.getMessage());
            }

            repository.findByPhoneNumberIdAndStatus(phoneNumberId, Status.DEPLOYED).ifPresent(live -> {
                live.setStatus(Status.ARCHIVED);
                live.setArchivedAt(LocalDateTime.now());
                repository.save(live);
            });
        }
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private void applyFields(BusinessProfile profile, SaveRequest request) {
        profile.setPaymentMethod(request.paymentMethod());
        profile.setReturnPolicy(request.returnPolicy());
        profile.setPurchaseInfo(request.purchaseInfo());
        profile.setDeliveryAndShipping(request.deliveryAndShipping());
        profile.setBusinessDescription(request.businessDescription());
        profile.setContactEmail(request.contactEmail());
        profile.setContactHoursOfOperation(request.contactHoursOfOperation());
        profile.setContactAddress(request.contactAddress());
    }

    @SuppressWarnings("unchecked")
    private Map<?, ?> getBusinessInfo(String phoneNumberId) {
        try {
            return metaApiClient.get("/" + phoneNumberId + "/agent_config/business_info", Map.class);
        } catch (MetaApiException e) {
            if (e.isNotFound()) {
                return null;
            }
            throw new BusinessException("Couldn't read current business info from Meta — try again: " + e.getMessage());
        } catch (Exception e) {
            throw new BusinessException("Couldn't read current business info from Meta — try again: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void putBusinessInfo(String phoneNumberId, BusinessProfile draft) {
        Map<String, Object> contactInfo = new java.util.LinkedHashMap<>();
        if (draft.getContactEmail() != null) contactInfo.put("email", draft.getContactEmail());
        if (draft.getContactHoursOfOperation() != null) contactInfo.put("hours_of_operation", draft.getContactHoursOfOperation());
        if (draft.getContactAddress() != null) contactInfo.put("address", draft.getContactAddress());

        // business_info PUT is a full replace — an explicit null for a field
        // the operator simply didn't fill in this draft would wipe real
        // content that was live on Meta (e.g. from ensureBackfilled or a
        // prior deploy). Only send fields this draft actually has a value
        // for, same conditional pattern contact_info already used below.
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        if (draft.getPaymentMethod() != null) payload.put("payment_method", draft.getPaymentMethod());
        if (draft.getReturnPolicy() != null) payload.put("return_policy", draft.getReturnPolicy());
        if (draft.getPurchaseInfo() != null) payload.put("purchase_info", draft.getPurchaseInfo());
        if (draft.getDeliveryAndShipping() != null) payload.put("delivery_and_shipping", draft.getDeliveryAndShipping());
        if (draft.getBusinessDescription() != null) payload.put("business_description", draft.getBusinessDescription());
        if (!contactInfo.isEmpty()) payload.put("contact_info", contactInfo);

        // A draft with nothing filled in at all would otherwise PUT an empty
        // object to a full-replace endpoint — unverified/unwanted behavior
        // against real client data. Reject before the call, not after.
        if (payload.isEmpty()) {
            throw new BusinessException("This draft has no fields filled in — add at least one before deploying.");
        }

        metaApiClient.put("/" + phoneNumberId + "/agent_config/business_info", payload, Map.class);
    }

    private BusinessProfile fromMetaResponse(Map<?, ?> live, String phoneNumberId) {
        Object contactObj = live.get("contact_info");
        Map<?, ?> contact = contactObj instanceof Map<?, ?> m ? m : Map.of();
        return BusinessProfile.builder()
                .accountId(null)
                .status(Status.ARCHIVED)
                .phoneNumberId(phoneNumberId)
                .paymentMethod(str(live.get("payment_method")))
                .returnPolicy(str(live.get("return_policy")))
                .purchaseInfo(str(live.get("purchase_info")))
                .deliveryAndShipping(str(live.get("delivery_and_shipping")))
                .businessDescription(str(live.get("business_description")))
                .contactEmail(str(contact.get("email")))
                .contactHoursOfOperation(str(contact.get("hours_of_operation")))
                .contactAddress(str(contact.get("address")))
                .archivedAt(LocalDateTime.now())
                .build();
    }

    private static String str(Object o) {
        return o != null ? o.toString() : null;
    }

    private BusinessProfile loadOwnedDraft(Long id) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        BusinessProfile profile = repository.findByIdAndAccountId(id, accountId)
                .orElseThrow(() -> new NotFoundException("Business profile not found"));
        if (profile.getStatus() != Status.DRAFT) {
            throw new BusinessException("Only draft business profiles can be edited or deployed directly.");
        }
        return profile;
    }
}
