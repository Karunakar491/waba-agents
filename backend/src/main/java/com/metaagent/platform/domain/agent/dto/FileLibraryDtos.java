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

    public record FileListResponse(List<FileRow> files) {}
    public record WebsiteListResponse(List<WebsiteRow> websites) {}
}
