package com.metaagent.platform.domain.conversation.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.service.ConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping("/conversations/counts")
    public ApiResponse<Map<Long, Long>> getConversationCounts() {
        return ApiResponse.ok(conversationService.getConversationCountsByAgent());
    }

    @GetMapping("/conversations")
    public ApiResponse<List<Conversation>> getAccountConversations(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.ok(conversationService.getAccountConversations(page, size));
    }

    @GetMapping("/agents/{agentId}/conversations")
    public ApiResponse<List<Conversation>> getConversations(
            @PathVariable Long agentId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        List<Conversation> conversations = conversationService.getConversations(agentId, page, size);
        return ApiResponse.ok(conversations);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ApiResponse<List<Message>> getConversationMessages(
            @PathVariable Long conversationId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size
    ) {
        List<Message> messages = conversationService.getConversationMessages(conversationId, page, size);
        return ApiResponse.ok(messages);
    }
}
