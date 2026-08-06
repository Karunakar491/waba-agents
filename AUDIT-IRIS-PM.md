# PM Audit — Iris & Template Management (Deep Pass)

**Date:** 2026-08-07
**Author:** PM persona (per `.claude/skills/persona-pm.md`)
**Scope:** `frontend/src/pages/TemplateIrisPage.tsx`, `frontend/src/components/templatestudio/{IrisChatPane,IrisConfirmPanel,TemplateBuilderForm,useTemplateBuilder,TemplateListPanel}.tsx`, `frontend/src/pages/{TemplateStudioPage,TemplateSettingsPage}.tsx`, `backend/.../domain/templatestudio/**` (incl. `iris/*`).
**Explicitly excluded from scope:** any fix. This is findings only, no code was touched.

**Baseline assumed already-fixed** (per project memory, not re-litigated here): component-shape schema gap, AUTHENTICATION `codeExpirationMinutes` gap, OpenAI adapter, ChatGPT-style redesign, docked confirm panel, double-send race.

---

## THESIS

Iris is a well-scoped, safety-conscious tool-calling assistant bolted onto a solid manual form. It is **not yet** a "conversation partner" by this product's own thesis ("make the user feel like they have a competent operations partner"). Today it is closer to a **chat-shaped API console with a confirmation gate** — every irreversible action is gated (good, matches "trust over transparency"), but the chat itself lacks the baseline mechanics users now expect from *any* AI chat (streaming, stop, regenerate, inline edit) and has at least one **data-integrity gap that strands users mid-task**. Template management (the forms/list) is functionally complete but has zero of the proactive intelligence the PM thesis calls for — no rejection-prevention, no duplication-across-language, no bulk lifecycle actions.

**BET:** Fixing the CRITICAL items below (stuck pending-state, AUTHENTICATION/OTP schema gap, BYOK-only activation wall) will do more for real production adoption than any UI polish.

**RISK if ignored:** Users get an AI-drafted template that Meta rejects for a reason Iris never warned about, or get permanently stuck behind a pending confirmation they can't see or cancel, and conclude Iris is unreliable — which kills the "trust the sausage" thesis for every future feature we build on top of Iris.

---

## Findings

### CRITICAL

**C1 — Resuming an Iris session silently drops pending-confirmation state; user gets stuck.**
`frontend/src/pages/TemplateIrisPage.tsx:100-118` (`resumeSession`) unconditionally sets `setPending(null)` after loading messages. But `IrisSession` (`backend/.../iris/IrisSession.java:44-48`) persists `pendingToolName`/`pendingToolArgsJson` server-side, and `GET /templates/iris/sessions/{id}/messages` (`IrisController.java:32-35` → `IrisConversationService.getMessages`, lines 148-153) never returns that pending state — only USER/ASSISTANT message history. If a user drafts a template, navigates away (or the tab reloads) before confirming, and comes back: the UI shows no confirm panel, looks idle, and the next message they type will hard-fail with `"There's a pending action awaiting confirmation — confirm or cancel it before continuing."` (`IrisConversationService.java:157-158`) with no visible way to see or cancel the thing they don't know exists.
**Recommendation:** `getMessages` (or a new session-detail endpoint) must return `pendingToolName`/`pendingToolArgs` so the frontend can rehydrate the `IrisConfirmPanel` on resume exactly as if the turn had just completed. This is a one-field addition to `MessageDto`'s sibling `SessionSummary`/a new response, not a redesign.

**C2 — Iris's `create_template`/`edit_template` tool schema cannot produce a valid AUTHENTICATION template's OTP button.**
`IrisConversationService.java:71-77` (`COMPONENTS_SCHEMA_DESCRIPTION`) documents the OTP button type but never mentions the `example` field Meta requires on it. Compare `useTemplateBuilder.ts:108`, the manual builder, which correctly emits `{ type: 'OTP', otp_type: 'COPY_CODE', example: otpExampleCode }` — a required field with no schema guidance for the model to include. Given this project's own prior incident (memory: "Iris Component-Shape Gap" — bare schemas make the model invent wrong shapes), this is the same class of bug recurring in a new place: Iris can walk a user through drafting an AUTHENTICATION template end-to-end, get it confirmed, and have Meta reject or the Karix call fail, with no signal to the user why until submission.
**Recommendation:** Add `otp_type`/`example` to the BUTTONS/OTP schema description, mirroring the manual builder's known-correct shape. Add a chat-scenario test (per this project's own stated lesson: "mocked tests can't catch prompt-quality bugs" — must live-test against a real model, not just unit-test the Java).

### HIGH

