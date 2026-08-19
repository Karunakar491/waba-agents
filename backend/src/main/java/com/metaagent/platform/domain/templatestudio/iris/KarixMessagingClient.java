package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.waba.entity.KarixEsmeCredential;
import com.metaagent.platform.domain.waba.entity.PhoneEsmeMapping;
import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import com.metaagent.platform.domain.waba.repository.KarixEsmeCredentialRepository;
import com.metaagent.platform.domain.waba.repository.PhoneEsmeMappingRepository;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

/**
 * In-house Karix RCM send capability for Iris's send_test_template tool —
 * calls Karix's real sendMessage API directly (2026-08-04, founder's
 * explicit call: "leave that MCP product aside"). Karix's send endpoint
 * only needs the plain api_key as a Bearer header (confirmed from
 * karix-mcp's own karix_client.py — no OAuth exchange involved), so there's
 * no need to route through karix-mcp at all for this, which doesn't even
 * have a REST endpoint for sending today (MCP-tool-only). Template
 * create/edit/list stay on karix-mcp exactly as before — only this new
 * capability is direct.
 */
@Slf4j
@Component
public class KarixMessagingClient {

    private final WabaAccessGuard wabaAccessGuard;
    private final PhoneEsmeMappingRepository phoneEsmeMappingRepository;
    private final KarixEsmeCredentialRepository esmeCredentialRepository;
    private final PhoneNumberSnapshotRepository phoneNumberSnapshotRepository;
    private final SecretEncryptor secretEncryptor;

    private final RestClient restClient;

    public KarixMessagingClient(WabaAccessGuard wabaAccessGuard,
                                PhoneEsmeMappingRepository phoneEsmeMappingRepository,
                                KarixEsmeCredentialRepository esmeCredentialRepository,
                                PhoneNumberSnapshotRepository phoneNumberSnapshotRepository,
                                SecretEncryptor secretEncryptor,
                                RestClient.Builder builder,
                                @Value("${karix.send-base-url:https://rcmapi.instaalerts.zone}") String sendBaseUrl) {
        this.wabaAccessGuard = wabaAccessGuard;
        this.phoneEsmeMappingRepository = phoneEsmeMappingRepository;
        this.esmeCredentialRepository = esmeCredentialRepository;
        this.phoneNumberSnapshotRepository = phoneNumberSnapshotRepository;
        this.secretEncryptor = secretEncryptor;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        this.restClient = builder.requestFactory(requestFactory).baseUrl(sendBaseUrl).build();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> sendTestTemplate(Long wabaId, String templateName, String testPhoneNumber) {
        return sendTestTemplate(wabaId, templateName, testPhoneNumber, List.of());
    }

    /**
     * templateName MUST be the template's name (e.g. "order_confirmation"),
     * NEVER Meta's numeric fb_template_id — confirmed live 2026-08-07: Karix's
     * real sendMessage API rejects a numeric id with "HSM ID does not exist"
     * and only accepts the template name in the same "templateId" JSON field
     * (Karix's own API naming, kept as-is below to match their contract).
     *
     * parameterValues fills the template's positional body/button placeholders
     * in order (Karix's own convention — see karix-mcp's build_template, which
     * keys them "0","1",... by index). For an AUTHENTICATION/OTP_COPY_CODE
     * template this is the one-time code: it fills the {{1}} body placeholder
     * AND is what the OTP button copies, both from the same value — Karix's
     * sendMessage API does not take a separate button-level parameter for
     * OTP (needs live-Meta-account validation: no test WABA with an approved
     * AUTHENTICATION template exists yet to confirm this against a real send).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sendTestTemplate(Long wabaId, String templateName, String testPhoneNumber, List<String> parameterValues) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        wabaAccessGuard.requireAccess(wabaId, accountId);

        PhoneEsmeMapping mapping = phoneEsmeMappingRepository.findFirstByWabaIdOrderByIdAsc(wabaId)
                .orElseThrow(() -> new BusinessException("No phone number on this WABA has a Karix credential configured yet — set one up in Settings."));
        KarixEsmeCredential credential = esmeCredentialRepository.findById(mapping.getEsmeCredentialId())
                .orElseThrow(() -> new BusinessException("Karix credential not found for the mapped phone number."));
        PhoneNumberSnapshot senderPhone = phoneNumberSnapshotRepository.findAllByAccountId(accountId).stream()
                .filter(p -> p.getPhoneNumberId().equals(mapping.getPhoneNumberId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Could not resolve a sending phone number for this WABA."));

        String sender = senderPhone.getDisplayPhoneNumber() == null ? "" : senderPhone.getDisplayPhoneNumber().replaceAll("[^0-9]", "");
        if (sender.isBlank()) {
            throw new BusinessException("This WABA's sending phone number isn't synced yet — refresh the WABA's phone numbers and try again.");
        }
        String apiKey = secretEncryptor.decrypt(credential.getEncryptedApiKey());

        Map<String, Object> parameterValuesMap = new HashMap<>();
        for (int i = 0; i < parameterValues.size(); i++) {
            parameterValuesMap.put(String.valueOf(i), parameterValues.get(i));
        }

        Map<String, Object> body = Map.of(
                "message", Map.of(
                        "channel", "WABA",
                        "content", Map.of("type", "TEMPLATE", "template", Map.of("templateId", templateName, "parameterValues", parameterValuesMap)),
                        "recipient", Map.of("to", testPhoneNumber, "recipient_type", "individual"),
                        "sender", Map.of("from", sender)),
                "metaData", Map.of("version", "v1.0.9"));

        try {
            return restClient.post()
                    .uri("/services/rcm/sendMessage")
                    .header("Authentication", "Bearer " + apiKey)
                    .body(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new BusinessException("Test send failed: " + resp.getStatusCode());
                    })
                    .body(Map.class);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Karix test send failed: {}", e.getMessage());
            throw new BusinessException("Could not reach Karix to send the test message — try again in a moment.");
        }
    }
}
