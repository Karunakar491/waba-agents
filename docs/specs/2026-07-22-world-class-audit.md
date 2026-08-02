# World-Class Product Audit — 2026-07-22

**Trigger:** Founder asked for a full evaluation of the product against a world-class bar.
**Method:** Ground-truth codebase survey, then four independent cold-persona reviews (PM, UX, Design Evaluator, EM), run in parallel with no cross-visibility.

## Reframe (read this first)

Mid-conversation, the founder corrected a load-bearing assumption every persona and DESIGN.md §0 currently encodes: **the user is not a stressed, first-time, non-technical business owner.** This product is an **internal operator console** — Karix employees, each managing a handful (<10) of client WABAs, using the tool for hours every day across three recurring jobs: build new agents, maintain/edit live ones, monitor conversations. No external competitor benchmark; the bar is general best-in-class SaaS (Linear/Stripe/Vercel), applied to a power tool, not a signup funnel.

**All four reviews converged on the same root cause independently**, without seeing each other's output: the product's information architecture and design mood are calibrated for a one-time consumer onboarding moment, not for daily-driver operator work. That convergence is itself the strongest signal in this audit.

---

## Findings, ranked

### 1. No client-switching mechanism exists anywhere (Critical — PM + UX + Design Evaluator all flagged this independently)
The nav (`AppShell.tsx`) is one flat global list — Agents / WABAs / Inbox / Human Handover / Profile. There is no concept of "client" as a first-class object: no switcher, no search, no recents, no "which account am I in right now" indicator in the topbar. For someone jumping between clients all day, this isn't a missing convenience — the Design Evaluator called it "a real risk of wrong-client action," not just a polish gap.
**Direction:** a client/account switcher in the topbar (search + recents), and a portfolio-style landing view — "3 agents need FAQ updates, 1 has a stuck conversation" — instead of a flat agent list.

### 2. No test-before-deploy step (Critical — PM)
Meta documents a test-agent API; nothing in the frontend or backend wires up to it. Every edit to a live agent — including routine FAQ maintenance — ships straight to a real client's real customers with no rehearsal. This is the single missing piece in an otherwise fully-proven P0 journey (signup → WABA connect → create → deploy all work end-to-end).
**Open question for founder:** when someone edits FAQs on an already-live agent, should that require re-test before going live, or ship immediately? This determines whether the fix is a one-time gate or a recurring one.

### 3. Inbox has zero triage/monitoring affordances (Critical — UX + Design Evaluator)
Read-only is a reasonable scope cut (Meta's AI handles replies natively). But there's no filter by agent/client/status, no search, no unread/needs-attention indicator, no way to flag a conversation for follow-up. For the "monitor" job-to-be-done across multiple clients, this doesn't scale past a handful of rows.

### 4. Webhook signature verification silently disables itself (Critical, security — EM, found independently of the design findings)
`WebhookController.java` implements real HMAC-SHA256 verification correctly — but if `meta.webhook.app-secret` is unset (it defaults to empty string), the check is skipped entirely and unsigned payloads are accepted with just a log warning. TASKS.md still shows this as `[ ] TODO` even though the code exists, meaning **nobody has verified whether the secret is actually set in the deployed environment.** If it isn't, the exact risk this task was meant to close is open right now, silently.
**Fix:** fail fast at startup if the secret is missing — don't allow a silent runtime degrade. Reconcile against the deployed env immediately, independent of any other roadmap decision.

### 5. Fabricated Settings UI (High — UX)
Hardcoded "Starter — Active" plan badge and a "Manage billing" link that does nothing (`preventDefault()`) — worse than an honest "Coming soon" state, because it looks real until someone clicks it. Will read as broken in any internal demo.

### 6. Tenant isolation is correct but enforced by convention, not structure (High — EM)
Where checked, isolation is done right (`findByIdAndAccountId` fail-closed pattern). But it's per-method discipline, not a shared base repository or Hibernate filter. Fine with one engineer; becomes the exact bug class from TASK-009/TASK-033 again the moment a second person writes a new service without copying the idiom.

### 7. No timeout/resilience on outbound Meta API calls (Medium — EM)
Only the Claude wizard-time client has connect/read timeouts configured; `MetaApiClient` (send, deploy, pause) has none. If Meta's API hangs, the synchronous deploy/pause path can block indefinitely.

### 8. Design mood mismatch, not a generic-template problem (Medium — Design Evaluator, PASS but not rubber-stamped)
Craft is genuinely good — the wordmark, brand-token discipline, and live WhatsApp preview in the wizard would hold up next to Linear or Stripe, not a template marketplace. The gap isn't quality, it's calibration: the 5-step wizard's onboarding cadence, reassurance copy, and lack of any expert/keyboard/duplicate-agent shortcut are right for a first-time SMB owner and wrong for an operator building agent #40 this week. Same root cause as finding #1.

### 9. Docs/code drift is a process gap, not just an inconvenience (Medium — EM)
TASKS.md and knowledge-index.json disagree on status for several tasks (023, 027–032), and finding #4 is a direct consequence — code shipped ahead of its own tracking. Tolerable today because one person can hold the discrepancy in their head; stops being tolerable the moment a second engineer trusts the doc instead of grepping.

### 10. TASK-034 (hardcoded secret defaults in application.yml) — real but not urgent (Low-medium — EM)
Not an active exploit path, but violates the project's own no-default-secrets rule and blocks any "production-ready" claim. Small fix (~30 min): remove defaults, fail fast on missing env vars.

---

## What NOT to build next (ruled out explicitly)
- A full multi-tenant permissions/roles system — no evidence yet that client ownership is shared/handed off between staff; confirm with founder before building (see open question below).
- CI pipeline — real gap, but lower priority than reconciling docs/code drift and closing the webhook secret risk; the manual maker-checker process is actually being followed today.
- Resilience4j / circuit breakers — over-engineering at current scale; a bounded timeout on `MetaApiClient` is the correctly-scoped fix.

## Open questions for the founder
1. Is a client WABA exclusively owned by one internal user, or shared/handed off between staff? Determines whether Settings' missing permission model is P0 or irrelevant.
2. Does editing FAQs on a live agent need a re-test/re-approve gate, or can it ship immediately? Determines the scope of the test-before-deploy fix.
3. Is the portfolio/at-a-glance dashboard (finding #1) a felt daily pain already, or is client count low enough (<10) that a faster client-switcher alone would resolve it without a bigger dashboard rebuild?
4. Should DESIGN.md §0's mood target be revised from "stressed first-time consumer" to "daily-driver operator," or should the two highest-frequency screens (Agents list, Inbox) get a denser "operator mode" variant while onboarding-adjacent screens (wizard) keep the current pacing?

## Recommended sequencing (not yet approved — needs PM/EM consensus before any gate opens)
1. **Immediate, independent of roadmap:** verify `META_WEBHOOK_APP_SECRET` is set in production; make missing-secret fail-fast at startup (finding #4).
2. **Next P0 bet:** Test Agent (sandbox conversation pre-deploy) — bounded scope, Meta API already documented, closes the highest-consequence gap in an otherwise-complete journey (finding #2).
3. **Following bet, pending founder answers above:** client-switcher + portfolio view (finding #1) and Inbox triage affordances (finding #3) — likely one IA workstream, not two.
4. **Cleanup, low effort:** TASK-034 secret defaults, TASKS.md/index reconciliation, Settings fabricated-UI removal.
