package com.metaagent.platform.domain.client.repository;

import com.metaagent.platform.domain.client.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    Optional<Client> findByIdAndAccountId(Long id, Long accountId);

    @Query("""
            select c from Client c
            where c.accountId = :accountId
              and c.id in (select cs.clientId from ClientStaff cs where cs.userId = :userId)
            """)
    List<Client> findAllByAccountIdAndStaffUserId(@Param("accountId") Long accountId, @Param("userId") Long userId);
}
