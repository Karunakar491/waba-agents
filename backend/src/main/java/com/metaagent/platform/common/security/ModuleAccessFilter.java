package com.metaagent.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.user.entity.AccountModule;
import com.metaagent.platform.domain.user.service.AccountModuleService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Runs after JwtAuthFilter — gates every authenticated API call on the
 * account's BUSINESS_AGENTS entitlement (AccountModule). Auth, webhook,
 * health, and the entitlements-read endpoint itself are exempt: a disabled
 * account must still be able to log in, log out, and see WHY the rest of
 * the app is locked. Fails closed on any error resolving tenant details —
 * an unauthenticated/malformed request is SecurityConfig's problem, not
 * this filter's, so it lets those pass through untouched.
 */
@Component
@RequiredArgsConstructor
public class ModuleAccessFilter extends OncePerRequestFilter {

    private final AccountModuleService accountModuleService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getServletPath();
        if (isExempt(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth != null && auth.getDetails() instanceof TenantDetails tenantDetails)) {
            // Unauthenticated — SecurityConfig's AuthorizationFilter rejects this next.
            filterChain.doFilter(request, response);
            return;
        }

        if (!accountModuleService.isEnabled(tenantDetails.getAccountId(), AccountModule.Module.BUSINESS_AGENTS)) {
            response.setStatus(403);
            response.setContentType("application/json");
            objectMapper.writeValue(response.getWriter(),
                    ApiResponse.error("This module is not enabled for your account."));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isExempt(String path) {
        return path.startsWith("/api/v1/auth/")
                || path.startsWith("/api/v1/webhook/")
                || path.equals("/api/v1/modules/entitlements")
                || path.startsWith("/actuator/");
    }
}
