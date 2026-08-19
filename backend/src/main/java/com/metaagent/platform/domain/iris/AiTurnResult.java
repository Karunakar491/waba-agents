package com.metaagent.platform.domain.iris;

import java.util.Map;

/**
 * totalTokens (2026-08-19) — null for adapters that don't report usage
 * (Claude/NVIDIA today). Only OpenAiAdapter populates it, for the
 * daily-budget tier switch in AiCredentialService; every other caller
 * treats a null totalTokens as "don't count this turn."
 */
public record AiTurnResult(Type type, String text, String toolName, Map<String, Object> toolArguments, Integer totalTokens) {
    public enum Type { TEXT, TOOL_CALL }

    public static AiTurnResult text(String text) {
        return new AiTurnResult(Type.TEXT, text, null, null, null);
    }

    public static AiTurnResult text(String text, Integer totalTokens) {
        return new AiTurnResult(Type.TEXT, text, null, null, totalTokens);
    }

    public static AiTurnResult toolCall(String toolName, Map<String, Object> arguments) {
        return new AiTurnResult(Type.TOOL_CALL, null, toolName, arguments, null);
    }

    public static AiTurnResult toolCall(String toolName, Map<String, Object> arguments, Integer totalTokens) {
        return new AiTurnResult(Type.TOOL_CALL, null, toolName, arguments, totalTokens);
    }
}
