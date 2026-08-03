package com.metaagent.platform.domain.templatestudio.iris;

import java.util.Map;

public record AiTurnResult(Type type, String text, String toolName, Map<String, Object> toolArguments) {
    public enum Type { TEXT, TOOL_CALL }

    public static AiTurnResult text(String text) {
        return new AiTurnResult(Type.TEXT, text, null, null);
    }

    public static AiTurnResult toolCall(String toolName, Map<String, Object> arguments) {
        return new AiTurnResult(Type.TOOL_CALL, null, toolName, arguments);
    }
}
