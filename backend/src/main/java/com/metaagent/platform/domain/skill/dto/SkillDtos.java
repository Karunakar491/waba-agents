package com.metaagent.platform.domain.skill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class SkillDtos {

    private SkillDtos() {}

    public record CreateRequest(
            @NotNull(message = "wabaId is required")
            String wabaId,

            @NotBlank(message = "Title is required")
            @Size(max = 64)
            String title,

            @NotBlank(message = "Description is required")
            @Size(max = 1024)
            String description,

            @NotBlank(message = "Body is required")
            @Size(max = 20000, message = "Body cannot exceed 20,000 characters")
            String body,

            /** Optional provenance tags (V43). Null leaves the stored value untouched. */
            @Size(max = 64) String industry,
            @Size(max = 64) String useCase
    ) {}

    public record UpdateRequest(
            @NotBlank(message = "Title is required")
            @Size(max = 64)
            String title,

            @NotBlank(message = "Description is required")
            @Size(max = 1024)
            String description,

            @NotBlank(message = "Body is required")
            @Size(max = 20000, message = "Body cannot exceed 20,000 characters")
            String body,

            /** Optional provenance tags (V43). Null leaves the stored value untouched. */
            @Size(max = 64) String industry,
            @Size(max = 64) String useCase
    ) {}

    /** deployed = at least one agent_skill_attachment has ever synced this skill
     * (deployed_at IS NOT NULL) — "live-somewhere counts as Deployed" even if a
     * newer edit is currently pending on some attachment (per-attachment
     * out-of-sync stays a separate, finer-grained signal on AgentSkillView).
     * source/agentId/agentName (TASK-053): a legacy AgentSkill row shown in
     * this same aggregate list — source="AGENT", always deployed=true (it
     * writes through to Meta immediately), edit/delete must go through the
     * legacy /agents/{agentId}/skills/{id} endpoints, NOT /skills/{id}. */
    public record SkillResponse(
            String id,
            String wabaId,
            String title,
            String description,
            String body,
            String updatedAt,
            boolean deployed,
            String source, // "LIBRARY" | "AGENT"
            String agentId, // set only when source = "AGENT"
            String agentName, // set only when source = "AGENT"
            List<Deployment> deployments, // every agent+number this skill is live on (0..N for LIBRARY, 0..1 for AGENT)
            String industry, // V43 provenance tag; null for skills created before it existed and for every legacy AGENT row
            String useCase
    ) {}

    /** One agent+phone-number a skill is deployed to — a Library skill can have several. */
    public record Deployment(
            String agentId,
            String agentName,
            String phoneNumberId // null if the agent has none bound yet
    ) {}

    /** One row in an agent's Skills tab — a legacy agent-scoped skill (source=AGENT,
     * always live) or a Library-attached skill (source=LIBRARY, may be out of sync). */
    public record AgentSkillView(
            String id,
            String source, // "AGENT" | "LIBRARY"
            String title,
            String description,
            String body,
            String status, // "LIVE" | "OUT_OF_SYNC"
            boolean canPromote,
            String librarySkillId, // set only when source = LIBRARY
            /** "published" | "draft" — Unpublish/Draft only applies to source=AGENT rows
             * today; LIBRARY-attached skills always report "published" here (out of scope,
             * they have their own promote/detach lifecycle). */
            String publishStatus
    ) {}

    public record SyncItemResult(
            String attachmentId,
            String skillTitle,
            boolean success,
            String error
    ) {}

    public record SyncSkillsResponse(List<SyncItemResult> results) {}

    /** Karix-curated reference catalog entry — global, no waba_id/account_id at all.
     * "Copy to my Skills" is a one-way INSERT (no live link back to the template). */
    public record SkillTemplateResponse(
            String id,
            String title,
            String description,
            String body,
            String industry,
            String useCase
    ) {}

    public record CopyTemplateRequest(
            @NotNull(message = "wabaId is required")
            String wabaId
    ) {}

    /** F22 (2026-08-07) — cross-agent UI Skills rollup for the Skill Library.
     * No Library/attachment concept exists for UI skills (each is tied directly
     * to one phone number on Meta's side, unlike plain Skills) — this is a
     * read-only aggregate over every agent on the WABA, same "rollup, not
     * source of truth" convention as ConnectorsTable/FileWebsiteTables. Edit
     * happens on the owning agent's Skills tab, never here. */
    public record UiSkillView(
            String id,
            String title,
            String componentType,
            String status,
            String instruction,
            String agentId,
            String agentName,
            String phoneNumberId
    ) {}
}
