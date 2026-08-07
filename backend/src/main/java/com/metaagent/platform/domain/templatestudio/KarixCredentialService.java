package com.metaagent.platform.domain.templatestudio;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.waba.entity.KarixEsmeCredential;
import com.metaagent.platform.domain.waba.entity.PhoneEsmeMapping;
import com.metaagent.platform.domain.waba.entity.PhoneNumberSnapshot;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.repository.KarixEsmeCredentialRepository;
import com.metaagent.platform.domain.waba.repository.PhoneEsmeMappingRepository;
import com.metaagent.platform.domain.waba.repository.PhoneNumberSnapshotRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.domain.waba.repository.WabaRepository;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Admin-entry path for Karix esme_addr credentials, corrected 2026-08-04 from
 * a wrong one-credential-per-WABA model to the real one: a credential
 * belongs to an esme_addr (one api_key each), and phone numbers map
 * many-to-one onto it. The same esme_addr can serve phone numbers under
 * different WABAs — so this service never queries a credential by wabaId
 * directly, only via a PhoneEsmeMapping. No self-serve flow; staff-entered
 * once Karix issues values. The API key is NEVER returned once saved.
 */
@Service
@RequiredArgsConstructor
public class KarixCredentialService {

    private final WabaAccessGuard wabaAccessGuard;
    private final WabaRepository wabaRepository;
    private final PhoneNumberSnapshotRepository phoneNumberSnapshotRepository;
    private final PhoneEsmeMappingRepository phoneEsmeMappingRepository;
    private final KarixEsmeCredentialRepository esmeCredentialRepository;
    private final SecretEncryptor secretEncryptor;

    public record MappingView(String phoneNumberId, String displayPhoneNumber, String esmeAddr, String esmeLabel) {}
    public record EsmeOption(@JsonSerialize(using = ToStringSerializer.class) Long id, String esmeAddr, String label) {}

    /** Phone numbers under this WABA already mapped to a credential. */
    public List<MappingView> listMappings(Long wabaId) {
        requireAccess(wabaId);
        List<PhoneEsmeMapping> mappings = phoneEsmeMappingRepository.findAllByWabaId(wabaId);
        if (mappings.isEmpty()) return List.of();

        Map<Long, KarixEsmeCredential> credentialsById = esmeCredentialRepository
                .findAllById(mappings.stream().map(PhoneEsmeMapping::getEsmeCredentialId).toList())
                .stream().collect(Collectors.toMap(KarixEsmeCredential::getId, c -> c));

        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Map<String, PhoneNumberSnapshot> snapshotsById = phoneNumberSnapshotRepository.findAllByAccountId(accountId)
                .stream().collect(Collectors.toMap(PhoneNumberSnapshot::getPhoneNumberId, s -> s, (a, b) -> a));

        return mappings.stream().map(m -> {
            KarixEsmeCredential cred = credentialsById.get(m.getEsmeCredentialId());
            PhoneNumberSnapshot snapshot = snapshotsById.get(m.getPhoneNumberId());
            return new MappingView(
                    m.getPhoneNumberId(),
                    snapshot != null ? snapshot.getDisplayPhoneNumber() : null,
                    cred != null ? cred.getEsmeAddr() : null,
                    cred != null ? cred.getLabel() : null);
        }).toList();
    }

    /** Phone numbers under this WABA (per Meta's synced snapshot) not yet mapped to a credential. */
    public List<String> listUnmappedPhoneNumbers(Long wabaId) {
        requireAccess(wabaId);
        Waba waba = wabaRepository.findById(wabaId).orElseThrow(() -> new NotFoundException("WABA not found"));
        Long accountId = SecurityContextHelper.getRequiredAccountId();

        var mappedIds = phoneEsmeMappingRepository.findAllByWabaId(wabaId).stream()
                .map(PhoneEsmeMapping::getPhoneNumberId).collect(Collectors.toSet());

        return phoneNumberSnapshotRepository.findAllByAccountId(accountId).stream()
                .filter(s -> waba.getWabaId().equals(s.getWabaId()))
                .map(PhoneNumberSnapshot::getPhoneNumberId)
                .filter(id -> !mappedIds.contains(id))
                .toList();
    }

