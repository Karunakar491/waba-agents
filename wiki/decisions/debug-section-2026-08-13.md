---
title: Debug Nav Section — 2026-08-13
tags: [decision, nav, information-architecture, api-calls, webhooks]
date: 2026-08-13
---

# Debug Nav Section (APIs + Webhooks)

## The ask
Founder: move API Calls and Webhooks out of Reports into a new top-level "Debug" section with two sub-tabs (APIs, Webhooks); remove API Calls from Reports entirely; keep Webhooks available in both Debug and Inbox.

## Why this is a good call, not just reorganizing for its own sake
Reports (Conversations, Eval) is business-metric reporting — the audience is a founder/ops person asking "how's the product doing." API Calls and Webhooks are raw technical logs — the audience is an engineer or support person asking "why did this specific thing fail." Mixing the two in one page's tab bar made Reports read like a debugging tool half the time. There's also direct precedent already in the app: Template Studio has its own `/templates/debug` page (Bug icon), separate from anything metric-shaped — this makes the Agents module consistent with a pattern that already existed, not a new one.

## What shipped
- **`frontend/src/components/debug/ApiCallsLog.tsx`** (new) — the exact API Calls component from Reports, moved verbatim (filters: path preset/search, method, phone number, agent id, outcome, date range).
- **`frontend/src/components/debug/WebhookLogPanel.tsx`** (new) — the exact Webhooks component from Inbox, moved verbatim (filters: phone number, agent id, status, date range). Exported so it can be a real shared component, not copy-pasted — Inbox and Debug both import the same file.
- **`frontend/src/pages/DebugPage.tsx`** (new) — two sub-tabs, APIs and Webhooks, at `/debug`.
- **`ReportsPage.tsx`** — API Calls tab removed entirely (`ReportTab` type narrowed to `'conversations' | 'eval'`); page copy updated to stop mentioning "Meta API activity" since that's Debug's job now. Kept the 2-tab bar rather than collapsing to a single unlabeled view — lower risk, and Conversations/Eval are still two genuinely distinct reports.
- **`InboxPage.tsx`** — local `WebhookLogPanel`/`WebhookRawEntry`/`WEBHOOK_STATUS_TONE`/`WEBHOOK_STATUS_FILTERS` all deleted; now imports the shared component. Behavior unchanged from an operator's perspective — same tab, same filters, same data.
- **Nav**: new "Debug" item (Bug icon, matching Template Studio's existing one) in `AppShell.tsx`, between Reports and WABAs. Route registered in `App.tsx`.

## Verification
- `npm run build` (full `tsc -b && vite build`) — clean, twice (once before deploy, confirming no dead imports from the extraction).
- Deployed to production: frontend dist byte-verified after scp (a transient bastion network hiccup on the first attempt resolved on retry — bastion itself was reachable throughout, confirmed directly), old `/var/www/metaagent` backed up before overwrite, confirmed live via `curl` (`/` and `/debug` both 200; SPA fallback routing intact).
- No backend changes this round — pure frontend reorganization, no migration, no restart needed.

## Related
- [[eight-critical-internal-feedback-items-2026-08-13|Eight Critical Internal-Feedback Items]] — items 2/3/6 (the filters this reorganizes) were built the same day, earlier
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
