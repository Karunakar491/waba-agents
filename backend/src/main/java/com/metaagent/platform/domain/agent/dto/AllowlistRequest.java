package com.metaagent.platform.domain.agent.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AllowlistRequest(
    @JsonProperty("consumer_phone_number")
    @NotBlank(message = "consumer_phone_number is required")
    // E.164: leading '+', first digit 1-9, up to 15 digits total (allowlist.md example: +15551234567)
    @Pattern(regexp = "\\+[1-9]\\d{6,14}", message = "consumer_phone_number must be E.164 format, e.g. +15551234567")
    String consumerPhoneNumber
) {}
