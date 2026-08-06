# EM Architecture Audit — Iris + Template Studio

Auditor: Engineering Manager persona
Date: 2026-08-07
Scope: `frontend/src/pages/TemplateIrisPage.tsx` + Iris components, `backend/.../templatestudio/iris/*`, `TemplateStudioService`/`TemplateStudioClient`/`TemplateStudioController`, `karix-mcp/README.md`.

This is an architecture/delivery-risk review only. No code was modified.

---

## Summary Verdict

The core design (BYOK adapter interface, confirm-before-execute tool loop, single-point-of-contact clients) is genuinely sound and shows real engineering discipline — tenant checks, no-raw-key-return, closed enum for providers. It is **not** production-hardened for the two things that matter most for an AI-chat feature at scale: **karix-mcp as a critical-path dependency has zero circuit breaker / retry / health-check integration**, and **there is no resilience layer between the Java backend and any of the three AI providers**. Both are single points of failure with no automatic degradation — a slow or down dependency currently just hangs a chat message up to 60s and then surfaces a generic error. That is tolerable at today's traffic; it will not survive 10x concurrent users without cascading thread-pool/connection-pool exhaustion.

---

## CRITICAL

### C1 — karix-mcp has no circuit breaker, no retry, and is invoked synchronously on the request thread for every template mutation
**Evidence:** `backend/src/main/java/com/metaagent/platform/domain/templatestudio/TemplateStudioClient.java:27-30` (javadoc explicitly states "no circuit breaker (not in TECH-STACK.md, not justified without repeated-incident evidence)"), confirmed no `Resilience4j`/`@CircuitBreaker`/`@Retryable` anywhere in `backend/src/main/java` (repo-wide grep, zero hits).
Every `createTemplate`/`editTemplate`/`listTemplates`/`bulkImport` call mints a fresh JWT (`mintToken`, line 53-78) then makes a second blocking HTTP call — two round trips to karix-mcp per operation, both on the caller's request thread, both with only a bare timeout (connect 5s / read 15s) and no fallback.
karix-mcp is a single EC2 instance behind an ALB (`karix-mcp/README.md:19`, `mcp.karix.online → private EC2 10.1.17.16`) with no documented HA/failover story. If that instance degrades (not down — slow), every Iris create/edit/list template call and every Template Studio CRUD call blocks for up to 15-20s before failing. Under concurrent load this exhausts the Tomcat/webflux request-thread pool, and Iris + the plain Template Studio UI go down together even though they're conceptually separate features sharing one dependency.
**Risk:** karix-mcp being "top priority" per the founder makes this the single dependency most likely to take down both flagship features simultaneously, with no automated mitigation.
**Recommendation:** Add Resilience4j circuit breaker + bounded retry (2 attempts, exponential backoff+jitter) around `TemplateStudioClient`'s calls, per CLAUDE.md's own tech whitelist (Resilience4j is pre-approved). Token minting itself should be cached with a safety margin before the 24h expiry (README confirms tokens last 24h — currently re-minted on every single call, doubling load on karix-mcp for no reason and doubling the failure surface). This is a 2-day task, not a redesign — should not wait for "10x scale," it protects today's traffic.

