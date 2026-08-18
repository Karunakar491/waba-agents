package com.metaagent.platform.domain.iris;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IrisMessageRepository extends JpaRepository<IrisMessage, Long> {
    List<IrisMessage> findAllBySessionIdOrderByCreatedAtAsc(Long sessionId);
}
