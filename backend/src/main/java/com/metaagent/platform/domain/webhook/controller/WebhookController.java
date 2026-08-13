package com.metaagent.platform.domain.webhook.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.webhook.entity.WebhookRaw;
import com.metaagent.platform.domain.webhook.repository.WebhookRawRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/webhook")
@RequiredArgsConstructor
public class WebhookController {

    private final WebhookRawRepository webhookRawRepository;
    private final AgentRepository agentRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    @Value("${meta.webhook.verify-token}")
    private String verifyToken;

    // No default — missing config must crash Spring context startup, not silently
    // disable signature verification on the platform's single most attackable
    // entry point. See TASKS.md follow-up if this ever needs to move to a
    // per-environment profile instead of a hard requirement.
    @Value("${meta.webhook.app-secret}")
    private String appSecret;

    @Value("${meta.webhook.exchange:platform.events}")
    private String exchange;

    @Value("${meta.webhook.routing-key:webhook.received}")
    private String routingKey;

    /**
     * Meta Hub challenge verification endpoint (GET).
     * One callback URL per Meta App — tenant routing happens per-payload in POST.
     */
    @GetMapping
    public ResponseEntity<String> verifyWebhook(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.challenge") String challenge,
            @RequestParam("hub.verify_token") String token
    ) {
        log.info("Received Meta webhook verification request");
        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            return ResponseEntity.ok(challenge);
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Verification token mismatch");
    }

    /**
     * Inbound webhook payloads endpoint (POST).
     * Tenant is resolved from the payload: metadata.phone_number_id -> agent -> account.
     * Never derived from the request — Meta calls one URL for all customers.
     */
    @PostMapping
    public ResponseEntity<String> receiveWebhook(
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signatureHeader,
            @RequestBody String rawPayload
    ) {
        // 1. Signature Verification (HMAC-SHA256 using META_APP_SECRET) — always
        // enforced; appSecret has no default, so a missing config value already
        // crashed Spring context startup before this method could ever run.
        //
        // Founder-reported gap (2026-08-13): "log ALL webhooks, every kind" —
        // this used to return 403 without ever persisting anything, so a
        // failed-signature attempt (misconfigured secret, spoofed request)
        // left literally no record anywhere. Still never trusted as real Meta
        // data (accountId/agentId stay null, status FAILED, never queued for
        // processing) — persisting it is for audit/debugging visibility only.
        if (signatureHeader == null || !verifySignature(rawPayload, signatureHeader, appSecret)) {
            log.warn("Webhook signature verification failed");
            webhookRawRepository.save(WebhookRaw.builder()
                    .accountId(null)
                    .agentId(null)
                    .phoneNumberId(bestEffortExtractPhoneNumberId(rawPayload))
                    .payload(rawPayload)
                    .signature(signatureHeader != null ? signatureHeader : "UNSIGNED")
                    .status(WebhookRaw.Status.FAILED)
                    .errorMessage("Signature verification failed")
                    .build());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Signature verification failed");
        }

        // 2. Resolve tenant from payload: phone_number_id -> agent -> account
        String phoneNumberId = null;
        Agent agent = null;
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            phoneNumberId = extractPhoneNumberId(root);
            if (phoneNumberId != null) {
                agent = agentRepository.findByPhoneNumberId(phoneNumberId).orElse(null);
            }
        } catch (Exception e) {
            log.error("Failed to parse incoming webhook payload: {}", e.getMessage());
        }

        if (agent == null) {
            // No tenant to attribute this payload to — still persisted (V50 made
            // account_id nullable for exactly this case), just never queued for
            // processing (nothing downstream knows which account/agent to use).
            // Always 200 — Meta retry-loops on errors.
            log.warn("Webhook unattributable — no agent for phone_number_id={}. Persisted, not processed.", phoneNumberId);
            webhookRawRepository.save(WebhookRaw.builder()
                    .accountId(null)
                    .agentId(null)
                    .phoneNumberId(phoneNumberId)
                    .payload(rawPayload)
                    .signature(signatureHeader)
                    .status(WebhookRaw.Status.FAILED)
                    .errorMessage("No agent found for phone_number_id=" + phoneNumberId)
                    .build());
            return ResponseEntity.ok("OK");
        }

        Long accountId = agent.getAccountId();
        Long agentId = agent.getId();

        // 3. Persist raw payload to MySQL immediately (PENDING)
        WebhookRaw webhookRaw = WebhookRaw.builder()
                .accountId(accountId)
                .agentId(agentId)
                .phoneNumberId(phoneNumberId)
                .payload(rawPayload)
                .signature(signatureHeader != null ? signatureHeader : "UNSIGNED")
                .status(WebhookRaw.Status.PENDING)
                .build();
        webhookRawRepository.save(webhookRaw);

        // 4. Publish event to RabbitMQ (Claim Check pattern: only send ID and accountId)
        Map<String, Object> event = new HashMap<>();
        event.put("webhookRawId", webhookRaw.getId());
        event.put("accountId", accountId);
        event.put("agentId", agentId);

        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
        } catch (Exception e) {
            log.error("Failed to publish webhook event to RabbitMQ: {}", e.getMessage());
            // Do not fail HTTP request to avoid Meta retry loops. Webhook is persisted as PENDING,
            // so we can execute manual/scheduled recovery sweeps later.
        }

        // 5. Respond 200 OK immediately within 20s window
        return ResponseEntity.ok("OK");
    }

    /** Best-effort — used only for the signature-failed audit trail, where the payload is untrusted and may not even be valid JSON. */
    private String bestEffortExtractPhoneNumberId(String rawPayload) {
        try {
            return extractPhoneNumberId(objectMapper.readTree(rawPayload));
        } catch (Exception e) {
            return null;
        }
    }

    private boolean verifySignature(String payload, String signatureHeader, String secret) {
        if (signatureHeader == null || signatureHeader.length() < 8 || !signatureHeader.startsWith("sha256=")) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            byte[] expected = hexToBytes(signatureHeader.substring(7));
            return MessageDigest.isEqual(computed, expected); // constant-time compare — no timing oracle
        } catch (Exception e) {
            log.warn("Signature verification failed: {}", e.getMessage());
            return false;
        }
    }

    private byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() % 2 != 0) {
            throw new IllegalArgumentException("Invalid hex string length");
        }
        byte[] data = new byte[hex.length() / 2];
        for (int i = 0; i < hex.length(); i += 2) {
            int high = Character.digit(hex.charAt(i), 16);
            int low = Character.digit(hex.charAt(i + 1), 16);
            if (high == -1 || low == -1) {
                throw new IllegalArgumentException("Invalid hex character at index " + i);
            }
            data[i / 2] = (byte) ((high << 4) + low);
        }
        return data;
    }

    private String extractPhoneNumberId(JsonNode root) {
        if (root.has("entry") && root.get("entry").isArray() && root.get("entry").size() > 0) {
            JsonNode entryNode = root.get("entry").get(0);
            if (entryNode.has("changes") && entryNode.get("changes").isArray() && entryNode.get("changes").size() > 0) {
                JsonNode change = entryNode.get("changes").get(0);
                if (change.has("value") && change.get("value").has("metadata")) {
                    JsonNode metadata = change.get("value").get("metadata");
                    if (metadata.has("phone_number_id")) {
                        return metadata.get("phone_number_id").asText();
                    }
                }
            }
        }
        return null;
    }
}
