package com.metaagent.platform.common.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TenantDetails {
    private final Long accountId;
    private final Long userId;
    private final String role;
}
