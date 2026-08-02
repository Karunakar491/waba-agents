package com.metaagent.platform.common.security;

/**
 * SecurityContextHolder only exists for a real HTTP request thread — every
 * background/scheduled/async call site in this codebase already knows never
 * to call SecurityContextHelper (see PlatformApplication's own async classes'
 * comments). That left every Meta call made from one of those threads
 * logging api_call_log.account_id as NULL — real, complete, but invisible on
 * any account's own Reports > API Calls page, which filters by account_id.
 *
 * This is the deliberate, narrow fix: a plain ThreadLocal a background job
 * sets for the duration of its own work on its own thread, so
 * MetaApiClient.tryGetAccountId() has something to fall back to when
 * SecurityContextHelper (correctly) has nothing. Never read from a request
 * thread — SecurityContextHelper is still the source of truth there.
 */
public class BackgroundCallContext {

    private static final ThreadLocal<Long> ACCOUNT_ID = new ThreadLocal<>();

    public static void set(Long accountId) {
        ACCOUNT_ID.set(accountId);
    }

    public static Long get() {
        return ACCOUNT_ID.get();
    }

    public static void clear() {
        ACCOUNT_ID.remove();
    }
}