**H1 — No streaming, no stop, no regenerate: Iris fails the baseline chat-UX bar it will be judged against.**
`IrisChatPane.tsx:139-141` shows a static pulsing "Iris is thinking…" string while `sendMessage.isPending` (set in `TemplateIrisPage.tsx:236`) is true — the entire reply arrives in one blocking HTTP response (`ClaudeAdapter.java:33-34` sets a flat 30s read timeout, no SSE/streaming). There is no stop-generating control, and no regenerate-response affordance on a *successful* reply (only `onRetry` for a failed *send*, `IrisChatPane.tsx:112-124`, which resends the user's own message, not "try that again"). Every mainstream chat product (ChatGPT, Claude.ai) ships token streaming + stop + regenerate as baseline, not differentiators. For a non-technical user waiting on a cold synchronous call that can take several seconds per the adapter's own timeout budget, this reads as "hung," not "thinking."
**Recommendation:** This is the single highest-leverage chat-UX investment available. At minimum: a visible stop button during `thinking`, and a regenerate icon on the last Iris message. Full token streaming is a larger backend lift (SSE from the adapter) and should be scoped as its own EM-reviewed task, not bundled here — but PM view is it belongs on the near-term roadmap, not "later."

**H2 — BYOK-only activation is a hard wall for the stated user (non-technical SMB owner / internal Karix operator).**
`TemplateSettingsPage.tsx:635-749` (`AiProviderPanel`) requires every account to obtain and paste a raw Claude/OpenAI/NVIDIA API key before Iris does anything beyond generic chat (`IrisChatPane.tsx:196`, `SetupBanner`: *"Iris can chat, but can't create or send templates until then"*). Getting an Anthropic or OpenAI API key — sign up, add billing, generate a key, understand model pricing — is precisely the "homework" this product's own PM thesis says the user abandons ("Anything that requires reading documentation," "I don't have time to learn another platform"). There is no platform-provided default key/tier for casual/first-time use.
**Recommendation:** Not asking to remove BYOK (there may be real cost/compliance reasons for it — that's a founder-level pricing/legal call, correctly outside this PM's unilateral authority). But flag explicitly: if the goal is "non-technical user gets a working agent," a metered platform default (even capped, e.g. 20 free Iris messages/month) would close the single largest activation gap in this audit. Escalating this as a pricing/packaging question, not deciding it here.

**H3 — Confirm panel is read-only; correcting a draft requires a full extra round-trip.**
`IrisConfirmPanel.tsx:126-145` renders the drafted template via `WhatsAppTemplatePreview` with no edit controls. If the body text has a typo or the wrong button label, the user's only path is Cancel → type a correction in chat → wait for a fresh model turn → re-review. Meta's own template composer and every competent AI-drafting-with-review pattern (e.g. document/canvas-style tools) let you tweak the draft directly before committing. This directly contradicts the product's "2 clicks instead of 20" love-language from the PM's own user model.
**Recommendation:** Minimum viable version: make body/header/footer text and button labels editable inline in the confirm panel itself, submitting the edited values on Confirm rather than the original model-drafted args. Scope as a follow-up task, EM to assess wiring cost against `IrisConfirmPanel`'s current args-passthrough shape.

**H4 — No delete/archive for Iris sessions or templates from the UI at all.**
`IrisController.java` (full file) exposes create/list/get-messages/send/confirm/cancel for sessions — no `DELETE`. `TemplateListPanel.tsx`'s `TemplateTable` (lines 290-389) exposes only an Edit action per row — no delete, pause, or duplicate. Meta's own WhatsApp Manager supports deleting and pausing templates directly. Sessions accumulate indefinitely with auto-generated titles (`IrisConversationService.java:301-306`, truncated first message) and no way to clean up test/junk sessions.
**Recommendation:** Add session delete (soft-delete is fine — no production-data risk if scoped to the owning account) and at minimum a "duplicate to another language" action on the template list, which is the single most requested pattern for any multi-locale WhatsApp template tool and currently has zero path in this UI (a same name+different-language template is explicitly a *separate* template per `TemplateStudioPage.tsx:193` comment, yet nothing helps a user create that second one from the first).

### MEDIUM

**M1 — Iris cannot attach or reference media for HEADER format IMAGE/VIDEO/DOCUMENT; only the manual form can.**
`useTemplateBuilder.ts:88-102` (`uploadMediaMutation`) is the only path in the whole codebase that uploads media and obtains a `fileHandle` needed for a media header (`buildComponents`, line 116: `example: { header_handle: [headerHandle] }`). Iris's tool schema (`IrisConversationService.java:74`) lets the model *say* `format: IMAGE`, but there is no tool for uploading a file through chat and no mechanism for the model to reference a handle the user hasn't already obtained elsewhere. A user who asks Iris for an image-header template hits a dead end Iris cannot articulate (the system prompt gives it no knowledge of this limitation).
**Recommendation:** Either (a) teach Iris to explicitly say media headers aren't supported in chat yet and hand off to the manual form, or (b) add a lightweight upload-then-continue affordance in the chat pane. (a) is a one-line system-prompt fix; (b) is real scope. PM default: ship (a) now, track (b) as a backlog item — matches "ship the 80% solution" default.

**M2 — No rejection-prevention / pre-submit linting against Meta's own common rejection reasons, in either Iris or the manual builder.**
Both `IrisConfirmPanel.tsx` and `TemplateBuilderForm`/`useTemplateBuilder.ts` validate structural correctness (name regex, body length, variable examples) but nothing checks for the actual leading cause of real-world Meta template rejections: promotional/marketing language in a UTILITY-category template, or a body that starts/ends with a variable. `TemplateStudioPage.tsx:196` surfaces the *rule* in a `ConsequenceLine` ("variables need examples and cannot start or end the body") but nothing enforces or warns on it inline before submit — it's the user's job to have read and remembered the blue info banner.
**Recommendation:** Add a client-side check (already have the parsed variable positions via `extractVariables`, `templateModel.ts`) that flags "this variable is the first/last token in your body" before submit is enabled. Cheap, high-value, prevents a wasted 24h review cycle — directly serves the PM thesis's "the product tells them how to fix it" love-language.

**M3 — Template list search/filter is entirely client-side and re-fetches the full unfiltered list on every mount.**
`TemplateListPanel.tsx:53-58` (`allQuery`) fetches every template for the WABA with `refetchOnMount: 'always'`, and `search` (line 76-80) filters that in-memory. Fine at today's scale; will degrade for any WABA with a large template library (retailers commonly have hundreds of localized templates). Not urgent, but worth naming now rather than discovering it as an incident later.
**Recommendation:** No action needed today. Flag as a scale watch-item — revisit if any account crosses ~200 templates.

**M4 — No cost/usage visibility for BYOK Iris usage.**
Given H2's BYOK requirement, once a user *does* configure a key, there's no token-usage or approximate-cost indicator anywhere in `TemplateSettingsPage.tsx`'s `AiProviderPanel`. A stressed business owner (PM's own user fear: "I don't have time to learn another platform") has no way to know if Iris is quietly running up their Anthropic/OpenAI bill.
**Recommendation:** Even a rough "~N messages this month" counter (session/message count is already stored, `IrisMessageRepository`) would close most of the anxiety here at near-zero engineering cost.

