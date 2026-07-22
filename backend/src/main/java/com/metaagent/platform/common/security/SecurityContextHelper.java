package com.metaagent.platform.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityContextHelper {

    public static TenantDetails getTenantDetails() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof TenantDetails) {
            return (TenantDetails) auth.getDetails();
        }
        throw new IllegalStateException("Authentication tenant details not found in SecurityContext");
    }

    public static Long getRequiredAccountId() {
        return getTenantDetails().getAccountId();
    }

    public static Long getRequiredUserId() {
        return getTenantDetails().getUserId();
    }
}
