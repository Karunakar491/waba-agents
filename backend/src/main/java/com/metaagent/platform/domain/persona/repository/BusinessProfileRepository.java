package com.metaagent.platform.domain.persona.repository;

import com.metaagent.platform.domain.persona.entity.BusinessProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BusinessProfileRepository extends JpaRepository<BusinessProfile, Long> {

    List<BusinessProfile> findAllByAccountIdAndStatus(Long accountId, BusinessProfile.Status status);

    Optional<BusinessProfile> findByIdAndAccountId(Long id, Long accountId);

    Optional<BusinessProfile> findByPhoneNumberIdAndStatus(String phoneNumberId, BusinessProfile.Status status);

    List<BusinessProfile> findAllByPhoneNumberIdInAndStatus(List<String> phoneNumberIds, BusinessProfile.Status status);

    List<BusinessProfile> findAllByPhoneNumberIdAndStatusOrderByArchivedAtDesc(String phoneNumberId, BusinessProfile.Status status);
}
