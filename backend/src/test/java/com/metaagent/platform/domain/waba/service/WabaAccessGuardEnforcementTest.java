package com.metaagent.platform.domain.waba.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards against a 9th/10th call site reappearing that bypasses
 * WabaAccessGuard. Per the 2026-08-05 EM architecture-vision audit:
 * existsByWabaIdAndAccountId was hand-copied across 8+ files instead of
 * routed through one primitive — a missed copy is a cross-tenant data
 * leak, not a cosmetic bug. This test is the enforcement EM required
 * alongside the extraction itself, so the fix doesn't silently regress
 * the next time someone needs a WABA-tenant check.
 *
 * Plain source-scan, not ArchUnit — ArchUnit isn't in TECH-STACK.md and
 * this doesn't need a new dependency to catch the violation.
 */
class WabaAccessGuardEnforcementTest {

    private static final String FORBIDDEN_CALL = "wabaAccountAccessRepository.existsByWabaIdAndAccountId";

    // grantAccessIfMissing() in WabaService/WabaAgentReconciliationService is
    // an idempotent-insert check, not an access gate — it decides whether to
    // INSERT a grant, which is exactly what WabaAccessGuard should never be
    // used for. Named here so this test documents the intentional exceptions
    // instead of silently allowing the list to widen.
    private static final String ALLOWED_FILE_SUFFIX =
            "domain" + java.io.File.separator + "waba" + java.io.File.separator + "service" + java.io.File.separator + "WabaAccessGuard.java";
    private static final List<String> ALLOWED_EXISTENCE_CHECK_SUFFIXES = List.of(
            "domain" + java.io.File.separator + "waba" + java.io.File.separator + "service" + java.io.File.separator + "WabaService.java",
            "domain" + java.io.File.separator + "waba" + java.io.File.separator + "service" + java.io.File.separator + "WabaAgentReconciliationService.java"
    );

    @Test
    void should_not_call_repository_directly_when_gating_waba_access() throws IOException {
        Path srcRoot = Paths.get("src/main/java/com/metaagent/platform");
        List<Path> offenders;
        try (Stream<Path> files = Files.walk(srcRoot)) {
            offenders = files
                    .filter(p -> p.toString().endsWith(".java"))
                    .filter(p -> !p.toString().endsWith(ALLOWED_FILE_SUFFIX))
                    .filter(this::containsForbiddenCallOutsideAllowedExistenceCheck)
                    .toList();
        }

        assertTrue(offenders.isEmpty(),
                "These files call wabaAccountAccessRepository.existsByWabaIdAndAccountId directly "
                        + "instead of through WabaAccessGuard.requireAccess(): " + offenders
                        + ". If this is a genuine access gate, route it through WabaAccessGuard. "
                        + "If it's an idempotent-insert existence check (like WabaService.grantAccessIfMissing), "
                        + "add it to ALLOWED_EXISTENCE_CHECK_SUFFIXES with a comment explaining why.");
    }

    private boolean containsForbiddenCallOutsideAllowedExistenceCheck(Path path) {
        try {
            String content = Files.readString(path);
            if (!content.contains(FORBIDDEN_CALL)) {
                return false;
            }
            // grantAccessIfMissing() implementations are the documented
            // existence-check exceptions — everything else calling the
            // forbidden pattern is a real offender.
            return ALLOWED_EXISTENCE_CHECK_SUFFIXES.stream().noneMatch(path.toString()::endsWith);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read " + path, e);
        }
    }
}
