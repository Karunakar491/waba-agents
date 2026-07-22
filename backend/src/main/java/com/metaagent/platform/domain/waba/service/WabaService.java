package com.metaagent.platform.domain.waba.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * WABA registry — validate against Meta, persist, list.
 * Reads the agent domain (already-connected flags) but never writes it.
 * Phone-to-agent binding lives in AgentService (spec: agent domain owns Agent writes).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WabaService {

    private final WabaRepository wabaRepository;
    private final AgentRepository agentRepository;
    private final MetaApiClient metaApiClient;

    /**
     * Validates a WABA ID against Meta and returns its phone numbers.
     * Error mapping per spec 5.4 — each Meta failure mode gets a distinct message.
     */
    public WabaDtos.ValidateResponse validate(String wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Map<?, ?> waba;
        try {
            waba = metaApiClient.get("/" + wabaId + "?fields=id,name", Map.class);
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

        Map<?, ?> phonesResponse;
        try {
            phonesResponse = metaApiClient.get("/" + wabaId + "/phone_numbers", Map.class);
        } catch (Exception e) {
            log.warn("WABA phone list failed: wabaId={} error={}", wabaId, e.getMessage());
            throw new BusinessException("Meta isn't responding. Wait a moment and try again.");
        }

        List<WabaDtos.PhoneNumber> phones = new ArrayList<>();
        Object data = phonesResponse != null ? phonesResponse.get("data") : null;
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> phone) {
                    String phoneNumberId = str(phone.get("id"));
                    var boundAgent = agentRepository.findByPhoneNumberId(phoneNumberId);
                    // Never leak another tenant's agent name — flag only.
                    String boundName = boundAgent
                            .filter(a -> accountId.equals(a.getAccountId()))
                            .map(Agent::getDisplayName)
                            .orElse(null);
                    phones.add(new WabaDtos.PhoneNumber(
                            phoneNumberId,
                            str(phone.get("display_phone_number")),
                            str(phone.get("verified_name")),
                            boundAgent.isPresent(),
                            boundName
                    ));
                }
            }
        }

        return new WabaDtos.ValidateResponse(wabaId, wabaName, phones);
    }

    @Transactional
    public Waba create(String wabaId, String label) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();

        // Idempotent: re-registering the same WABA returns the existing record.
        var existing = wabaRepository.findByAccountIdAndWabaId(accountId, wabaId);
        if (existing.isPresent()) {
            Waba waba = existing.get();
            if (label != null && !label.isBlank()) {
                waba.setLabel(label);
            }
            waba.setStatus(Waba.Status.active);
            return wabaRepository.save(waba);
        }

        try {
            return wabaRepository.save(Waba.builder()
                    .accountId(accountId)
                    .wabaId(wabaId)
                    .label(label)
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Concurrent create of the same WABA — unique (account_id, waba_id) wins the race.
            return wabaRepository.findByAccountIdAndWabaId(accountId, wabaId)
                    .orElseThrow(() -> new BusinessException("WABA registration failed. Try again."));
        }
    }

    public List<Waba> list() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return wabaRepository.findAllByAccountId(accountId);
    }

    private static String str(Object o) {
        return o != null ? o.toString() : "";
    }
}
