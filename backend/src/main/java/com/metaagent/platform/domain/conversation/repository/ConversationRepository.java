package com.metaagent.platform.domain.conversation.repository;

import com.metaagent.platform.domain.conversation.entity.Conversation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByAgentIdAndExternalId(Long agentId, String externalId);
    List<Conversation> findAllByAgentIdAndAccountId(Long agentId, Long accountId, Pageable pageable);
    Optional<Conversation> findByIdAndAccountId(Long id, Long accountId);
}