### C2 — karix-mcp has no health check wired into this platform's readiness signal, and the runbook is entirely manual/SSH-based
**Evidence:** `karix-mcp/README.md:234-244` — the entire "MCP is down" runbook is: curl a health endpoint by hand, SSH via bastion+PEM key, `systemctl restart`, tail logs by hand. No health indicator class exists in the Java backend (confirmed: no `*HealthIndicator*.java` in the repo) that surfaces karix-mcp reachability via Spring's `/actuator/health`, so there is no automated alert when karix-mcp degrades — the first signal is a user complaint.
CLAUDE.md's own EM checklist requires "Every service has /health and /ready" and "Every error path has a corresponding alert rule" (persona-em.md, Operational Requirements table) — karix-mcp technically has a `/health` endpoint, but nothing in *this* platform consumes it proactively.
**Risk:** No SLA, no alerting, no automated detection — an outage is discovered by a founder or customer, not by monitoring. This directly violates the "boring tech that works... every failure path has a corresponding alert rule" bar this persona holds every other integration to (compare: MetaApiClient elsewhere in the codebase has retry+structured error handling; karix-mcp does not get the same treatment despite being equally critical-path).
**Recommendation:** Add a custom Spring `HealthIndicator` that pings karix-mcp `/health` on a schedule and feeds a Prometheus/Grafana alert (already in TECH-STACK per CLAUDE.md's observability line). Document an actual SLA with Karix's ops team for `mcp.karix.online` uptime — currently there is none in writing anywhere in the repo.

### C3 — OpenAiAdapter.java is committed but missing from the live server (known open item, carried forward)
**Evidence:** `backend/src/main/java/com/metaagent/platform/domain/templatestudio/iris/OpenAiAdapter.java` exists and is wired as a `@Component` implementing `AiProviderAdapter`; per the broader Phase-5 audit this class is not present on the deployed server. Since `IrisConversationService` (line 168-171) resolves the adapter by iterating the Spring-injected `List<AiProviderAdapter>` and throws `BusinessException("No adapter available for provider " + cred.provider())` if none match, any account that configures `AiProvider.OPENAI` via `AiCredentialService.upsert()` (which validates against the enum and will happily accept it — `AiCredentialService.java:40-43`) will pass validation on write, then fail every single chat turn in production with a generic 500-shaped error.
**Risk:** Silent data/behavior mismatch between what the credential form allows and what the running server can execute — a customer-facing dead end that looks like a bug in Iris itself, not a deployment gap. This is exactly the "Deployment Sync Gap" pattern already logged in project memory (`project_deployment_status_2026_08_05.md`) — same failure class recurring.
**Recommendation:** Not re-diagnosing; flagging because it is directly in scope. This must close before OpenAI is offered as a provider option in production, and the deploy-sync process (full-tree sync + verification, per existing memory) needs a smoke test that actually exercises each configured adapter, not just a file-copy checklist.

---

## HIGH

### H1 — No token/turn budget or truncation on Iris's conversation history — unbounded context growth per session
**Evidence:** `IrisConversationService.sendMessage` (line 173-175) sends the *entire* `conversationHistory(sessionId)` on every turn, with no cap, no summarization, no sliding window. `IrisSession`/`IrisMessage` are DB-persisted with no message-count or token-count ceiling enforced anywhere in this service or `IrisMessageRepository`.
**Risk:** A long-lived Iris session (a real usage pattern — sessions are resumable, per the sidebar/resume UI in `TemplateIrisPage.tsx`) will grow its request payload every single turn. Eventually this blows past the 1024 `max_tokens` output budget's input-side equivalent, provider context limits, or simply makes every turn slower and more expensive — with zero visibility into which sessions are getting expensive. At 10x users each running longer sessions, this is a real cost and latency landmine, not hypothetical.
**Recommendation:** Cap conversation history sent per turn (sliding window, e.g. last N turns, or token-budgeted truncation with a system-prompt note that older context was trimmed). Needs a decision on product behavior (does Iris "forget" old turns silently, or summarize?) — PM input needed, but EM flags this now because it's a scaling-limit issue, not a UX nicety.

### H2 — No rate limiting anywhere in the Iris or Template Studio API surface
**Evidence:** `IrisController.java` and `TemplateStudioController.java` — every endpoint (`POST /sessions/{id}/messages`, `POST /{wabaId}` create, `POST /{wabaId}/bulk-import`, etc.) has no rate limiter annotation, no bucket, nothing. Iris's `sendMessage` endpoint fans out to an external LLM provider (cost per call) and to karix-mcp (shared capacity) — an account (or a buggy frontend retry loop, or a compromised account) can hammer both with no backpressure.
**Risk:** Directly violates persona-em.md's own non-negotiable ("Every public API has rate limiting. No exceptions.") and is a real cost-control gap: BYOK means the AI spend is the customer's own key, but karix-mcp capacity and this backend's own thread pool are shared infrastructure that one noisy account can degrade for everyone.
**Recommendation:** Add per-account rate limiting on `POST /sessions/{sessionId}/messages` at minimum (token-bucket, e.g. 20/min) before opening this feature more broadly. Same for template-mutation endpoints given karix-mcp's own documented 100/hour per-WABA cap (README line 77) — right now nothing in the Java layer respects or surfaces that cap; a burst of Iris-driven creates could silently start failing at Karix with no clear message to the user about *why*.

### H3 — Tool-loop is single-round-trip by design; a tool execution error becomes an opaque follow-up message, not a model-visible correction
**Evidence:** `IrisConversationService.java` header javadoc (line 34-39) explicitly documents this as an intentional v1 simplification: "Iris does not do a second full model round-trip using... tool_result protocol — the outcome is appended as a plain message." Combined with `executeTool` (line 243-278): if `templateStudioService.createTemplate` throws (karix-mcp 4xx/5xx, network failure), that exception propagates up through `sendMessage` → `confirmPendingAction` and out to the controller as an unhandled exception → generic error to frontend. The model never sees the failure and can't self-correct or explain it in natural language on the next turn — the user gets a raw error banner instead of "that template name is already taken, try a different one."
**Risk:** Documented as an accepted v1 tradeoff, which is fine for now — flagging as HIGH because it directly degrades the *specific* production-AI-chat-quality bar this persona review was asked to check (error handling adequacy for a production AI-chat feature). A karix-mcp validation error becomes a dead-end conversation, not a recoverable one, at exactly the moment (creating/editing a real template) where recoverability matters most.
**Recommendation:** At minimum, catch `TemplateStudioException`/`BusinessException` inside `confirmPendingAction` and persist a TOOL/ASSISTANT message with the human-readable failure reason before rethrowing (or instead of rethrowing) — so the resumed session's history shows *why* it failed, and the next model turn has that context. Full tool_result round-trip loop is legitimately v2 scope; this smaller fix is not.

### H4 — `AiCredentialService.firstCredentialForAccount` "one active provider" invariant is enforced by delete-then-write, not a unique constraint or transaction boundary
**Evidence:** `AiCredentialService.upsert()` (lines 38-61): deletes all rows for the account with a *different* provider (`repository.findAllByAccountId(...).filter(...).forEach(repository::delete)`), then saves/updates the new one — as two separate non-atomic steps, no `@Transactional` on the method, no explicit transaction demarcation visible in this class.
**Risk:** If the process crashes or the DB connection drops between the delete loop and the save, an account can be left with **zero** AI credentials configured (not wrong, but a silent-until-next-chat outage for that account) or, in a race between two concurrent upsert calls, both could pass the "no active credential" check and attempt inserts, hitting the `DataIntegrityViolationException` catch (line 58) that surfaces as a generic "already configured" — misleading if the actual cause was a lost update, not a genuine duplicate submission.
**Recommendation:** Wrap `upsert()` in `@Transactional`. This is a 1-line annotation with real correctness benefit — should not wait for a scaling milestone.

---

## MEDIUM

### M1 — `TemplateStudioService.resolveCredential` "pick first mapping" is a documented pragmatic default with no monitoring for when it's wrong
**Evidence:** `TemplateStudioService.java:99-106` javadoc: "picks the first mapping found (2026-08-04, pragmatic default per founder... revisit if real Karix behavior ever shows the choice matters)." No metric or log line captures *which* mapping was picked or flags accounts with multiple phone-to-esme mappings under one WABA where this ambiguity could bite.
**Recommendation:** Not urgent to fix the selection logic (founder already made this call), but add a debug/info log of which esme_addr was selected per call so a future "wrong credential used" bug report is diagnosable instead of a mystery. Low cost, meaningful payoff.

### M2 — No idempotency key on `create_template`/`send_test_template`, both real mutating, cost-bearing, side-effecting operations
**Evidence:** `IrisController.java` `sendMessage`/`confirm` endpoints and `TemplateStudioController.createTemplate` — no `Idempotency-Key` header handling anywhere. A frontend double-click, a network retry, or (more specifically to Iris) `TemplateIrisPage.tsx`'s `confirmAction` mutation firing twice due to a slow response and impatient re-click could submit the same template creation or the same test WhatsApp send twice.
**Note:** Project memory (`feedback_mutation_success_unmount_race.md`) already documents a related double-fire risk class in this exact codebase's mutation-handling pattern, and `project_iris_stuck_thinking_2026_08_05.md` confirms a real double-send race was previously found in this same file. The frontend has a same-tick pending guard now (`sendMessage.isPending`), but that protects the *chat send*, not the confirm/send-test-template action specifically — `confirmAction.isPending` is passed to the panel as a `confirming` prop for UI disabling only, not a hard guard inside the mutation itself.
**Recommendation:** Add server-side idempotency keys for `create_template` and `send_test_template` at minimum — these are the two operations with real-world irreversible or costly side effects (a submitted template goes to Meta for approval; a test send costs a real WhatsApp message).

### M3 — `IrisConversationService` and adapters have no metrics (latency, error rate, tokens) despite CLAUDE.md mandating Prometheus/Grafana observability for every endpoint
**Evidence:** No `Timer`/`Counter`/Micrometer usage anywhere in `IrisConversationService.java`, `ClaudeAdapter.java`, `OpenAiAdapter.java`, `NvidiaLlamaAdapter.java`. Errors are `log.error`'d per-adapter but there is no structured metric for "AI turn failed," "AI turn latency," or "AI provider X error rate" that could back an alert rule.
**Recommendation:** Instrument each adapter's `converse()` call with a Micrometer `Timer` (latency) and success/failure `Counter` tagged by provider — this is exactly the kind of data needed to know, for the founder's stated top-priority feature, whether it's actually healthy in production, and to set a real alert threshold instead of finding out from a user.

### M4 — Adapter timeout values are inconsistent and undocumented as a considered decision, not obviously wrong but worth a single pass
**Evidence:** `ClaudeAdapter`: connect 5s / read 30s. `OpenAiAdapter`: connect 10s / read 60s. `NvidiaLlamaAdapter`: connect 10s / read 60s (with a code comment explaining the 60s choice). `KarixMessagingClient`: connect 5s / read 15s. `TemplateStudioClient`: connect 5s / read 15s. The NVIDIA/OpenAI 60s read timeout is commented as deliberate; Claude's 30s is not commented at all, and nothing indicates whether Claude was measured to actually need less time or just inherited an earlier default.
**Recommendation:** Not a defect, but worth a short pass to confirm Claude's 30s is still correct now that OpenAI/NVIDIA both settled on 60s for the same category of workload (tool-calling turn) — inconsistency without a stated reason is a future "why is this different" question for whoever touches it next.

---

## LOW

### L1 — `@SneakyThrows` on `writeJson`/`readJson` in `IrisConversationService` swallows JSON errors as unchecked exceptions with no context
**Evidence:** `IrisConversationService.java:316-325`. A malformed `pendingToolArgsJson` (e.g. from a future schema change or DB corruption) would throw a raw `JsonProcessingException` wrapped by Lombok with no added context about which session/tool was being processed.
**Recommendation:** Low priority — wrap with a try/catch that logs `sessionId`/`toolName` before rethrowing as `BusinessException`, next time this file is touched for another reason. Not worth a standalone task.

### L2 — `KarixMessagingClient.sendTestTemplate`'s OTP/AUTHENTICATION parameter mapping is explicitly unverified against a live account
**Evidence:** `KarixMessagingClient.java:72-80` javadoc: "needs live-Meta-account validation: no test WABA with an approved AUTHENTICATION template exists yet to confirm this against a real send." Already self-flagged in the code, not hidden.
**Recommendation:** Track as a known test gap, not a code defect — needs a real AUTHENTICATION-category approved template to validate end-to-end before this path is considered done for that category.

---

## Answers to the Specific EM Questions Asked

**Is the architecture sound for scaling to more providers/concurrent users?**
For *providers*: yes — the `AiProviderAdapter` interface (`AiProviderAdapter.java`) is a clean, minimal seam; adding a 4th provider is "write and test one adapter," not a loop rewrite, as its own javadoc claims and the evidence (3 adapters now, near-identical shape) supports. For *concurrent users*: no, not yet — C1/C2/H2 (no circuit breaker, no rate limiting, no karix-mcp health signal) mean load concentrates unmitigated on a single external dependency and a single request-thread-blocking pattern. This is a "will not survive 10x" per persona-em's own Q4 test until C1/H2 are fixed.

**Where are the tech-debt landmines?**
C3 (OpenAI adapter deploy gap) is live today, not hypothetical. H1 (unbounded conversation history) is the next one to detonate as usage grows. H4 (non-transactional credential upsert) is a correctness landmine, not a scale one.

**Is error handling/observability adequate for production AI chat (timeouts, retries, streaming)?**
Timeouts: present but inconsistent (M4), no retries anywhere (C1), no streaming at all (confirmed — all three adapters make one blocking synchronous call and return a complete response; there is no SSE/streaming response path in `IrisController` or the frontend, so "streaming failure" as a category doesn't apply yet, but note this also means the user sees nothing for up to 60s on a slow NVIDIA/OpenAI call. That is itself a UX/observability gap worth flagging to PM/UX even though it's not this review's lane). Observability: inadequate — M3, no metrics on the feature the founder just called top priority.

**Is karix-mcp's role as critical-path dependency properly hardened?**
No. C1 + C2 are direct findings against this exact question. No circuit breaker, no health check wired into this platform, no documented SLA, a fully manual SSH-based runbook.

**Any @Async/@Transactional/self-invocation risks specific to these modules?**
No `@Async` usage found in these modules at all (confirmed by reading every file in scope — all calls are synchronous). The one `@Transactional` gap found is H4 (missing, should be present) on `AiCredentialService.upsert()`. No self-invocation risk pattern found (no internal `this.someTransactionalMethod()` calls within these classes) — this specific bug class, common elsewhere in Spring codebases, is not present here.

---

## Priority Order For The Founder

1. **C1** — circuit breaker + retry + token caching on karix-mcp calls (protects both Iris and plain Template Studio simultaneously)
2. **C3** — resolve OpenAI adapter deploy gap or disable the OPENAI option in the credential form until it's confirmed live
3. **C2** — wire karix-mcp health into this platform's monitoring + get a written SLA from Karix ops
4. **H2** — rate limiting on `sendMessage` and template-mutation endpoints
5. **H4** — `@Transactional` on credential upsert (1-line fix, real correctness win)
6. Everything else can follow in normal sprint cadence — none of H1/H3/M1-M4/L1-L2 are "the app breaks tomorrow" risks, but H1 (unbounded history) will become one as session lifetimes grow.
