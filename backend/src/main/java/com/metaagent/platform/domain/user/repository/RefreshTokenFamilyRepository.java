package com.metaagent.platform.domain.user.repository;

import com.metaagent.platform.domain.user.entity.RefreshTokenFamily;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface RefreshTokenFamilyRepository extends JpaRepository<RefreshTokenFamily, String> {
    Optional<RefreshTokenFamily> findByTokenHash(String tokenHash);
}
