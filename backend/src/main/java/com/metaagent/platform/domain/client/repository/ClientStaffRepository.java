package com.metaagent.platform.domain.client.repository;

import com.metaagent.platform.domain.client.entity.ClientStaff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientStaffRepository extends JpaRepository<ClientStaff, Long> {

    Optional<ClientStaff> findByClientIdAndUserId(Long clientId, Long userId);

    List<ClientStaff> findAllByClientId(Long clientId);

    boolean existsByClientIdAndUserId(Long clientId, Long userId);

    void deleteByClientIdAndUserId(Long clientId, Long userId);
}
