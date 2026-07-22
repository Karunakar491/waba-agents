package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.Agent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentRepository extends JpaRepository<Agent, Long> {
    List<Agent> findAllByAccountId(Long accountId);
    Optional<Agent> findByIdAndAccountId(Long id, Long accountId);
    Optional<Agent> findByPhoneNumberId(String phoneNumberId);
}
