package com.metaagent.platform.domain.user.dto;

public record AuthResponse(
    Long userId,
    Long accountId,
    String email,
    String role
) {}
