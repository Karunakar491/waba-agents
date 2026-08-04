package com.metaagent.platform.domain.templatestudio.iris;

import java.time.LocalDateTime;

/** Spring Data interface projection — sidebar list never hydrates pending_tool_args_json. */
public interface IrisSessionSummaryProjection {
    Long getId();
    String getTitle();
    LocalDateTime getUpdatedAt();
}
