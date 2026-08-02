package com.metaagent.platform.domain.conversation.repository;

import com.metaagent.platform.domain.conversation.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findAllByConversationId(Long conversationId);
    List<Message> findAllByConversationId(Long conversationId, Pageable pageable);
    List<Message> findAllByConversationIdAndAccountId(Long conversationId, Long accountId, Pageable pageable);
    Optional<Message> findByMetaMessageId(String metaMessageId);

    /** Bulk delete for agent deletion cascade — a single statement, not entity-by-entity (agents can have 1000s of messages). */
    @Modifying
    @Query("DELETE FROM Message m WHERE m.agentId = :agentId")
    void deleteAllByAgentId(@Param("agentId") Long agentId);
}
