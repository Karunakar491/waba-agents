package com.metaagent.platform.domain.iris;

/**
 * The two live HTTP prefixes for Iris, shared between {@link IrisController}'s
 * {@code @RequestMapping} and {@link com.metaagent.platform.common.security.ModuleAccessFilter}'s
 * module gate so the two can't silently drift apart (2026-08-18, EL-caught gap:
 * previously each hardcoded its own copy of these two literals). Both paths
 * must stay gated identically until LEGACY is removed after both frontend
 * callers cut over to NEW and a full deprecation window passes with
 * verified-zero traffic — see wiki/decisions/2026-08-12-iris-generalization-plan.md.
 */
public final class IrisPaths {

    public static final String NEW_PREFIX = "/api/v1/iris";
    public static final String LEGACY_PREFIX = "/api/v1/templates/iris";

    private IrisPaths() {}
}
