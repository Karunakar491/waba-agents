package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.TenantDetails;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.entity.WabaAccountAccess;
import com.metaagent.platform.domain.waba.repository.KarixEsmeCredentialRepository;
import com.metaagent.platform.domain.waba.repository.PhoneEsmeMappingRepository;
import com.metaagent.platform.domain.waba.repository.WabaAccountAccessRepository;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Real MySQL via Testcontainers, real SecretEncryptor (round-trips a real
 * decrypted value through to the mocked client) — only TemplateStudioClient
 * (the network boundary to karix-mcp) is mocked. Covers the corrected
 * credential model (2026-08-04): a credential belongs to an esme_addr, a
 * phone number maps onto one via PhoneEsmeMapping, and template calls use
 * whichever mapping exists first for the WABA (Meta approves templates at
 * the WABA level, not per phone number).
 */
class TemplateStudioServiceTest extends IntegrationTestBase {

    @Autowired
    private TemplateStudioService templateStudioService;
    @Autowired
    private KarixCredentialService credentialService;
    @Autowired
    private WabaRepository wabaRepository;
    @Autowired
    private WabaAccountAccessRepository wabaAccountAccessRepository;
    @Autowired
    private PhoneEsmeMappingRepository phoneEsmeMappingRepository;
    @Autowired
    private KarixEsmeCredentialRepository esmeCredentialRepository;
    @Autowired
    private BusinessAccountRepository businessAccountRepository;

    @MockBean
    private TemplateStudioClient templateStudioClient;

    private Long ownerAccountId;
    private Long otherAccountId;
    private Long wabaId;

    @BeforeEach
    void setUp() {
        BusinessAccount owner = businessAccountRepository.save(account("owner"));
        BusinessAccount other = businessAccountRepository.save(account("other"));
        ownerAccountId = owner.getId();
        otherAccountId = other.getId();

        Waba waba = wabaRepository.save(Waba.builder()
                .accountId(ownerAccountId)
                .wabaId("494227720434920")
                .label("Test WABA")
                .build());
        wabaId = waba.getId();
        wabaAccountAccessRepository.save(WabaAccountAccess.builder()
                .wabaId(wabaId)
                .accountId(ownerAccountId)
                .grantedBy(ownerAccountId)
                .build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        phoneEsmeMappingRepository.deleteAll();
        esmeCredentialRepository.deleteAll();
        wabaAccountAccessRepository.deleteAll();
        wabaRepository.deleteAll();
        businessAccountRepository.deleteAll();
    }

    @Test
    void should_reject_when_account_has_no_access_to_waba() {
        authenticateAs(otherAccountId);
        assertThatThrownBy(() -> templateStudioService.createTemplate(wabaId, Map.of("template_name", "x")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void should_reject_when_no_phone_mapped_to_a_credential() {
        authenticateAs(ownerAccountId);
        assertThatThrownBy(() -> templateStudioService.createTemplate(wabaId, Map.of("template_name", "x")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("No phone number on this WABA");
    }

    @Test
    void should_decrypt_credential_and_pass_real_waba_id_to_client() {
        authenticateAs(ownerAccountId);
        credentialService.mapToNewEsme(wabaId, "918591689475", "esme-123", "Presales", "raw-api-key-abc");

        when(templateStudioClient.createTemplate(any(), any(), any(), any()))
                .thenReturn(Map.of("ok", true));

        Map<String, Object> payload = Map.of("template_name", "order_shipped");
        templateStudioService.createTemplate(wabaId, payload);

        verify(templateStudioClient).createTemplate(
                eq("esme-123"), eq("raw-api-key-abc"), eq("494227720434920"), eq(payload));
    }

    @Test
    void should_reuse_existing_esme_credential_across_multiple_phone_numbers() {
        authenticateAs(ownerAccountId);
        credentialService.mapToNewEsme(wabaId, "918591689475", "esme-shared", "Test_Call_Ft", "raw-api-key-shared");
        var options = credentialService.listEsmeOptions();
        Long esmeCredentialId = options.get(0).id();

        credentialService.mapToExistingEsme(wabaId, "919010011634", esmeCredentialId);

        var mappings = credentialService.listMappings(wabaId);
        assertThat(mappings).hasSize(2);
        assertThat(mappings).allMatch(m -> "esme-shared".equals(m.esmeAddr()));
    }

    @Test
    void should_reject_mapping_the_same_phone_number_twice() {
        authenticateAs(ownerAccountId);
        credentialService.mapToNewEsme(wabaId, "918591689475", "esme-123", "Presales", "raw-api-key-abc");

        assertThatThrownBy(() -> credentialService.mapToNewEsme(wabaId, "918591689475", "esme-456", "Other", "another-key"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already mapped");
    }

    @Test
    void should_reject_duplicate_esme_addr() {
        authenticateAs(ownerAccountId);
        credentialService.mapToNewEsme(wabaId, "918591689475", "esme-123", "Presales", "raw-api-key-abc");

        assertThatThrownBy(() -> credentialService.mapToNewEsme(wabaId, "919010011634", "esme-123", "Presales again", "another-key"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already configured");
    }

    @Test
    void should_never_expose_raw_api_key_via_mappings_or_options() {
        authenticateAs(ownerAccountId);
        credentialService.mapToNewEsme(wabaId, "918591689475", "esme-123", "Presales", "raw-api-key-abc");

        // MappingView/EsmeOption record shapes carry no api-key field at all —
        // there is no accessor to accidentally expose the key even if someone tried.
        assertThat(KarixCredentialService.MappingView.class.getRecordComponents()).hasSize(4);
        assertThat(KarixCredentialService.EsmeOption.class.getRecordComponents()).hasSize(3);
    }

    @Test
    void should_reject_mapping_when_account_has_no_access() {
        authenticateAs(otherAccountId);
        assertThatThrownBy(() -> credentialService.mapToNewEsme(wabaId, "918591689475", "esme-x", "label", "key-x"))
                .isInstanceOf(NotFoundException.class);
    }

    private BusinessAccount account(String prefix) {
        return BusinessAccount.builder()
                .name(prefix + " Co")
                .email(prefix + "-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .build();
    }

    private void authenticateAs(Long accountId) {
        TenantDetails tenantDetails = new TenantDetails(accountId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }
}
