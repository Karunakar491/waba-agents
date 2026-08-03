package com.metaagent.platform.domain.user.controller;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.user.entity.AccountModule;
import com.metaagent.platform.domain.user.service.AccountModuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Single source of truth for module entitlements — the frontend's nav/route
 * gating and the backend's ModuleAccessFilter both derive from this same
 * account-scoped data, so they can never drift.
 */
@RestController
@RequestMapping("/api/v1/modules")
@RequiredArgsConstructor
public class AccountModuleController {

    private final AccountModuleService accountModuleService;

    @GetMapping("/entitlements")
    public ApiResponse<Map<AccountModule.Module, Boolean>> getEntitlements() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return ApiResponse.ok(accountModuleService.getEntitlements(accountId));
    }
}