    /** Every esme_addr credential this account has ever configured (for the "use existing" dropdown). */
    public List<EsmeOption> listEsmeOptions() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return esmeCredentialRepository.findAllByAccountId(accountId).stream()
                .map(c -> new EsmeOption(c.getId(), c.getEsmeAddr(), c.getLabel()))
                .toList();
    }

    public void mapToExistingEsme(Long wabaId, String phoneNumberId, Long esmeCredentialId) {
        requireAccess(wabaId);
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        KarixEsmeCredential credential = esmeCredentialRepository.findById(esmeCredentialId)
                .orElseThrow(() -> new NotFoundException("esme_addr credential not found"));
        if (!credential.getAccountId().equals(accountId)) {
            throw new NotFoundException("esme_addr credential not found");
        }
        saveMapping(wabaId, phoneNumberId, credential.getId());
    }

    /**
     * EL-caught gap (2026-08-07 audit, FIX-035): live-reproduced — a call for
     * an already-mapped phone still persisted the new credential row before
     * failing on the mapping's unique-constraint conflict, leaving an
     * orphaned-but-valid credential that then blocked a retry with "esme_addr
     * already configured" despite having zero mappings. Wrapped so a failed
     * mapping rolls back the credential too.
     */
    @Transactional
    public void mapToNewEsme(Long wabaId, String phoneNumberId, String esmeAddr, String label, String apiKey) {
        requireAccess(wabaId);
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        KarixEsmeCredential credential = KarixEsmeCredential.builder()
                .accountId(accountId)
                .esmeAddr(esmeAddr)
                .label(label)
                .encryptedApiKey(secretEncryptor.encrypt(apiKey))
                .build();
        try {
            credential = esmeCredentialRepository.save(credential);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("This esme_addr is already configured — use the dropdown to reuse it instead.");
        }
        saveMapping(wabaId, phoneNumberId, credential.getId());
    }

    /**
     * PM/EL-caught gap (2026-08-07 audit, FIX-034): no path existed to fix a
     * phone mapped to the wrong esme credential once mapped — mapToNewEsme/
     * mapToExistingEsme both hard-fail with "already mapped" and there was no
     * unmap/update route, which forced a raw, founder-authorized SQL
     * correction during tonight's live debugging. This closes that gap.
     */
    public void remapToExistingEsme(Long wabaId, String phoneNumberId, Long esmeCredentialId) {
        requireAccess(wabaId);
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        KarixEsmeCredential credential = esmeCredentialRepository.findById(esmeCredentialId)
                .orElseThrow(() -> new NotFoundException("esme_addr credential not found"));
        if (!credential.getAccountId().equals(accountId)) {
            throw new NotFoundException("esme_addr credential not found");
        }
        PhoneEsmeMapping mapping = phoneEsmeMappingRepository.findByWabaIdAndPhoneNumberId(wabaId, phoneNumberId)
                .orElseThrow(() -> new NotFoundException("This phone number isn't mapped to a credential yet — use the \"add\" flow instead."));
        mapping.setEsmeCredentialId(credential.getId());
        phoneEsmeMappingRepository.save(mapping);
    }

    private void saveMapping(Long wabaId, String phoneNumberId, Long esmeCredentialId) {
        PhoneEsmeMapping mapping = PhoneEsmeMapping.builder()
                .wabaId(wabaId)
                .phoneNumberId(phoneNumberId)
                .esmeCredentialId(esmeCredentialId)
                .build();
        try {
            phoneEsmeMappingRepository.save(mapping);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("This phone number is already mapped to a credential.");
        }
    }

    private void requireAccess(Long wabaId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        wabaAccessGuard.requireAccess(wabaId, accountId);
    }
}
