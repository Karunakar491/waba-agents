package com.metaagent.platform.domain.persona.dto;

import jakarta.validation.constraints.NotBlank;

public class BusinessProfileDtos {

    public record SaveRequest(
            String paymentMethod,
            String returnPolicy,
            String purchaseInfo,
            String deliveryAndShipping,
            String businessDescription,
            String contactEmail,
            String contactHoursOfOperation,
            String contactAddress
    ) {}

    public record DeployRequest(@NotBlank String phoneNumberId) {}

    public record BusinessProfileResponse(
            String id,
            String status,
            String phoneNumberId,
            String paymentMethod,
            String returnPolicy,
            String purchaseInfo,
            String deliveryAndShipping,
            String businessDescription,
            String contactEmail,
            String contactHoursOfOperation,
            String contactAddress,
            String deployedAt,
            String archivedAt,
            String updatedAt
    ) {}
}
