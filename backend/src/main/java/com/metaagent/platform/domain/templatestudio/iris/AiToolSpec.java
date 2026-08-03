package com.metaagent.platform.domain.templatestudio.iris;

import java.util.Map;

/**
 * One entry in Iris's fixed tool allowlist — this Map IS the allowlist; the
 * model can never call anything not represented here (enforced in
 * IrisConversationService before any tool executes, not left to system-
 * prompt instruction alone).
 */
public record AiToolSpec(String name, String description, Map<String, Object> inputSchema, boolean requiresConfirmation) {}