### LOW

**L1 — Suggestion chips are static and generic.** `IrisChatPane.tsx:17-21` (`SUGGESTIONS`) are the same three hardcoded prompts for every account, every session, forever. No use of the account's actual WABA name, existing template categories, or time-of-day/seasonal cues — a missed opportunity for the "proactive intelligence" moat this product claims to want ("suggests something they were about to do anyway"). Not urgent; cosmetic today.

**L2 — No character-count / live preview sync indicator while typing in the manual builder for footer/body relative to Meta's 1024-char body limit** — the limit is enforced only at submit-disable (`useTemplateBuilder.ts:165`, `bodyLenOk`), with no visible running counter in `TemplateBuilderForm.tsx` (not fully read in this pass — flagging for a follow-up spot-check, not asserting as confirmed).

---

## Answering the founder's direct questions

**Is this best-in-class vs. ChatGPT/Claude-level chat UX?** No. Missing streaming, stop, regenerate, and inline-edit-of-draft are the four biggest gaps (H1, H3). The confirmation-gate pattern itself is *good* and arguably more trustworthy than raw ChatGPT for this use case — that's a real differentiator worth keeping and marketing, not abandoning in the name of parity.

**Vs. Meta's own template tooling?** Behind on lifecycle actions (delete/pause/duplicate-to-language — H4) and on rejection-prevention (M2). Ahead on conversational drafting, which Meta's tooling doesn't have at all.

**Is the create/test/publish journey airtight?** No — C1 (stuck pending state on resume) is a real dead-end a production user will hit. C2 (AUTHENTICATION/OTP schema gap) means one whole template category can be drafted-and-confirmed by Iris into a submission Meta may reject, with zero warning.

**Does Iris actually help a non-technical user get more done, or is it a chat window bolted onto forms?** Today, functionally the latter, with one very good idea layered on top (the confirm-before-submit safety gate). The tool-calling loop is real and the WABA-disambiguation logic in the system prompt (`IrisConversationService.java:51-56`) shows real product thought. But the *activation* cost (H2) and the missing baseline chat mechanics (H1) mean it hasn't yet crossed from "impressive demo" to "the thing a stressed owner reaches for instead of the form." That crossing point is the next roadmap bet, not a polish pass.
