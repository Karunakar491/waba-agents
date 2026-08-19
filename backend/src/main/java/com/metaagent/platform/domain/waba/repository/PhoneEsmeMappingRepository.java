package com.metaagent.platform.domain.waba.repository;

import com.metaagent.platform.domain.waba.entity.PhoneEsmeMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PhoneEsmeMappingRepository extends JpaRepository<PhoneEsmeMapping, Long> {
    List<PhoneEsmeMapping> findAllByWabaId(Long wabaId);
    Optional<PhoneEsmeMapping> findFirstByWabaIdOrderByIdAsc(Long wabaId);
    Optional<PhoneEsmeMapping> findByWabaIdAndPhoneNumberId(Long wabaId, String phoneNumberId);
}
