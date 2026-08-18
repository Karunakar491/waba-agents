package com.metaagent.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.iris.IrisPaths;
import com.metaagent.platform.domain.user.entity.AccountModule;
import com.metaagent.platform.domain.user.service.AccountModuleService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Runs after JwtAuthFilter — gates every authenticated API call on the
 * account's entitlement for WHICHEVER module owns that path (see
 * requiredModule()). Auth, webhook, health, and the entitlements-read
 * endpoint itself are exempt: a disabled account must still be able to log
 * in, log out, and see WHY the rest of the app is locked. Fails closed on
 * any error resolving tenant details — an unauthenticated/malformed
 * request is SecurityConfig's problem, not this filter's, so it lets those
 * pass through untouched.
 *
 * 2026-08-04: this used to hardcode BUSINESS_AGENTS for the entire
 * /api/v1/** surface — a Template-Studio-only account (no BUSINESS_AGENTS)
 * would have been wrongly blocked from Template Studio's own endpoints.
 * Fixed to be path-aware.
 *
 * 2026-08-18: Iris (/api/v1/templates/iris/** and, as of the same day,
 * /api/v1/iris/** — IrisController now answers both while its frontend
 * callers migrate) is a shared assistant used by both Template Studio's own
 * chat UI AND the Business Agents "Create Agent" wizard rail — the latter
 * was getting wrongly 403'd because it fell under the general
 * /api/v1/templates/** prefix, which requires TEMPLATE_STUDIO only. Both
 * Iris paths are special-cased ahead of the general prefix rule to accept
 * EITHER module, matching that it's genuinely shared, not Template-Studio-
 * owned. Both paths MUST stay on the identical OR-check until the old
 * /api/v1/templates/iris path is removed (see ModuleAccessFilterTest).
 */
@Component
@RequiredArgsConstructor
@Slf4j
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

        Long accountId = tenantDetails.getAccountId();
        if (!isAllowed(accountId, path)) {
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

    /** Path-prefix routing to the module(s) that own it. Iris is checked
     * first since it's a shared path (today reachable at two prefixes mid-
     * migration) not exclusively Template Studio's — everything else falls
     * through to the general prefix rule. Add a case here for every NEW
     * shared or module-specific endpoint prefix; anything unmatched still
     * defaults to BUSINESS_AGENTS (the whole rest of the platform). */
    private boolean isAllowed(Long accountId, String path) {
        if (isIrisPath(path)) {
            boolean allowed = accountModuleService.isEnabled(accountId, AccountModule.Module.TEMPLATE_STUDIO)
                    || accountModuleService.isEnabled(accountId, AccountModule.Module.BUSINESS_AGENTS);
            if (allowed) {
                log.info("Iris access granted for accountId={} path={}", accountId, path);
            }
            return allowed;
        }
        if (path.equals("/api/v1/templates") || path.startsWith("/api/v1/templates/")) {
            return accountModuleService.isEnabled(accountId, AccountModule.Module.TEMPLATE_STUDIO);
        }
        return accountModuleService.isEnabled(accountId, AccountModule.Module.BUSINESS_AGENTS);
    }

    /** True for either of Iris's two live paths — shared constants with
     * IrisController's @RequestMapping so the two can't silently drift
     * apart (2026-08-18, EL-caught gap: each used to hardcode its own copy
     * of these literals). */
    private boolean isIrisPath(String path) {
        return path.equals(IrisPaths.NEW_PREFIX) || path.startsWith(IrisPaths.NEW_PREFIX + "/")
                || path.equals(IrisPaths.LEGACY_PREFIX) || path.startsWith(IrisPaths.LEGACY_PREFIX + "/");
    }
}
