package com.metaagent.platform.domain.conversation.repository;

import com.metaagent.platform.domain.conversation.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findAllByConversationId(Long conversationId);
    List<Message> findAllByConversationIdAndAccountId(Long conversationId, Long accountId, Pageable pageable);
    Optional<Message> findByMetaMessageId(String metaMessageId);
}
