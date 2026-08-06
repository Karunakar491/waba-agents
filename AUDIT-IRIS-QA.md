# QA Audit — Iris + Template Studio (code-level trace)

**Scope:** `frontend/src/pages/TemplateIrisPage.tsx`, `IrisChatPane.tsx`, `IrisConfirmPanel.tsx`, `TemplateStudioPage.tsx`, `TemplateBuilderForm.tsx`, `useTemplateBuilder.ts`, and the backend services/adapters they call (`IrisConversationService`, `ClaudeAdapter`/`NvidiaLlamaAdapter`/`OpenAiAdapter`, `TemplateStudioClient`, `TemplateStudioService`).
**Method:** Static code trace only. No live/Selenium testing (separate Phase 6 pass covers that). Advisory per QA.md — does not block commit, no code was modified.
**Date:** 2026-08-07

---

## Q1 — AI provider timeout / 500 mid-conversation

**Backend:** Each adapter (`ClaudeAdapter.java:33-34`, `NvidiaLlamaAdapter.java:44-49`, `OpenAiAdapter.java:43-44`) sets explicit connect/read timeouts (5-10s connect, 30-60s read) and wraps every provider call in try/catch that converts *any* failure (timeout, DNS, 5xx) into a `BusinessException` with a user-facing message ("Could not reach Claude — try again in a moment.", `ClaudeAdapter.java:73-78`). `GlobalExceptionHandler.java:21-24` maps `BusinessException` to HTTP 400 with that message intact. Frontend `sendMessage.onError` (`TemplateIrisPage.tsx:154-157`) reads it via `extractErrorMessage` and marks the specific chat entry `status:'error'` with a visible Retry button (`IrisChatPane.tsx:112-124`). **This path is handled correctly** — no infinite "thinking."

- **[LOW] [EDGE_CASE]** `ClaudeAdapter.java:69-71` — non-2xx errors from Claude surface as the raw string `"Claude API error: " + resp.getStatusCode()` (e.g. "Claude API error: 400 BAD_REQUEST") instead of a friendly message. Every *connectivity* failure gets a good message, but an actual 4xx from the provider (e.g. invalid API key mid-conversation, oversized request) shows a technical string to a non-technical user. Same pattern in `NvidiaLlamaAdapter.java:95-97` and `OpenAiAdapter.java:87-89`.
  Fix: catch the `onStatus` branch's thrown exception one level up (or change `onStatus` itself) and rewrap with a plain-language message, keeping the raw status server-side in logs only.

- **[HIGH] [EDGE_CASE]** Client-side, `frontend/src/lib/api.ts:3-7` — the shared axios instance has **no `timeout` configured** (axios default is `0` = never times out). Backend read timeouts (30-60s) only protect the *backend→provider* leg. If the *browser→backend* leg hangs — dropped connection, backend process killed mid-request, a proxy/load balancer that swallows the connection instead of resetting it — the frontend's `sendMessage` promise never resolves or rejects. `sendMessage.isPending` stays `true` forever, so "Iris is thinking…" (`IrisChatPane.tsx:139-141`) renders indefinitely with no retry option (Retry only appears on `status:'error'`, which requires `onError` to actually fire). The only recovery is a full page reload.
  Fix: set a client-side timeout (e.g. 65s, just above the longest backend read timeout) on the axios instance or per-call, and ensure `onError` fires on `ECONNABORTED` so the existing error/retry UI activates.

---

## Q2 — Double-submit / rapid Enter (verify prior fix still in place)

Confirmed still in place and complete. `TemplateIrisPage.tsx:201-209`:
```
function submit(text?: string) {
  const value = (text ?? input).trim()
  if (!value || pending || sendMessage.isPending) return
  ...
}
```
Guards on both `pending` (awaiting confirmation) and `sendMessage.isPending` (in-flight). `Composer`'s `onKeyDown` (`IrisChatPane.tsx:172`) and send button (`disabled={!input.trim() || pending || disabled}`, line 179) both route through this same `submit`/`onSubmit`. Each `keydown` is a separate discrete React event, so state flushes between events — a human mashing Enter cannot get two `mutate()` calls in flight. **No regression found.**

- **[LOW] [EDGE_CASE]** `TemplateIrisPage.tsx:135-141` — `sendMessage.mutationFn` does `if (!sid) sid = await startSession.mutateAsync()`. If a user is on a brand-new chat (`sessionId === null`) and manages to fire two sends in the same tick (not reachable via the UI guard above, but reachable if `sendEntry`/`retry` were ever called from a second code path), two `startSession` calls could race and create two sessions, with the second message landing in a different session than the first. Not currently exploitable through the UI — flagging as a latent trap for future callers of `sendEntry`.

