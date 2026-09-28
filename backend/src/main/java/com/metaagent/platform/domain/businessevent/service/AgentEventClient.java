package com.metaagent.platform.domain.businessevent.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The only caller of Meta's {@code /agent_event} endpoints.
 *
 * <p>Two operations, because Meta offers two: announce something
 * ({@link #send}), and ask what became of it ({@link #fetchStatus}).
 *
 * <p><b>This endpoint takes NO {@code agent_id} query parameter, and
 * {@link MetaApiClient#scopedPath} must never be applied to it.</b> Every other
 * agent-scoped path in this codebase is scoped that way, so this looks like an
 * oversight and is not: on {@code agent_event} the phone number IS the entity
 * Meta resolves the agent from, and appending {@code ?agent_id=} is a 400. If
 * you are here to "fix" the missing scopedPath, this paragraph is the answer.
 *
 * <p>The responses are typed records rather than {@code Map} so the two fields
 * we actually make decisions on — the event id and the status — are named and
 * compile-checked instead of being fished out with a cast. Both carry
 * {@code @JsonIgnoreProperties(ignoreUnknown = true)} because Meta adds fields
 * to these responses without announcing it, and a new field must never turn an
 * accepted announcement into a deserialisation failure we then record as
 * FAILED. Meta's wire names are snake_case, so each component states its
 * {@code @JsonProperty} explicitly rather than relying on a global naming
 * strategy that a future config change could flip.
 */
@Component
@RequiredArgsConstructor
public class AgentEventClient {

    private final MetaApiClient metaApiClient;

    /**
     * Meta's 200 response to a fire. {@code agentEventId} is optional in Meta's
     * contract — an accepted event can come back without one, and then it can
     * never be polled. We record that rather than paper over it.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SendResponse(
            @JsonProperty("status") String status,
            @JsonProperty("agent_event_id") String agentEventId) {
    }

    /**
     * Meta's status response. {@code status} is one of
     * request_received / processing / sent / failed / skipped / success; any
     * other value is mapped to {@code unknown} by the caller rather than
     * throwing.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StatusResponse(
            @JsonProperty("status") String status,
            @JsonProperty("event_type") String eventType,
            @JsonProperty("error_message") String errorMessage,
            @JsonProperty("skipped_reason") String skippedReason,
            @JsonProperty("created_at") String createdAt,
            @JsonProperty("updated_at") String updatedAt) {
    }

    /**
     * Fires one event at one customer. Throws {@code MetaApiException} on any
     * non-2xx — the caller records that as a FAILED ledger row rather than
     * letting it escape.
     */
    public SendResponse send(String phoneNumberId, String toE164, String eventType, String description, String payload) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", eventType);
        event.put("description", description);
        event.put("payload", payload);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("to", toE164);
        body.put("event", event);

        // No scopedPath — see the class note.
        return metaApiClient.post("/" + phoneNumberId + "/agent_event", body, SendResponse.class);
    }

    /** Asks Meta what became of one accepted event. A 404 is a real answer here and reaches the caller as MetaApiException.isNotFound(). */
    public StatusResponse fetchStatus(String phoneNumberId, String agentEventId) {
        // No scopedPath — see the class note.
        return metaApiClient.get("/" + phoneNumberId + "/agent_event/" + agentEventId, StatusResponse.class);
    }
}
