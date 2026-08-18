package com.metaagent.platform.domain.iris;

/** featureKey identifies which product started this session ("template_studio",
 * "agent_creation") — optional; callers that omit it get the pre-existing default. */
public record CreateSessionRequest(Long wabaId, String featureKey) {}
