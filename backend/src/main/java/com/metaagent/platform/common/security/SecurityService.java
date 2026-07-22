package com.metaagent.platform.common.security;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.user.dto.AuthResponse;
import com.metaagent.platform.domain.user.dto.LoginRequest;
import com.metaagent.platform.domain.user.dto.RegisterRequest;
import com.metaagent.platform.domain.user.entity.BusinessAccount;
import com.metaagent.platform.domain.user.entity.RefreshTokenFamily;
import com.metaagent.platform.domain.user.entity.User;
import com.metaagent.platform.domain.user.repository.BusinessAccountRepository;
import com.metaagent.platform.domain.user.repository.RefreshTokenFamilyRepository;
import com.metaagent.platform.domain.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class SecurityService {

    private final UserRepository userRepository;
    private final BusinessAccountRepository businessAccountRepository;
    private final RefreshTokenFamilyRepository refreshTokenFamilyRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Qualifier("securityRedisTemplate")
    private final StringRedisTemplate redisTemplate;

    @PostConstruct
    void logBcryptCostFactor() {
        log.info("BCrypt encoder active — cost factor 12 (configured in SecurityConfig)");
    }

    private static final String LOCKOUT_KEY_PREFIX = "lockout:";
    private static final String FAIL_COUNT_KEY_PREFIX = "login_fail_count:";
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION_MINUTES = 15;

    private static final int ACCESS_TOKEN_MAX_AGE = 900;      // 15 minutes
    private static final int REFRESH_TOKEN_MAX_AGE = 604800;  // 7 days

    @Transactional
    public void register(RegisterRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new BusinessException("Email already registered");
        }

        String encodedPassword = passwordEncoder.encode(request.password());

        // Create Business Account
        BusinessAccount account = BusinessAccount.builder()
                .name(request.companyName())
                .email(request.email())
                .passwordHash(encodedPassword)
                .build();
        businessAccountRepository.save(account);

        // Create User (Owner of account)
        User user = User.builder()
                .accountId(account.getId())
                .email(request.email())
                .passwordHash(encodedPassword)
                .role(User.Role.owner)
                .status(User.Status.active)
                .build();
        userRepository.save(user);

        log.info("Registered company '{}' with owner '{}'", request.companyName(), request.email());
    }

    @Transactional
    public AuthResponse login(LoginRequest request, HttpServletResponse response) {
        String email = request.email();

        // Check Lockout
        if (isLockedOut(email)) {
            throw new BusinessException("Account is locked out. Please try again after 15 minutes.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    incrementFailedAttempts(email);
                    return new BusinessException("Invalid email or password");
                });

        if (user.getStatus() != User.Status.active) {
            throw new BusinessException("User account is " + user.getStatus());
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            incrementFailedAttempts(email);
            throw new BusinessException("Invalid email or password");
        }

        // Reset fail count on success
        resetFailedAttempts(email);

        // Generate Access Token
        String accessToken = jwtService.generateToken(user.getEmail(), user.getAccountId(), user.getId(), user.getRole().name());

        // Generate Opaque Refresh Token (familyId:tokenValue)
        String familyId = UUID.randomUUID().toString();
        String tokenValue = UUID.randomUUID().toString();
        String refreshToken = familyId + ":" + tokenValue;

        // Hash refresh token for DB persistence
        String tokenHash = hashTokenValue(tokenValue);

        RefreshTokenFamily family = RefreshTokenFamily.builder()
                .familyId(familyId)
                .userId(user.getId())
                .accountId(user.getAccountId())
                .tokenHash(tokenHash)
                .revoked(false)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        refreshTokenFamilyRepository.save(family);

        setAuthCookies(response, accessToken, refreshToken);

        return new AuthResponse(user.getId(), user.getAccountId(), user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse refresh(String refreshToken, HttpServletResponse response) {
        String[] parts = refreshToken.split(":");
        if (parts.length != 2) {
            throw new BusinessException("Invalid refresh token format");
        }

        String familyId = parts[0];
        String tokenValue = parts[1];

        RefreshTokenFamily family = refreshTokenFamilyRepository.findById(familyId)
                .orElseThrow(() -> new NotFoundException("Refresh token family not found"));

        if (family.isRevoked()) {
            throw new BusinessException("Session is revoked");
        }

        if (family.getExpiresAt().isBefore(LocalDateTime.now())) {
            family.setRevoked(true);
            family.setRevokedReason("expired");
            refreshTokenFamilyRepository.save(family);
            throw new BusinessException("Refresh token expired");
        }

        String incomingHash = hashTokenValue(tokenValue);

        // Reuse Detection
        if (!family.getTokenHash().equals(incomingHash)) {
            // Reused old token — revoke the entire family
            family.setRevoked(true);
            family.setRevokedReason("reuse_detected");
            refreshTokenFamilyRepository.save(family);
            log.warn("Reuse detected for refresh token family '{}'. Revoking session.", familyId);
            throw new BusinessException("Token reuse detected. Session revoked.");
        }

        // Active token matched — rotate
        String newTokenValue = UUID.randomUUID().toString();
        String newRefreshToken = familyId + ":" + newTokenValue;
        String newHash = hashTokenValue(newTokenValue);

        family.setTokenHash(newHash);
        refreshTokenFamilyRepository.save(family);

        User user = userRepository.findById(family.getUserId())
                .orElseThrow(() -> new NotFoundException("User not found"));

        String newAccessToken = jwtService.generateToken(user.getEmail(), user.getAccountId(), user.getId(), user.getRole().name());

        setAuthCookies(response, newAccessToken, newRefreshToken);

        return new AuthResponse(user.getId(), user.getAccountId(), user.getEmail(), user.getRole().name());
    }

    @Transactional
    public void logout(String refreshToken, HttpServletResponse response) {
        String[] parts = refreshToken.split(":");
        if (parts.length == 2) {
            String familyId = parts[0];
            refreshTokenFamilyRepository.findById(familyId).ifPresent(family -> {
                family.setRevoked(true);
                family.setRevokedReason("logout");
                refreshTokenFamilyRepository.save(family);
            });
        }
        clearAuthCookies(response);
    }

    // --- Cookie helpers ---

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        response.addHeader("Set-Cookie", buildCookie(
                "access_token", accessToken, ACCESS_TOKEN_MAX_AGE, "/"));
        response.addHeader("Set-Cookie", buildCookie(
                "refresh_token", refreshToken, REFRESH_TOKEN_MAX_AGE, "/api/v1/auth/refresh"));
    }

    private void clearAuthCookies(HttpServletResponse response) {
        response.addHeader("Set-Cookie", buildCookie("access_token", "", 0, "/"));
        response.addHeader("Set-Cookie", buildCookie("refresh_token", "", 0, "/api/v1/auth/refresh"));
    }

    /**
     * Builds a Set-Cookie header value with HttpOnly, Secure, SameSite=Strict.
     * Raw header string used because the Servlet Cookie API has no SameSite support.
     */
    private String buildCookie(String name, String value, int maxAge, String path) {
        return name + "=" + value
                + "; Max-Age=" + maxAge
                + "; Path=" + path
                + "; HttpOnly"
                + "; Secure"
                + "; SameSite=Strict";
    }

    // --- Redis helpers ---

    private boolean isLockedOut(String email) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(LOCKOUT_KEY_PREFIX + email));
    }

    private void incrementFailedAttempts(String email) {
        String failKey = FAIL_COUNT_KEY_PREFIX + email;
        Long count = redisTemplate.opsForValue().increment(failKey);
        if (count == null) {
            redisTemplate.opsForValue().set(failKey, "1", 1, TimeUnit.HOURS);
            return;
        }
        if (count >= MAX_FAILED_ATTEMPTS) {
            redisTemplate.opsForValue().set(LOCKOUT_KEY_PREFIX + email, "locked", LOCKOUT_DURATION_MINUTES, TimeUnit.MINUTES);
            redisTemplate.delete(failKey);
            log.warn("Account '{}' locked out due to {} failed login attempts.", email, MAX_FAILED_ATTEMPTS);
        }
    }

    private void resetFailedAttempts(String email) {
        redisTemplate.delete(FAIL_COUNT_KEY_PREFIX + email);
        redisTemplate.delete(LOCKOUT_KEY_PREFIX + email);
    }

    private String hashTokenValue(String tokenValue) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(tokenValue.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }
}