---

## Q3 — Unfilled template variable / name collision

**Unfilled variable — not blocked client-side.** `useTemplateBuilder.ts:164-169`:
```
const canSubmit = nameOk && bodyLenOk
  && (isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)
  && (!isEdit || seeded) && !submitMutation.isPending
```
`canSubmit` never checks that every variable found by `extractVariables(bodyText)` has a non-empty `bodyExamples[v]`. `BodyEditor` (`TemplateBuilderForm.tsx:236-247`) renders an input per variable with placeholder text "Example value (required by Meta)" but this is a *hint*, not a validation — an empty value is accepted. `buildComponents()` (`useTemplateBuilder.ts:119-123`) then submits `bodyExamples[v] || ''`, i.e. an empty string, to Meta via `TemplateStudioService.createTemplate` → `TemplateStudioClient.createTemplate` (`TemplateStudioClient.java:83-96`). Whatever Meta/Karix does with a blank example is opaque to the operator until the generic failure message appears.

- **[MEDIUM] [EDGE_CASE]** No inline "this field is required" state on the per-variable example inputs; `canSubmit` should additionally require `extractVariables(bodyText).every(v => bodyExamples[v]?.trim())`.
  Fix: add that condition to `canSubmit` in `useTemplateBuilder.ts:164`, and give `BodyEditor`'s per-variable inputs a red border / inline error when the field is touched-but-empty at submit time.

**Name collision — no inline error, generic failure only.** There is no client-side or backend pre-check for name uniqueness. `TemplateStudioClient.createTemplate` (`TemplateStudioClient.java:90-94`) converts *any* non-2xx karix-mcp response (missing example, duplicate name, invalid category, anything) into the same fixed string: `"Template creation failed. Check the template details and try again."` This is intentional per the class javadoc (`TemplateStudioClient.java:1-31`, "never surface karix-mcp's raw error body to the frontend") but it means a name collision is indistinguishable from any other validation failure — the operator gets no signal that "this name" is the problem, only that "something" failed. `TemplateBuilderForm.tsx:66-68` renders this single string as a flat line, not tied to the name field.
  - **[MEDIUM] [COMPLETENESS]** Fix: `TemplateStudioException` already carries `statusCode` (`TemplateStudioException.java:24-26`) and the raw `responseBody` for logging — that status/body is available server-side to at least distinguish a 409/422 "duplicate" class of error and return a slightly more specific (still non-leaky) message like "A template with this name already exists for this WABA." Currently that signal is discarded (`TemplateStudioClient.java:91-93` always uses the same static string regardless of status).

Neither path returns a 500 — both are clean 400s with *a* message. The gap is **specificity**, not correctness of the HTTP layer.

---

## Q4 — User navigates away mid-response

- **[LOW] [PERFORMANCE]** No `AbortController`/query cancellation anywhere in `TemplateIrisPage.tsx`. `sendMessage`'s `mutationFn` (`TemplateIrisPage.tsx:136-141`) is a plain `api.post(...)` with no abort signal. Navigating away unmounts `IrisWorkspace`; React 18 silently no-ops any `setState` the eventual `onSuccess`/`onError` tries to run on the unmounted tree — no crash, no visible corruption. But the outbound HTTP request (and the backend LLM call behind it, up to 30-60s of provider time, `IrisConversationService.sendMessage:180`) keeps running to completion, wasting a provider call/cost for a response nobody will see. The assistant turn *is* persisted to `iris_message` (`IrisConversationService.java:182-183`) so the conversation itself isn't corrupted — the user will just see it if they resume that session later.
  Fix: pass an `AbortController` signal into the `sendMessage` axios call and abort it in a cleanup effect on unmount; acceptable to leave as-is if the cost of an occasional wasted provider call is judged acceptable, but this should be an explicit decision, not a default.

- **No polling exists** to leak — Iris is strictly request/response per turn, not a poll/stream implementation (confirmed via `IrisConversationService.java:11-39` javadoc: "v1 simplification... does not do a second full model round-trip"). Nothing to clean up on that front.

---

## Q5 — Extremely long user message

