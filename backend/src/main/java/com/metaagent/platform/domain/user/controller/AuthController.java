package com.metaagent.platform.domain.user.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityService;
import com.metaagent.platform.domain.user.dto.AuthResponse;
import com.metaagent.platform.domain.user.dto.LoginRequest;
import com.metaagent.platform.domain.user.dto.RegisterRequest;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final SecurityService securityService;

    @PostMapping("/register")
    public ApiResponse<Void> register(@Valid @RequestBody RegisterRequest request) {
        securityService.register(request);
        return ApiResponse.ok();
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response
    ) {
        AuthResponse authResponse = securityService.login(request, response);
        return ApiResponse.ok(authResponse);
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String refreshToken = extractCookie(request, "refresh_token");
        AuthResponse authResponse = securityService.refresh(refreshToken, response);
        return ApiResponse.ok(authResponse);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String refreshToken = extractCookieOrEmpty(request, "refresh_token");
        securityService.logout(refreshToken, response);
        return ApiResponse.ok();
    }

    private String extractCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            throw new com.metaagent.platform.common.exception.BusinessException("Missing cookie: " + name);
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElseThrow(() -> new com.metaagent.platform.common.exception.BusinessException("Missing cookie: " + name));
    }

    private String extractCookieOrEmpty(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return "";
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse("");
    }
}
