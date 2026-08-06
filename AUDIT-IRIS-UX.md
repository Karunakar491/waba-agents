# UX Audit — Iris Chat & Template Studio
Persona: UX Designer (persona-ux.md) · Standard: DESIGN.md · 2026-08-07
Scope: `frontend/src/pages/TemplateIrisPage.tsx`, `IrisChatPane.tsx`, `IrisConfirmPanel.tsx`, `irisSidebarStore.ts` + its consumer in `AppShell.tsx`, `TemplateStudioPage.tsx`, `TemplateBuilderForm.tsx`, `TemplateSettingsPage.tsx`, `WhatsAppTemplatePreview.tsx`.
No code was modified. This is a read-only audit.

---

## CRITICAL

### C1. Message list is not virtualized — will die at scale
`IrisChatPane.tsx:96` renders `entries.map(...)` directly into a plain `overflow-y-auto` div. Every message ever sent in a session renders to the DOM, with `ReactMarkdown` re-parsing every Iris message on every re-render (no memoization — see H2). A long template-drafting session (Iris conversations are iterative, "change the header," "make it shorter," etc. — expect 40–100+ turns) will accumulate that many full markdown-rendered DOM subtrees with zero windowing. ChatGPT/Claude both virtualize. This will visibly stutter well before "many messages."
**Recommendation:** Adopt a virtualized list (e.g. `react-virtuoso`, which handles chat's variable-height + stick-to-bottom pattern well) once sessions realistically exceed ~50 entries. At minimum, cap in-memory render to the last N entries with a "load earlier messages" affordance.

### C2. Session list has no pagination — unbounded fetch and unbounded render
Backend: `IrisController.java:27` — `@GetMapping("/sessions")` takes no page/size/cursor parameter. Frontend: `TemplateIrisPage.tsx:87-90` fetches with `useQuery(['iris-sessions'], () => api.get('/templates/iris/sessions')...)` — no params. `AppShell.tsx:291-317` then `.filter()`s and renders the *entire* result set as plain buttons inside the navy rail with no windowing.
A staff account managing template drafting over months will accumulate hundreds of sessions ("hundreds of sessions" is explicitly the failure mode the founder asked to check). Today: every session ever created loads and renders on every visit to `/templates/iris`, inside a narrow rail, with a linear client-side substring filter as the only navigation aid.
**Recommendation:** Add `page`/`size` (or cursor) to `GET /sessions`, default sort by `updatedAt desc`, load first 20–30, "load more" or infinite-scroll in the rail. Server-side search once the account has enough sessions to make client-side filtering unreliable.

### C3. No stop/cancel affordance during Iris's turn
`IrisChatPane.tsx:139` shows a static "Iris is thinking…" line while `sendMessage.isPending`. There is no way to cancel an in-flight generation. Claude/ChatGPT both let the user stop a response. Given Iris calls out to a BYOK LLM provider (`TemplateSettingsPage.tsx` Claude/OpenAI/NVIDIA) that can hang or run long, and the input is fully disabled while `thinking` is true (`Composer` `disabled` prop, `IrisChatPane.tsx:150`), a slow provider **locks the entire composer with no escape** — the user cannot even type the next message, let alone abort. This is a known open issue per project memory ("NVIDIA NIM 60s no-feedback hang still open as follow-up") and it is still unaddressed in this code.
**Recommendation:** Add an AbortController-backed cancel button that appears in place of Send while pending; re-enable composer input while a request is in flight (queue or block only Send, not typing).

---

## HIGH

### H1. No streaming — reply appears as one atomic block after a full round-trip
`sendMessage` (`TemplateIrisPage.tsx:135-158`) is a single `api.post(...).then(...)` — the entire Iris reply materializes at once in `onSuccess`. There is no token-by-token streaming, no incremental render. Every reference bar product named in DESIGN.md's own philosophy (and every product this is benchmarked against) streams. For template drafts that can be a paragraph of markdown plus a component preview, a multi-second silent wait ending in an instant full-text pop-in reads as noticeably behind the bar this audit was asked to hold it to.
**Recommendation:** This is an architecture-level change (SSE or chunked response from `IrisConversationService`), flagging for EM — but it is the single biggest gap between this chat and the ChatGPT/Claude bar the founder invoked.

### H2. No message memoization — full markdown re-parse on every keystroke
`IrisChatPane.tsx` is a single function component; `entries.map()` runs on every parent re-render, and `TemplateIrisPage.tsx` re-renders `IrisWorkspace` (and therefore `IrisChatPane`) on every keystroke in the composer because `input`/`setInput` state lives in the parent (`input` prop threading, `TemplateIrisPage.tsx:72,233`). Every keystroke re-runs `ReactMarkdown` over every Iris message in the transcript, since no message row is wrapped in `React.memo`. Combined with C1 this compounds badly as sessions grow.
**Recommendation:** Extract a memoized `MessageBubble` component keyed by entry id; keep composer input state as local/uncontrolled or lift with a debounce so it doesn't re-render the transcript.

### H3. Retry only works on the client's own failed sends — no regenerate on Iris's replies
`retry()` (`TemplateIrisPage.tsx:211-214`) only resubmits a user entry that failed to send (network/API error). There is no way to ask Iris to regenerate a *reply that came back but was wrong or unhelpful* — a core ChatGPT/Claude affordance. For a template-drafting assistant this matters more than most chat products: "that header is wrong, try again" today requires typing a fresh message rather than a one-click regenerate.
**Recommendation:** Add a regenerate action on the last Iris message (re-post the preceding user turn with a `regenerate: true` hint, replacing rather than appending the reply).

### H4. No keyboard multi-line support — Shift+Enter does not exist because the composer is a single-line `<input>`
`Composer` (`IrisChatPane.tsx:167-176`) uses `<input type="text">` with `onKeyDown` firing `onSubmit` on any `Enter`. There is no `<textarea>`, so there is no way to compose a multi-line message at all — Shift+Enter, the baseline chat-input keyboard contract the task explicitly asked to verify, is structurally impossible here. Template bodies and instructions to Iris ("Make it: 1) shorter 2) friendlier 3) add a CTA") are exactly the kind of multi-line input business users will want to type.
**Recommendation:** Replace with an auto-growing `<textarea>` (max ~6 lines then internal scroll), Enter submits, Shift+Enter inserts a newline, per the standard contract.

### H5. No file/media/document attach affordance in the chat itself
Task asked to check "file/media/document attach affordance" in the chat surface. There is none — `Composer` has only a text input and Send button. Media header upload exists, but only inside `TemplateBuilderForm.tsx` (`HeaderEditor`, `<input type="file">` at line 184) in the separate manual-form flow, not reachable from an Iris conversation. If a user wants Iris to draft a template *with* an image header, they cannot show Iris the image or attach it mid-chat — they must abandon the chat and go into the manual builder. This is a hole between the two flagship flows this audit was scoped to.
**Recommendation:** Either give Iris a paperclip attach control that uploads via the same `uploadMedia` mutation and passes the resulting handle into the tool call args, or explicitly message in-chat that Iris will prompt for media upload via a docked control when a header is needed (currently it says nothing — the gap is silent).

### H6. `WhatsAppTemplatePreview.tsx:34` uses `shadow-sm` — direct DESIGN.md token violation
DESIGN.md §2 Shadow table permits only `shadow-resting` / `shadow-lifted` / `shadow-none`; `shadow-sm` is explicitly named in the anti-pattern table ("shadow-sm on cards → Fix: shadow-resting"). This file is rendered inside **both** `IrisConfirmPanel.tsx:140` (Iris's own confirm flow) and `TemplateBuilderForm.tsx:83` (manual builder) — i.e., every template preview in the product, in the two highest-priority surfaces named for this audit, carries a token violation on the one element designed to look most "real."
**Recommendation:** `shadow-sm` → `shadow-resting` (or `shadow-none`, since this is a chat-bubble mimicry sitting on a flat canvas — resting is closer to the visual weight already achieved by `shadow-surface-resting` on the outer frame at line 28).

---

## MEDIUM

### M1. No visible per-message timestamp
Neither user nor Iris bubbles (`IrisChatPane.tsx:98-137`) show a timestamp. For a resumed session (`resumeSession`, `TemplateIrisPage.tsx:100-118`) loaded from history, the user has no way to tell when a given turn happened, which matters once sessions are resumed days apart (a template drafted "yesterday" vs "three weeks ago" reads identically). Claude/ChatGPT show relative or absolute time on hover at minimum.
**Recommendation:** Add a `text-xs text-muted-foreground` timestamp, shown on hover for user bubbles / persistently under Iris replies at natural break points (e.g. session resume boundary), sourced from `MessageDto.createdAt` which the backend already returns (`TemplateIrisPage.tsx:44`) but the client discards it — `resumeSession` maps `messages` into `IrisChatEntry` without carrying `createdAt` through (`TemplateIrisPage.tsx:106-111`).

### M2. Code blocks have no copy-to-clipboard, no language label, no syntax highlighting
`IrisChatPane.tsx:128` styles `pre`/`code` via Tailwind arbitrary-variant selectors (`[&_pre]:rounded-lg [&_pre]:border...`) but there is no `rehype-highlight`/`prism` integration and no copy button. Iris is a template-drafting assistant, not a coding assistant, so raw code blocks may be rare — but Iris does render JSON-shaped tool-call summaries and Meta component structures in prose at times, and any code fence it emits today is unstyled beyond a flat monospace box with zero interaction. This is explicitly called out in the task brief as a check item.
**Recommendation:** Low urgency given the product surface, but if Iris ever emits multi-line structured content (it plausibly will when explaining component JSON to power users), add a copy button at minimum — near-zero cost, standard expectation.

### M3. Mobile chat surface: outer layout removes all padding (`-m-6`) but the confirm panel becomes unusable at 375px
`TemplateIrisPage.tsx:221-227`: on `pending`, the grid becomes `grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]` — below `lg` (1024px) this correctly stacks to one column, so `IrisConfirmPanel` and `IrisChatPane` both render full-width, which is right. However `IrisConfirmPanel.tsx:115` gives itself `border-l` unconditionally — at mobile width, stacked, that produces a left border with nothing visually separating it from the chat pane above (no top border/divider), reading as a stray vertical hairline rather than a section boundary. Minor but visible.
**Recommendation:** `border-l lg:border-l` → conditionally `border-t lg:border-l lg:border-t-0`, or simplest: `border-t border-l-0 lg:border-t-0 lg:border-l`.

### M4. Empty state ("What do you want to send today?") duplicates the SetupBanner check inconsistently with the started state
`IrisChatPane.tsx:79` and `:149` both render `<SetupBanner />` when `needsSetup`, once above the empty-state composer, once above the started-state composer — correct duplication for two different layouts. But `SetupBanner` (`IrisChatPane.tsx:193-206`) says "Iris can chat, but can't create or send templates until then" — yet the very set of `SUGGESTIONS` shown alongside it (`:83-93`, "Create a shipping-update template") directly contradicts that sentence by suggesting the one action the banner just said isn't available yet. Confusing first-run moment on the single highest-priority screen in the product.
**Recommendation:** Filter `SUGGESTIONS` to setup-safe prompts when `needsSetup` is true (e.g. "Help me plan a marketing message" only), or suppress suggestions entirely until setup completes.

### M5. Template Studio composer flow is a flat form, not a wizard — falls short of DESIGN.md's own Wizards pattern and of Meta's own composer
DESIGN.md §5 "Wizards: Multi-Step Form Pattern" specifies steps-rail | form | live-preview for multi-step flows, explicitly noting "the preview is not a preview — it is the product." `TemplateBuilderForm.tsx` gives the live preview (good, matches the philosophy) but presents header/body/footer/buttons as one continuous scrolling form with no step rail, no progress indication, and no per-section validation gating (e.g. a user can scroll straight to buttons before writing body text). Meta's own Business Manager composer is comparably flat, so this is parity, not a regression — but the task asked "as good as or better than Meta's own composer," and a flat form is not better. There's also no autosave/draft-resume: navigating away (`onBack`, `TemplateStudioPage.tsx:81-89`) silently discards all typed content with no confirmation.
**Recommendation:** (a) Add a lightweight step rail (Header → Body → Footer → Buttons → Review) even if all sections stay visible — sectioned progress indication alone would beat Meta's flat form. (b) Guard `onBack`/back-navigation with a "discard draft?" confirmation once any field is dirty — currently zero protection against losing work, which is a real regression versus "better than Meta."

### M6. No inline undo/history for template builder edits
Task asked whether the authoring flow is as good as Meta's composer. Meta's own template composer has no undo either, so this is parity — but combined with M5's silent-discard-on-back, a user who fat-fingers "Back" loses a multi-field draft with zero recovery path. Flagging as a compounding risk with M5 rather than a standalone regression.

---

## LOW

### L1. `AiProviderPanel` tab order doesn't match tab list order
`TemplateSettingsPage.tsx:637` initializes `tab` state to `'CLAUDE'`, but the rendered tab buttons list OpenAI first, then Claude, then NVIDIA (`:694-708`). Default selection doesn't match visual first position — minor mismatch between initial state and reading order, easy to miss on first load ("why is the second tab highlighted").
**Recommendation:** Either default to `'OPENAI'` to match first-in-list, or reorder the buttons so Claude is first, matching the default.

### L2. `ProviderTabButton` selected state uses `shadow-sm` (TemplateSettingsPage.tsx:768)
Same token violation family as H6: `selected ? 'bg-background text-foreground shadow-sm' : ...`. Anti-pattern table explicitly lists `shadow-sm` for rejection.
**Recommendation:** `shadow-sm` → `shadow-resting`.

### L3. Suggestion buttons in empty state have no focus-visible ring
`IrisChatPane.tsx:83-92` — the three `SUGGESTIONS` buttons only style `hover:`, no `focus-visible:ring-2 focus-visible:ring-brand-purple/40 ...`. DESIGN.md requires this on every interactive element with zero exceptions; these are keyboard-reachable buttons on the single highest-priority landing view.
**Recommendation:** Add the standard focus ring utility.

### L4. `Composer` send button has no `focus-visible:` ring either
`IrisChatPane.tsx:177-188` — same gap as L3, on the Send button itself.
**Recommendation:** Add the standard focus ring utility; the text `<input>` above it also lacks a visible focus ring style beyond the wrapper's `focus-within:ring-2 focus-within:ring-brand-pink/30` (note: that's brand-pink, not the mandated brand-purple/40 focus token — see L5).

### L5. Composer focus ring uses `brand-pink` instead of the mandated `brand-purple/40` focus token
`IrisChatPane.tsx:167` — `focus-within:ring-2 focus-within:ring-brand-pink/30`. DESIGN.md's Focus Ring spec (§2) is explicit and universal: `focus-visible:ring-brand-purple/40`, "Purple-tinted, not blue [or pink]." This is a deliberate-looking but non-compliant choice — the composer is arguably the single most-used control in the product.
**Recommendation:** Change to the standard token, or if a founder-approved exception exists for the composer specifically, document it in DESIGN.md so a future EL/UX pass doesn't re-flag it.

### L6. No `aria-live` region for Iris's "thinking" / new-message announcements
`IrisChatPane.tsx:139-141` "Iris is thinking…" and incoming replies are visual-only; a screen-reader user gets no announcement that a response arrived. Not in the explicit task checklist but is a standard chat-accessibility baseline.
**Recommendation:** Wrap the transcript container (or a dedicated status region) in `aria-live="polite"`.

---

## Explicitly checked and clean

- **Token grep on the six target files + WhatsAppTemplatePreview**: no hardcoded hex, no `rounded-sm`/`rounded-3xl`, no `text-gray-*`/`bg-slate-*`. Only violations found are the two `shadow-sm` instances logged as H6/L2.
- **One-action rule**: `IrisConfirmPanel` and `TemplateBuilderForm` each carry exactly one `bg-brand-pink` primary action per view; secondary actions correctly use outline/bordered styling. No competing pink CTAs found.
- **ConsequenceLine usage**: present and correctly scoped in `IrisChatPane` (setup banner), `IrisConfirmPanel`, `TemplateStudioPage`, `TemplateSettingsPage` — matches DESIGN.md §6 pattern, not hand-rolled.
- **StatusIndicator usage**: `TemplateSettingsPage.tsx` quality/status rendering goes through the shared `StatusIndicator` component, not a hand-rolled pill — no `bg-x/10 text-x rounded-full` anti-pattern found in these files.
- **Docked confirm pattern**: `IrisConfirmPanel` correctly uses the DESIGN.md §5 "Inline Review Panel" pattern (border-l docked beside content) rather than a Modal — this is the one case DESIGN.md explicitly carves out as *not* a Modal violation, and it's implemented as specified.
- **Mobile stacking for the settings phone table**: `TemplateSettingsPage.tsx` correctly ships a `hidden md:block` table + `md:hidden` card-stack fallback — genuine mobile-first handling, no `overflow-x` table dumped onto small screens.

---

## Priority read-out for the founder

The two most consequential gaps relative to a ChatGPT/Claude bar are **C1 (no virtualization)** and **C3 (no cancel + composer lock during thinking)** — both will produce visible, embarrassing failures the first time a real user has a long Iris session or hits a slow LLM provider, which given BYOK NVIDIA/OpenAI/Claude is not a hypothetical. **C2 (unbounded session list)** is a slower-burning version of the same problem. **H4 (no Shift+Enter, no textarea at all)** is the starkest single gap against the specific bar named in the brief — the chat composer cannot do multi-line input today, full stop. **H6/L2 (shadow-sm)** are the only hard DESIGN.md token violations found across all six files and should be trivial one-line fixes.
