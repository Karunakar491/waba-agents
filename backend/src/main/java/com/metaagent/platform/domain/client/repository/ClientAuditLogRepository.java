package com.metaagent.platform.domain.client.repository;

import com.metaagent.platform.domain.client.entity.ClientAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClientAuditLogRepository extends JpaRepository<ClientAuditLog, Long> {

    List<ClientAuditLog> findAllByClientIdOrderByChangedAtDesc(Long clientId);
}
