package com.metaagent.platform.domain.businessevent.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The shapes a customer's number actually arrives in, taken from the production
 * conversation table on 2026-09-25 — 44 bare 12-digit rows, 3 with no country
 * code, 1 empty. Every case below is a row that exists, not an invented one.
 *
 * <p>Plain JUnit on purpose: no Spring context, no Testcontainers. This class
 * has no dependencies, and the integration suite cannot run on a modern Docker
 * daemon anyway.
 */
class PhoneKeyTest {

    @Test
    @DisplayName("a bare number, the 44-row majority case, survives normalisation and is sendable")
    void bareNumberIsUnchangedAndSendable() {
        String digits = PhoneKey.normalize("918500996740");

        assertThat(digits).isEqualTo("918500996740");
        assertThat(PhoneKey.isSendable(digits)).isTrue();
    }

    @Test
    @DisplayName("a leading + is stripped")
    void stripsLeadingPlus() {
        assertThat(PhoneKey.normalize("+918500996740")).isEqualTo("918500996740");
    }

    @Test
    @DisplayName("spaces and hyphens normalise to the same digits as the bare form")
    void separatorsDoNotMatter() {
        String spaced = PhoneKey.normalize("+91 85009 96740");
        String hyphenated = PhoneKey.normalize("+91-85009-96740");

        assertThat(spaced).isEqualTo("918500996740");
        assertThat(hyphenated).isEqualTo(spaced);
    }

    @Test
    @DisplayName("parentheses are stripped too")
    void stripsParentheses() {
        assertThat(PhoneKey.normalize("+91 (850) 099-6740")).isEqualTo("918500996740");
    }

    @Test
    @DisplayName("the 10-digit rows normalise fine but cannot be sent to — the country is not ours to guess")
    void noCountryCodeIsNotSendable() {
        String digits = PhoneKey.normalize("8500996740");

        assertThat(digits).isEqualTo("8500996740");
        assertThat(PhoneKey.isSendable(digits)).isFalse();
    }

    @Test
    @DisplayName("the empty row and a null are handled and not sendable")
    void blankAndNullAreSafe() {
        assertThat(PhoneKey.normalize("")).isEmpty();
        assertThat(PhoneKey.normalize(null)).isEmpty();
        assertThat(PhoneKey.normalize("   ")).isEmpty();

        assertThat(PhoneKey.isSendable("")).isFalse();
        assertThat(PhoneKey.isSendable(null)).isFalse();
        assertThat(PhoneKey.isSendable("   ")).isFalse();
    }

    @Test
    @DisplayName("toE164 round-trips a normalised number back to the form Meta wants")
    void toE164RoundTrips() {
        String digits = PhoneKey.normalize("+91 85009 96740");

        assertThat(PhoneKey.toE164(digits)).isEqualTo("+918500996740");
        assertThat(PhoneKey.normalize(PhoneKey.toE164(digits))).isEqualTo(digits);
    }

    @Test
    @DisplayName("toE164 of blank is blank, never a lone plus sign")
    void toE164OfBlankIsBlank() {
        assertThat(PhoneKey.toE164("")).isEmpty();
        assertThat(PhoneKey.toE164(null)).isEmpty();
        assertThat(PhoneKey.toE164("   ")).isEmpty();
    }

    @Test
    @DisplayName("a leading zero is kept — stripping it would change which number we call")
    void keepsLeadingZeros() {
        assertThat(PhoneKey.normalize("0918500996740")).isEqualTo("0918500996740");
    }
}