- **[MEDIUM] [EDGE_CASE]** No length limit anywhere in the message path:
  - Frontend `Composer`'s `<input>` (`IrisChatPane.tsx:168-176`) has no `maxLength`.
  - Backend `SendMessageRequest` (`SendMessageRequest.java:5`) only validates `@NotBlank` — no `@Size(max=...)`.
  - `IrisConversationService.sendMessage` (`IrisConversationService.java:161`) persists and forwards the raw text unbounded.
  A very long message is passed straight to the provider. If it exceeds the provider's context/token limit, the provider returns a 4xx, which (per Q1's finding) surfaces as a raw string like `"Claude API error: 400 BAD_REQUEST"` — not a clear "your message is too long" — because there is no pre-flight length check to catch it earlier with a clean message.
  Fix: add `@Size(max = N)` to `SendMessageRequest.text` (pick N conservatively below the smallest supported provider's context window minus history/system-prompt overhead) so this fails fast with a clear 400 message, and mirror it as a client-side character counter/limit in `Composer` the same way `TemplateBuilderForm`'s body editor already does (`BODY_MAX`, `TemplateBuilderForm.tsx:220-222`).

---

## Q6 — Session switching while a message is in-flight

**[CRITICAL] [EDGE_CASE] — Cross-session message contamination.** `startNewChat()` and `resumeSession()` (`TemplateIrisPage.tsx:92-118`) are wired directly to the sidebar's `onNewChat`/`onSelect` (`TemplateIrisPage.tsx:120-128`) with **no guard against an in-flight `sendMessage`**. Compare to `submit()` (line 203), which *does* guard on `sendMessage.isPending` — but session switching does not reuse that guard.

Trace:
1. User is in session A, sends a message. `sendMessage.mutationFn` captures `sid` from `sessionId` at call time (`TemplateIrisPage.tsx:137-139`) and the request is in flight.
2. While waiting, user clicks a different session in the sidebar → `resumeSession(B)` runs, `await`s `GET /sessions/B/messages`, then calls `setEntries(...)` (line 106) replacing `entries` wholesale with session B's messages, and `setSessionId(B)`.
3. Session A's `sendMessage` eventually resolves. `onSuccess` (`TemplateIrisPage.tsx:142-153`) calls `setEntries((prev) => [...prev.map(...), { ...new iris entry... }])` — a **functional** update, so `prev` is whatever `entries` holds *at that moment*, which is now session B's messages. Session A's reply text gets appended onto session B's chat, and `queryClient.invalidateQueries(['iris-sessions'])` fires regardless of which session is now active.
4. The reply is *also* correctly persisted server-side under session A (`IrisConversationService.sendMessage` writes to the sessionId path param it was called with) — so the two sides diverge: DB has it under A, UI shows it under B until B is reloaded/resumed again, at which point it vanishes from the visible thread (since B's `getMessages` won't include it) and would reappear if A is resumed. Confusing but not data-destructive — the persisted record is correct, only the live rendering is wrong.

  Fix: guard `startNewChat`/`resumeSession` the same way `submit()` is guarded (block switching while `sendMessage.isPending`, or at minimum have `onSuccess`/`onError` check `vars` against the *current* `sessionId` before mutating `entries`, dropping/discarding stale responses for a session that's no longer active).

**[HIGH] [EDGE_CASE] — Stuck session on pending-confirmation abandonment.** If the user has a pending tool call awaiting confirmation (`pending` state, `IrisConfirmPanel` shown) and switches sessions via the sidebar without confirming or cancelling, `startNewChat`/`resumeSession` unconditionally does `setPending(null)` (`TemplateIrisPage.tsx:95, 112`) — clearing only the *client-side* pending state. The backend session still has `pendingToolName`/`pendingToolArgsJson` set (`IrisSession`, persisted in `IrisConversationService.sendMessage:198-200`). `getMessages` (`IrisConversationService.java:148-153`) never returns pending-tool state, only the plain message transcript. So when the user later resumes that same session, `resumeSession` sets `pending` back to `null` (line 112) with no way to reconstruct it. The next message they send hits `IrisConversationService.sendMessage:157-159`:
  ```
  if (session.getPendingToolName() != null) {
      throw new BusinessException("There's a pending action awaiting confirmation — confirm or cancel it before continuing.");
  }
  ```
  This surfaces as a plain error banner (`TemplateIrisPage.tsx:154-157` → `error` state → `ErrorBanner`, `IrisChatPane.tsx:142`) with **no confirm/cancel UI available**, because `IrisConfirmPanel` only renders when the client's `pending` state is set (`TemplateIrisPage.tsx:243`), and nothing in `resumeSession` restores it from the backend. The session is now permanently stuck — every future message to it fails the same way — with no path to confirm or cancel from the UI. Only a raw `POST /confirm` or `/cancel` call (e.g. via curl) unblocks it.
  Fix: `GET /sessions/{id}/messages` (or a small new endpoint) should also return the session's pending tool name/args if any, and `resumeSession` should reconstruct `pending` from that instead of unconditionally nulling it.

---

## Q7 — Template publish/send: real confirmation + double-send protection

**Confirmation step is real and irreversible-aware.** `IrisConfirmPanel.tsx:148-150` renders a `ConsequenceLine` with explicit warning copy: *"Submitting sends this exact content to Meta / Karix — this cannot be undone from here."* This only appears after Iris drafts a `create_template`/`edit_template`/`send_test_template` call (all three are `requiresConfirmation: true` in `IrisConversationService.java:88-124`) and the tool does **not execute** until a separate `POST /confirm` replays the *persisted* args (`IrisConversationService.confirmPendingAction`, `IrisConversationService.java:207-224`) — never a fresh model message, so the model can't be tricked into re-drafting different args between preview and execution. This is a solid design.

**Double-send is blocked.** The Confirm button is `disabled={busy}` where `busy = confirming || cancelling` (`IrisConfirmPanel.tsx:111, 154`), and `confirming`/`cancelling` are wired straight to `confirmAction.isPending`/`cancelAction.isPending` (`TemplateIrisPage.tsx:249-250`). A second click while the first `POST /confirm` is in flight is a no-op at the DOM level (button disabled). Server-side, `confirmPendingAction` (`IrisConversationService.java:207-224`) clears `pendingToolName`/`pendingToolArgsJson` to `null` (lines 217-218) — so even a bypassed-client-disabled-state double-POST would hit `confirmPendingAction`'s guard (`session.getPendingToolName() == null` → throws `"There's no pending action to confirm."`, line 209-211) on the second call, since there's no transaction/lock between the two writes but the second request's read of `pendingToolName` would very likely already be `null` in normal (non-concurrent-thread) sequential handling. **No `@Transactional`/optimistic lock is present**, so this is not airtight against a genuine race (two near-simultaneous requests both reading `pendingToolName != null` before either writes `null`), but it is not reachable through the shipped UI, and the same tool would simply execute twice against Meta/Karix in that theoretical race.

- **[LOW] [EDGE_CASE]** `IrisConversationService.confirmPendingAction` has no `@Transactional` boundary and no row-level lock around the read-then-clear of `pendingToolName` (`IrisConversationService.java:207-219`). A genuine double-click that bypasses the disabled button (e.g. programmatic double-POST, or two browser tabs on the same session) could execute the same tool call twice — for `send_test_template` this means two test messages sent; for `create_template`/`edit_template` it likely means a duplicate-name rejection on the second call (self-limiting) or a duplicate edit (idempotent-ish, same components twice).
  Fix: wrap `confirmPendingAction` in `@Transactional` and re-check `pendingToolName != null` immediately before clearing it inside the same transaction, or use a `SELECT ... FOR UPDATE` / optimistic version column on `IrisSession`.

---

## Summary Table

| # | Area | Severity | Finding |
|---|------|----------|---------|
| 1 | Provider timeout | HIGH | No client-side axios timeout — a hung browser↔backend connection leaves "Iris is thinking…" forever, no error, no retry |
| 1 | Provider error message | LOW | Raw provider HTTP status strings leak into chat replies (all 3 adapters) |
| 2 | Double-submit | — | No issue — prior fix (`pending \|\| sendMessage.isPending` guard) confirmed intact |
| 2 | New-session race | LOW | Latent double-`startSession` race if `sendEntry` is ever called twice in one tick; not reachable via current UI |
| 3 | Unfilled variable | MEDIUM | `canSubmit` doesn't require variable examples to be filled; submits empty string to Meta |
| 3 | Name collision | MEDIUM | All template-creation failures (incl. duplicate name) collapse to one generic message; no inline field-level error |
| 4 | Navigate-away | LOW | No `AbortController`; abandoned request still burns a provider call and completes silently |
| 5 | Long message | MEDIUM | No length validation anywhere (frontend or backend `SendMessageRequest`) — relies on provider 4xx, which then hits the Q1 raw-status-string issue |
| 6 | Session switch mid-flight | CRITICAL | In-flight reply can render onto the wrong (currently-active) session's chat pane; no guard on `startNewChat`/`resumeSession` |
| 6 | Pending action abandoned via switch | HIGH | Switching away from a pending-confirmation session and back leaves it permanently stuck — no UI path to confirm/cancel, every future message errors |
| 7 | Confirm/cancel flow | — | Solid: real irreversibility warning, args replayed from persisted state, button-level double-send protection |
| 7 | Confirm race | LOW | No `@Transactional`/lock around confirm's read-then-clear; theoretical double-execution under true concurrency, not reachable via shipped UI |

**Highest-priority follow-ups (recommend P0):** #6 cross-session contamination (CRITICAL) and #6 stuck-pending-session (HIGH) — both are reachable through normal sidebar navigation, no edge-case timing required, and both directly undermine trust in "what you see is what's in this conversation." #1's missing client timeout (HIGH) is the next priority — it turns any backend/network hiccup into a permanent hang with no recovery but a hard reload.
