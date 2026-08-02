package com.metaagent.platform.domain.client.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.client.entity.Client;
import com.metaagent.platform.domain.client.entity.ClientAuditLog;
import com.metaagent.platform.domain.client.entity.ClientStaff;
import com.metaagent.platform.domain.client.repository.ClientAuditLogRepository;
import com.metaagent.platform.domain.client.repository.ClientRepository;
import com.metaagent.platform.domain.client.repository.ClientStaffRepository;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.entity.User;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.user.repository.UserRepository;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration tests for ClientService — real MySQL via Testcontainers (EL rule).
 */
class ClientServiceTest extends IntegrationTestBase {

    @Autowired private ClientService clientService;
    @Autowired private ClientRepository clientRepository;
    @Autowired private ClientStaffRepository clientStaffRepository;
    @Autowired private ClientAuditLogRepository clientAuditLogRepository;
    @Autowired private WabaRepository wabaRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BusinessAccountRepository businessAccountRepository;

    private Long accountId;
    private Long staffAId;
    private Long staffBId;
    private Long wabaId;

    @BeforeEach
    void setUp() {
        BusinessAccount account = businessAccountRepository.save(BusinessAccount.builder()
                .name("Client Test Co")
                .email("client-svc-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build());
        accountId = account.getId();

        staffAId = userRepository.save(User.builder()
                .accountId(accountId).email("staffA-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed").role(User.Role.member).status(User.Status.active).build()).getId();
        staffBId = userRepository.save(User.builder()
                .accountId(accountId).email("staffB-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed").role(User.Role.member).status(User.Status.active).build()).getId();

        wabaId = wabaRepository.save(Waba.builder()
                .accountId(accountId).wabaId("111000222").label("Test WABA").build()).getId();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clientAuditLogRepository.deleteAll();
        clientStaffRepository.deleteAll();
        clientRepository.deleteAll();
        wabaRepository.deleteAll();
        userRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void create_persists_client_and_grants_creator_access() {
        authenticateAs(accountId, staffAId);

        Client client = clientService.create("Acme Corp", wabaId);

        assertThat(client.getId()).isNotNull();
        assertThat(client.getAccountId()).isEqualTo(accountId);
        assertThat(client.getWabaId()).isEqualTo(wabaId);
        assertThat(client.getCreditLineStatus()).isEqualTo(Client.CreditLineStatus.good_standing);
        assertThat(client.getCreatedBy()).isEqualTo(staffAId);

        List<ClientStaff> staff = clientStaffRepository.findAllByClientId(client.getId());
        assertThat(staff).extracting(ClientStaff::getUserId).containsExactly(staffAId);

        List<ClientAuditLog> audit = clientAuditLogRepository.findAllByClientIdOrderByChangedAtDesc(client.getId());
        assertThat(audit).hasSize(1);
        assertThat(audit.get(0).getChangeSummary()).contains("created client");
    }

    @Test
    void create_rejects_waba_from_another_account() {
        BusinessAccount other = businessAccountRepository.save(BusinessAccount.builder()
                .name("Other Co").email("other-client-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed").build());
        Long otherWabaId = wabaRepository.save(Waba.builder()
                .accountId(other.getId()).wabaId("999888777").build()).getId();

        authenticateAs(accountId, staffAId);

        assertThatThrownBy(() -> clientService.create("Acme", otherWabaId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("WABA not found");
    }

    @Test
    void listForCaller_returns_only_clients_staff_has_access_to() {
        authenticateAs(accountId, staffAId);
        Client mine = clientService.create("My Client", wabaId);

        authenticateAs(accountId, staffBId);
        Client notMine = clientService.create("Other Staff Client", wabaId);

        authenticateAs(accountId, staffAId);
        List<Client> visible = clientService.listForCaller();

        assertThat(visible).extracting(Client::getId).containsExactly(mine.getId());
        assertThat(visible).extracting(Client::getId).doesNotContain(notMine.getId());
    }

    @Test
    void getDetail_throws_NotFound_when_caller_has_no_staff_grant() {
        authenticateAs(accountId, staffAId);
        Client client = clientService.create("Acme Corp", wabaId);

        authenticateAs(accountId, staffBId);
        assertThatThrownBy(() -> clientService.getDetail(client.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void update_writes_audit_entry_with_before_after_values() {
        authenticateAs(accountId, staffAId);
        Client client = clientService.create("Acme Corp", wabaId);

        clientService.update(client.getId(), "Acme Corp Renamed", Client.CreditLineStatus.warning);

        Client updated = clientRepository.findByIdAndAccountId(client.getId(), accountId).orElseThrow();
        assertThat(updated.getName()).isEqualTo("Acme Corp Renamed");
        assertThat(updated.getCreditLineStatus()).isEqualTo(Client.CreditLineStatus.warning);
        assertThat(updated.getUpdatedBy()).isEqualTo(staffAId);

        List<ClientAuditLog> audit = clientAuditLogRepository.findAllByClientIdOrderByChangedAtDesc(client.getId());
        assertThat(audit).hasSize(2); // created + updated
        assertThat(audit.get(0).getChangeSummary()).contains("name:").contains("creditLineStatus:");
    }

    @Test
    void addStaffAccess_grants_second_staff_member_access() {
        authenticateAs(accountId, staffAId);
        Client client = clientService.create("Acme Corp", wabaId);

        clientService.addStaffAccess(client.getId(), staffBId);

        authenticateAs(accountId, staffBId);
        Client seenByB = clientService.getDetail(client.getId());
        assertThat(seenByB.getId()).isEqualTo(client.getId());
    }

    @Test
    void removeStaffAccess_blocks_removing_last_remaining_staff_member() {
        authenticateAs(accountId, staffAId);
        Client client = clientService.create("Acme Corp", wabaId);

        assertThatThrownBy(() -> clientService.removeStaffAccess(client.getId(), staffAId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("last staff member");
    }

    @Test
    void removeStaffAccess_revokes_access_when_another_staff_member_remains() {
        authenticateAs(accountId, staffAId);
        Client client = clientService.create("Acme Corp", wabaId);
        clientService.addStaffAccess(client.getId(), staffBId);

        clientService.removeStaffAccess(client.getId(), staffBId);

        authenticateAs(accountId, staffBId);
        assertThatThrownBy(() -> clientService.getDetail(client.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void authenticateAs(Long targetAccountId, Long userId) {
        TenantDetails tenantDetails = new TenantDetails(targetAccountId, userId, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);

        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }
}
