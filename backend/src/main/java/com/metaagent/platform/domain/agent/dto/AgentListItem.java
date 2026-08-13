package com.metaagent.platform.domain.agent.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.metaagent.platform.domain.agent.entity.Agent;

/**
 * Agents list response (founder-reported gap, 2026-08-13): the list page
 * was showing Meta's raw internal phoneNumberId ("115200419500001", not a
 * real dialable number) because it serialized the Agent entity directly,
 * which has no human-readable phone field. displayPhoneNumber comes from
 * PhoneNumberSnapshot (existing login-triggered sync cache) — best-effort,
 * null if a number was never synced (e.g. connected before the snapshot
 * feature existed, or sync hasn't run yet), in which case the frontend
 * falls back to showing the raw id rather than blanking the field.
 *
 * personaDescription (added same day, second founder pass): the Agents
 * list's "About" column used to be a manually-typed free-text field
 * (Agent.aboutLabel) unrelated to the agent's actual configured persona.
 * Founder wants About sourced from the real deployed Business Persona
 * (BusinessProfile.businessDescription for this agent's phone number,
 * status=DEPLOYED) instead — null (frontend shows "—") if no persona has
 * ever been deployed for that number. Agent.aboutLabel itself is untouched
 * (still a real column, just no longer this column's data source).
 */
public record AgentListItem(
        @JsonUnwrapped Agent agent,
        String displayPhoneNumber,
        String personaDescription
) {
}
