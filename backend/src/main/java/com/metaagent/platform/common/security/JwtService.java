package com.metaagent.platform.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

@Service
public class JwtService {

    private static final long ACCESS_TOKEN_EXPIRY_MILLIS = 15L * 60 * 1000; // 15 minutes

    private final PrivateKey privateKey;
    private final PublicKey publicKey;

    public JwtService(
            @Value("${jwt.private-key-path}") String privateKeyPath,
            @Value("${jwt.public-key-path}") String publicKeyPath
    ) {
        try {
            KeyFactory kf = KeyFactory.getInstance("RSA");

            String privateKeyPem = Files.readString(Path.of(privateKeyPath));
            String privateStripped = privateKeyPem
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] privateBytes = Base64.getDecoder().decode(privateStripped);
            this.privateKey = kf.generatePrivate(new PKCS8EncodedKeySpec(privateBytes));

            String publicKeyPem = Files.readString(Path.of(publicKeyPath));
            String publicStripped = publicKeyPem
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] publicBytes = Base64.getDecoder().decode(publicStripped);
            this.publicKey = kf.generatePublic(new X509EncodedKeySpec(publicBytes));

        } catch (Exception e) {
            throw new IllegalStateException("Failed to load RSA key pair from " + privateKeyPath, e);
        }
    }

    public String generateToken(String username, Long accountId, Long userId, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("accountId", accountId);
        claims.put("userId", userId);
        claims.put("role", role);
        return createToken(claims, username);
    }

    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_EXPIRY_MILLIS))
                .signWith(privateKey)
                .compact();
    }

    public boolean validateToken(String token, String username) {
        final String tokenUsername = extractUsername(token);
        return (tokenUsername.equals(username) && !isTokenExpired(token));
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Optional<Long> extractAccountId(String token) {
        return Optional.ofNullable(extractClaim(token, claims -> {
            Object accountId = claims.get("accountId");
            if (accountId instanceof Number) {
                return ((Number) accountId).longValue();
            }
            return null;
        }));
    }

    public Optional<Long> extractUserId(String token) {
        return Optional.ofNullable(extractClaim(token, claims -> {
            Object userId = claims.get("userId");
            if (userId instanceof Number) {
                return ((Number) userId).longValue();
            }
            return null;
        }));
    }

    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }
}
