package com.metaagent.platform.domain.agent.dto;

import java.util.List;

/** Aggregate Files/Websites library (TASK-065) — unlike Skills, a file/website
 * belongs to exactly one agent permanently (no shared Library/attachment concept). */
public final class FileLibraryDtos {

    private FileLibraryDtos() {}

    public record FileRow(
            String id,
            String filename,
            boolean metaSynced,
            String agentId,
            String agentName,
            String phoneNumberId,
            String lastEdited
    ) {}

    public record WebsiteRow(
            String id,
            String url,
            boolean metaSynced,
            String agentId,
            String agentName,
            String phoneNumberId,
            String lastEdited
    ) {}

    /**
     * An FAQ, rolled up across every agent on a WABA.
     *
     * The Knowledge Base screen showed files and websites but no FAQs at all
     * (founder, 2026-09-07: "FAQ's are still not visible in knowledge base"),
     * because FAQs only ever had per-agent endpoints — /agents/{id}/faq — and
     * nothing that listed them together the way /files and /websites do.
     *
     * status carries Meta's published/unpublished lifecycle, which files and
     * websites do not have: an FAQ can be withdrawn from Meta while staying in
     * our database, and a row that says "Synced" while being unpublished would
     * be a lie.
     */
    public record FaqRow(
            String id,
            String question,
            String answer,
            boolean metaSynced,
            String status,
            String agentId,
            String agentName,
            String phoneNumberId,
            String metaAgentId,
            String lastEdited
    ) {}

    public record FileListResponse(List<FileRow> files) {}
    public record WebsiteListResponse(List<WebsiteRow> websites) {}
    public record FaqListResponse(List<FaqRow> faqs) {}
}
