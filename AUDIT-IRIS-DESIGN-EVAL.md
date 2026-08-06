---
date: 2026-08-07
type: design-evaluator-audit
reviewer: Design Evaluator (persona-design-evaluator, cold review)
scope: Iris chat (TemplateIrisPage.tsx, IrisChatPane.tsx, IrisConfirmPanel.tsx) + Template Management (TemplateStudioPage.tsx, TemplateBuilderForm.tsx)
---

# Design Evaluator — Iris & Template Management

## Overall Verdict: **BLOCK** (on the Iris chat surface specifically)

Founder named Iris as the top-priority surface. The chat pane is the one place in this review that fails the exact test this gate exists for: **it is a generic AI-chatbot clone**, not a designed product. Template Studio / Builder Form is a separate, lower-stakes surface — that one **PASSes with notes** (competent, compliant, forgettable — not BLOCK-worthy, forms are allowed to be plain).

I did not check UX-checklist compliance (tokens, breakpoints line-by-line) except where it bears on "generic feel" or is a cross-screen regression — that's the UX gate's job, already run. I checked: §0 mood expression, the squint test, the lineup test (Linear/Stripe/Vercel/ChatGPT), craft micro-detail, accessibility, and cross-screen drift, as mandated.

---

## BLOCK Finding — Iris chat is the ChatGPT template, not a Karix product

**File:** `frontend/src/components/templatestudio/IrisChatPane.tsx`

Line up the empty state (lines 69–94) against ChatGPT/Claude/Gemini/Perplexity: centered heading + one-line subtitle + a **pill-shaped composer with a circular send button** (line 167, `rounded-full ... rounded-full`) + a stack of underlined suggestion chips below it. This is not "inspired by" the genre — it is pixel-for-pixel the same layout skeleton as every consumer AI chat product shipped since 2023. There is no named signature move here, and none is evident in the code that a Creative Ideation step (persona-ux mandate) ever produced two real directions before this shipped.

Compounding it:
- **Thinking indicator** (line 140): `<p className="animate-pulse ... italic">Iris is thinking…</p>` — the exact "italic pulsing status line" every chatbot uses. DESIGN.md §8 says motion must answer "is something happening?" — this technically does, but it answers it in the most generic possible dialect, when the brief (§0, §9) explicitly asks for the dots/lines Karix DNA to be the thing that answers that question instead (e.g., a connecting-dot / line-draw motif, permitted "sparingly... setup flows" but this *is* the flagship conversational surface).
- **Message bubbles** (lines 99–137): right-aligned muted-bg bubble for the user, bare left-aligned text for Iris. This is the WhatsApp/iMessage/ChatGPT bubble convention with zero product-specific inflection — no avatar, no dot/line accent, no visual tie back to the Karix identity described in §9 anywhere in the transcript itself.
- **Zero entrance motion.** Nothing in this file imports a motion/animation primitive. New entries (line 97 `entries.map`) just appear. DESIGN.md §8 mandates fade + 8px translateY, 200ms ease-out for "where did this come from" — a brand-new chat message is the single clearest case that rule was written for, and it's entirely unimplemented here. This isn't a taste note, it's a named, specific rule with zero coverage.

**What a world-class version does instead:** the chat surface is the one place in this entire app where Karix's dots-and-lines DNA (§9) could earn its keep — e.g., a subtle connecting-line stroke animation when Iris's reply lands (the "line forming" motif §9 explicitly sanctions for this exact kind of moment), a composer that doesn't default to the rounded-pill-with-circle-button shape everyone else uses, and a thinking state expressed as a dot pulse/sequence rather than italic text. None of that needs to be loud — DESIGN.md's whole philosophy is restraint — but restraint applied to a stock template is still a stock template. The signature move is missing, not merely subtle.

**Was the Ideation step followed?** I found no evidence of it. This reads as the first idea that cleared the token/anti-pattern checklist, which is exactly the failure mode persona-design-evaluator.md §"Checking the Ideation Step" warns about: rule-compliant (no hardcoded hex, tokens used, ConsequenceLine present) and still generic.

---

## Genuinely good — do not touch

1. **Sidebar merge into the navy rail** (`AppShell.tsx` lines 260–320, referenced from `TemplateIrisPage.tsx`). Session history/search/new-chat rendered inline in the same nav rail instead of a second light-colored sidebar bolted onto the chat — this is the one place the team actively rejected the generic pattern (a separate ChatGPT-style left rail) in favor of "one rail, one grammar." This is a real point of view and it should be protected, not revisited.
2. **IrisConfirmPanel docked pattern** (`IrisConfirmPanel.tsx`, whole file). Not a modal, stays visible beside Iris's reasoning, reuses `WhatsAppTemplatePreview` so the "output is always present" (§7.3) — this is the strongest craft in the whole surface. `ConsequenceLine tone="warning"` at the exact decision point (lines 148–150) is correct instinct, not just checklist compliance.
3. **Suggestion chips as plain underlined text**, not pill buttons (`IrisChatPane.tsx` lines 82–93) — correctly restrained, avoids "competing CTAs."

