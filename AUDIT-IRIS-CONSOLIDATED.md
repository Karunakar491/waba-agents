# Iris + Template Studio — Consolidated Deep-Dive Audit
**Date:** 2026-08-07 | **Requested by:** founder, top-priority follow-up to the general 6-phase audit
**Personas:** PM, EM, UX, Design Evaluator, EL, QA — each ran independently, full detail in:
- `AUDIT-IRIS-PM.md` | `AUDIT-IRIS-EM.md` | `AUDIT-IRIS-UX.md` | `AUDIT-IRIS-DESIGN-EVAL.md` | `AUDIT-IRIS-EL.md` | `AUDIT-IRIS-QA.md`

## Overall verdict
**Design Evaluator: BLOCK** on the Iris chat surface (generic ChatGPT-template look, no signature move, no evidence of design ideation).
**QA: FAIL** (advisory) — one CRITICAL live data-integrity bug in the flagship feature.
Architecture (EM) is sound in shape but **not production-hardened**. Code quality (EL) is solid with two real gaps. This is a strong first version, not yet a production-grade one.

## The 5 most important things, across all six lenses

1. **[CRITICAL, QA] Session-switching cross-talk.** `TemplateIrisPage.tsx:92-118` — switching sessions while a reply is in-flight can render session A's response into session B's chat pane, because `onSuccess` mutates "whatever is currently active" rather than the session the request belongs to. Silent, no error, wrong data shown to the user. Compounds with a second bug: abandoning a pending-confirmation session via sidebar switch permanently strands it with no way back to confirm/cancel (ties to PM's C1 finding — same root cause, found independently by two personas).

2. **[CRITICAL, EM] karix-mcp has no resilience or health monitoring.** Zero circuit breaker/retry on `TemplateStudioClient.java`, re-mints a JWT every call, blocks the request thread on bare timeouts, and has no automated health check wired into monitoring — a single degraded EC2 instance takes down Iris and Template Studio together with nobody notified.

3. **[CRITICAL→live, carried from Phase 5] OpenAiAdapter missing on the server.** The credential form happily accepts "OpenAI" as a BYOK provider; every chat turn then fails at runtime because the code isn't deployed. This is a write/execute mismatch users can hit today — highest-priority redeploy item before anything else in this list.

4. **[CRITICAL, UX] No virtualization, no session pagination, no cancel.** Message list re-parses full markdown per render with no windowing (`IrisChatPane.tsx:96`); the session sidebar renders every session ever created with no pagination (`IrisController.java:27`); and there is no way to abort a pending turn — the composer fully locks, compounding a known open NVIDIA-hang issue. These three compound each other as usage grows.

5. **[HIGH, EL] Iris's tool-calling path bypasses DTO validation.** `IrisConversationService.executeTool()` builds a raw `Map` from model output and calls `TemplateStudioService` directly — skipping the `@Valid TemplateRequest` validation the human UI path enforces. Only defense is system-prompt prose, which the codebase's own doctrine says isn't sufficient. Ties directly to PM's C2 (AUTHENTICATION template OTP-example gap) — the model can walk a user into building templates Meta will reject, with no code-level guardrail catching it.

## Everything else, by severity (see individual files for full evidence/recommendations)

**CRITICAL/HIGH not in the top 5:**
- PM C2 — AUTHENTICATION template OTP `example` field gap in Iris's tool schema (Meta will likely reject the result)
- EM H1-H4 — unbounded conversation history sent every turn, zero rate limiting on Iris/Template Studio endpoints, tool errors never surfaced back to the model (dead-end conversations), non-transactional credential upsert
- UX H1-H6 — no streaming, no memoization (full re-render per keystroke), no regenerate, single-line composer (Shift+Enter structurally impossible), no file/media attach in-chat, `shadow-sm` token violation in shared preview component
- Design Eval HIGH — three different, all-wrong focus-ring tokens across the two features (none use the mandated `brand-purple/40`)
- EL H2 — `AiCredentialService.upsert()` can leave an account with zero AI credentials on a crash mid-swap
- QA HIGH — no client-side axios timeout at all (`api.ts:3-7`) — a hung connection leaves "thinking…" forever with no error path; abandoning a pending-confirmation session strands it permanently

**MEDIUM:** no inline-edit on drafted templates (PM H3), no session/template delete or cross-language duplicate (PM H4), no pre-submit rejection linting (PM M1), Iris can't handle media headers at all (PM M2), client-side-only template search (PM M3), no BYOK cost visibility (PM M4); no idempotency keys on create/send-template (EM), no metrics/instrumentation on the flagship feature (EM), inconsistent hardcoded adapter timeouts (EM/EL); ~95% duplicated code between OpenAI/NVIDIA adapters (EL M1), 2 DB round-trips where 1 would do (EL M3); hardcoded `text-amber-700/400` beside a correctly-tokened line two lines away (Design Eval); no timestamps shown despite backend sending them, no copy/highlight on code blocks, template builder has no step-rail/progress or discard-confirmation (UX); unfilled template variables can submit empty strings to Meta, name collisions collapse into one generic error, no message length limit (QA).

**LOW:** static suggestion chips, missing focus-visible rings on suggestion/send buttons, no `aria-live` on new messages/thinking indicator, latent (not-yet-triggered) missing TSID serializer on `AiProviderCredential.id`, non-atomic multi-save in `sendMessage()`, minor tab-order mismatch in provider settings.

**Confirmed clean / genuinely good — don't touch:**
- `ClaudeApiClient` (wizard-only) is never imported into Iris's production chat path — confirmed by code, not just doc
- No API keys ever logged in any adapter; `SecretEncryptor` correctly uses a fresh random IV per call
- Double-submit guard on `submit()` is intact and still working (prior fix holds)
- Template publish/send confirmation flow is solid — real irreversibility warning, args replayed from persisted state, button disabled during confirm/cancel
- Sidebar-merge-into-navy-rail and `IrisConfirmPanel`'s docked review pane are real, positive design decisions worth keeping as-is

## Recommended sequencing (not yet gated — PM/EM must approve before any Worker starts)
1. Fix session-switching cross-talk + stranded-session bug (#1) — data-integrity bug in the flagship feature, highest priority
2. Redeploy to fix OpenAiAdapter gap (#3) — trivial fix, live user-facing failure
3. karix-mcp resilience: circuit breaker + health check wiring (#2) — EM-owned, needed before scaling either feature further
4. Add DTO validation to Iris's tool-execution path (#5) + fix AUTHENTICATION template schema gap — closes the "Iris can produce a template Meta rejects" risk
5. Iris chat-surface redesign (Design Evaluator's BLOCK) — needs a real Creative Ideation pass, not a patch; treat as a UX/Design-Evaluator-led initiative, not a bug fix
6. Everything else per severity, batched into normal gate sequence
