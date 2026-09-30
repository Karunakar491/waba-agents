package com.metaagent.platform.domain.businessevent.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.domain.businessevent.entity.BusinessEvent;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Named, reusable event definitions and what attaches to them. Kept separate
 * from {@link BusinessEventFireDtos}, which is the fire history read model —
 * a different screen, a different lifecycle.
 */
public final class BusinessEventDtos {

    private BusinessEventDtos() {}

    /**
     * One row of the shared list. {@code usedByCount} and {@code lastFiredAt}
     * are both always present; which one a screen shows is a frontend
     * decision, not two different backend calls — the founder's Q9 wants one
     * list, not two shapes of it.
     */
    public record EventListItem(
            @JsonSerialize(using = ToStringSerializer.class) Long id,
            String name,
            String description,
            String guardrails,
            String triggerMethod,
            long usedByCount,
            LocalDateTime lastFiredAt,
            boolean attachedToThisAgent
    ) {}

    public record CreateOrUpdateRequest(
            String name,
            String description,
            String guardrails,
            String triggerMethod
    ) {}

    /** What deleting this event would break — shown before it happens, never after. */
    public record DeleteImpact(
            boolean inUse,
            List<String> agentNames
    ) {}

    public static BusinessEvent.TriggerMethod parseTriggerMethod(String raw) {
        if (raw == null || raw.isBlank()) {
            return BusinessEvent.TriggerMethod.MANUAL;
        }
        return BusinessEvent.TriggerMethod.valueOf(raw.trim().toUpperCase());
    }
}
