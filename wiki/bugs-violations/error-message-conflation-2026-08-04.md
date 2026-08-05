---
title: ProtectedRoute Error-Message Conflation — 2026-08-04
tags: [bug, frontend, ux, post-mortem]
date: 2026-08-04
---

# ProtectedRoute Conflates "No Modules" With "Fetch Failed"

## What Happened
`ProtectedRoute.tsx` shows the exact same "No features are enabled for this account — Contact your Karix account manager" screen for two completely different situations:

```tsx
const hasAnyModule = entitlements ? Object.values(entitlements).some(Boolean) : false
if (isError || !hasAnyModule) {
  return <ModuleLockedScreen />
}
```

1. **Genuinely zero modules enabled** — the message is correct.
2. **The entitlements fetch itself failed** (`isError`) — e.g. a stale/missing auth cookie, a CORS issue, a network blip. The message is actively misleading here: it tells an operator to contact their account manager when the real problem is "you're not actually logged in" or "the request never reached the server."

## How It Surfaced
During local full-stack testing (see [[../sessions/session-2026-08-04|session log]]), a real account with both modules correctly enabled in the database still showed this screen — because the browser was accessed via a network IP instead of `localhost`, silently dropping the `Secure` login cookie, causing every subsequent request (including entitlements) to 401.

## Fix (not yet applied — flagged for a future task)
Distinguish the two states in `ProtectedRoute.tsx`:
- `isError` → a distinct "couldn't verify your access — try logging in again" screen, possibly with a retry/re-login action.
- `!hasAnyModule` (fetch succeeded, genuinely zero enabled) → keep the current "contact your account manager" copy.

## Related: TSID Serialization Bug (same day, different file)
Not a UX bug but a real correctness one, worth recording alongside: `IrisConversationService.SessionSummary.id` and `TurnResponse.sessionId` were `Long`, serializing 64-bit TSIDs as raw JSON numbers — silently corrupted by JS's `Number.MAX_SAFE_INTEGER` ceiling. The project already has the fix pattern established (`WabaResponse` in `WabaDtos.java` — exposes TSIDs as `String`), but a first EL review pass on the Iris file didn't cross-check against it. **Any new DTO with an entity ID field needs an explicit check against the `WabaResponse` convention — it doesn't happen automatically just because the codebase has a precedent elsewhere.**

## Rule to Remember
> A generic error screen that covers two different root causes will send the next person chasing the wrong one. If a fetch can fail for a reason unrelated to the business state being displayed, show a different message for it — don't let `isError` fall through to the same UI as a real "no access" state.
