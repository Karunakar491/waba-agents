package com.metaagent.platform.domain.agent.repository;

import com.metaagent.platform.domain.agent.entity.Agent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AgentRepository extends JpaRepository<Agent, Long> {
    Optional<Agent> findByPhoneNumberId(String phoneNumberId);

    /**
     * Access = bound to a WABA this account has a waba_account_access grant
     * on, OR an unbound draft this account created (nothing to share yet).
     * See PhoneNumberAccessGuard for the same 2026-07-28 decoupling logic.
     */
    @Query("SELECT a FROM Agent a WHERE " +
            "(a.wabaId IS NOT NULL AND a.wabaId IN (SELECT w.wabaId FROM WabaAccountAccess w WHERE w.accountId = :accountId)) " +
            "OR (a.wabaId IS NULL AND a.accountId = :accountId)")
    List<Agent> findAllAccessibleByAccount(@Param("accountId") Long accountId);

    /** Internal use only — does NOT check waba_account_access itself. The
     * caller MUST have already verified the calling account has access to
     * this wabaId (e.g. via requireWabaAccess) before calling this. */
    List<Agent> findAllByWabaId(Long wabaId);
}
