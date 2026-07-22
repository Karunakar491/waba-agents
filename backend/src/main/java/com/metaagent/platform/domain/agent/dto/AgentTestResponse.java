package com.metaagent.platform.domain.agent.dto;

import java.util.List;

public record AgentTestResponse(
    String messageId,
    String agentResponse,
    String conversationId,
    String handoffReason,       // non-null when agent would hand off to human
    String noResponseReason,    // non-null when agent did not respond
    List<String> quickReplies
) {}
