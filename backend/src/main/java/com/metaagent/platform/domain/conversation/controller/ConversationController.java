package com.metaagent.platform.domain.conversation.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.conversation.dto.ConversationListItem;
import com.metaagent.platform.domain.conversation.entity.Conversation;
import com.metaagent.platform.domain.conversation.entity.Message;
import com.metaagent.platform.domain.conversation.service.ConversationService;
import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final AgentRepository agentRepository;
    private final PhoneNumberSnapshotRepository phoneNumberSnapshotRepository;

    @GetMapping("/conversations/counts")
    public ApiResponse<Map<Long, Long>> getConversationCounts() {
        return ApiResponse.ok(conversationService.getConversationCountsByAgent());
    }

    @GetMapping("/conversations")
    public ApiResponse<List<ConversationListItem>> getAccountConversations(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        List<Conversation> conversations = conversationService.getAccountConversations(page, size);
        return ApiResponse.ok(enrich(conversations));
    }

    @GetMapping("/agents/{agentId}/conversations")
    public ApiResponse<List<ConversationListItem>> getConversations(
            @PathVariable Long agentId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        List<Conversation> conversations = conversationService.getConversations(agentId, page, size);
        return ApiResponse.ok(enrich(conversations));
    }

    /**
     * Founder-reported gap (2026-08-13): "with 7-8 phone numbers, how should
     * I identify which number it is pinged to" — Conversation only stores
     * agentId, not a phone number of its own. Resolved via each
     * conversation's owning agent, batched (not N+1) across the page.
     */
    private List<ConversationListItem> enrich(List<Conversation> conversations) {
        List<Long> agentIds = conversations.stream().map(Conversation::getAgentId).distinct().toList();
        Map<Long, Agent> agentsById = agentRepository.findAllById(agentIds).stream()
                .collect(java.util.stream.Collectors.toMap(Agent::getId, a -> a));

        Long accountId = SecurityContextHelper.getRequiredAccountId();
        List<String> phoneNumberIds = agentsById.values().stream()
                .map(Agent::getPhoneNumberId).filter(java.util.Objects::nonNull).distinct().toList();
        Map<String, String> displayByPhoneNumberId = phoneNumberIds.isEmpty() ? Map.of()
                : phoneNumberSnapshotRepository.findAllByAccountId(accountId).stream()
                        .filter(s -> phoneNumberIds.contains(s.getPhoneNumberId()))
                        .collect(java.util.stream.Collectors.toMap(
                                PhoneNumberSnapshot::getPhoneNumberId,
                                s -> s.getDisplayPhoneNumber() != null ? s.getDisplayPhoneNumber() : "",
                                (a, b) -> a));

        return conversations.stream().map(c -> {
            Agent agent = agentsById.get(c.getAgentId());
            String phoneNumberId = agent != null ? agent.getPhoneNumberId() : null;
            String display = phoneNumberId != null ? displayByPhoneNumberId.get(phoneNumberId) : null;
            return new ConversationListItem(
                    c,
                    (display != null && !display.isEmpty()) ? display : phoneNumberId,
                    agent != null ? agent.getDisplayName() : null);
        }).toList();
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