---

## HIGH — Cross-screen token drift (Third Check, mandatory)

**File:** `frontend/src/components/templatestudio/TemplateBuilderForm.tsx`

Every text/select/textarea input in this file (lines 118, 129, 138, 165, 179, 229, 244, 272, 282, 336, 344, 353) uses `focus-visible:ring-primary`. DESIGN.md's Focus Ring token (§2) is explicit and marked "Not optional. Purple-tinted, not blue": `focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background`. None of these inputs use it.

Meanwhile `IrisChatPane.tsx` line 167 uses yet a **third** variant: `focus-within:ring-2 focus-within:ring-brand-pink/30`.

Three different focus-ring treatments across two features that are supposed to be one product (`ring-primary`, `ring-brand-pink/30`, and — nowhere found — the actual mandated `ring-brand-purple/40`). This is exactly the kind of silent, repeated deviation the Third Check exists to catch: not a new observation each time, but the same unresolved token gap propagating call-site by call-site. Flag for EM: extract this as a shared input/focus class rather than patching 12+ sites individually.

## MEDIUM — Hardcoded color alongside the correct token, same file

`TemplateBuilderForm.tsx` lines 120 and 232 use `text-amber-700 dark:text-amber-400` for inline warning hints, while line 193 in the same file correctly uses the `text-warning` token for a semantically identical warning message. DESIGN.md §1: "Components NEVER hardcode hex colors... Use token classes." `amber-700`/`amber-400` aren't hex but they are exactly the kind of ad-hoc color DESIGN.md's warning token exists to prevent — and the file proves the author knows the right token exists, since it's used two lines away in spirit.

## LOW — Accessibility gap in the chat transcript

`IrisChatPane.tsx`: the messages container (line 96) and the "Iris is thinking…" line (line 140) carry no `aria-live` / `role="status"`. A screen-reader user gets no announcement when Iris's reply or the thinking state arrives — for a chat surface this is the single most consequential a11y gap, more so than static contrast/focus rules. Not assessed further: keyboard-only flow through the confirm panel's Tab order, and behavior at very long transcripts (no virtualization) — flag as unverified, not clean.

## Not assessed
- `prefers-reduced-motion` — moot for Iris chat today since there is no motion to reduce (see BLOCK finding above); should be revisited once entrance motion is added.
- Scale/edge cases: 50+ session sidebar, very long template bodies in the confirm-panel preview, mid-flow network failure during `confirmAction`/`cancelAction` (both only set a top-level `error` string, no retry affordance visible in `IrisConfirmPanel` itself — worth a follow-up, not scoped as BLOCK here).

---

## Template Studio / Builder Form — PASS (advisory notes)

**Ship-blocking:** none. `TemplateStudioPage.tsx` and `TemplateBuilderForm.tsx` correctly follow the Wizards pattern (§5: steps/form/live-preview, live preview always present per §7.3), `StatusIndicator` is used correctly as dot+sentence (`TemplateStudioPage.tsx` lines 206–209 — not a pill), `ConsequenceLine` appears at every consequential decision point (lines 48–53, 180–197) with real plain-language content, not filler.

**Notes (advisory, ranked):**
1. The form itself (`TemplateBuilderForm.tsx`) is pure "competent SaaS form" — label-over-input, bordered boxes, no craft beyond correctness. Not BLOCK-worthy (a template builder is allowed to be a form), but it's the least distinctive part of the product and would benefit from the same Karix-identity pass proposed for Iris — e.g., the connecting-line motif when a header/body/footer/button block links into the live preview, making the "this is the product" claim in §7.3 visually literal instead of just architecturally true.
2. Fix the focus-ring/hardcoded-amber drift above before adding more input fields to this form — every new field copies the existing wrong pattern.
3. The known-Karix-issue callout about image header handle rejection (lines 192–198) is good, honest copy — "not a bug in this form" — exactly the tone §6 asks for. Keep this pattern for other known-vendor-limitation surfaces.

I reviewed this screen in isolation and cross-checked it against Iris and against DESIGN.md's StatusIndicator/ConsequenceLine patterns (Third Check) — I did not cross-check it against every other form in the app (e.g., Skills/FAQ/Connectors editors), so absence of a note there is not a clean bill of health for the whole app's forms.
