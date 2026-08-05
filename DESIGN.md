# DESIGN.md
## Meta Business Agent Platform — Design System

> Single source of truth for every visual and interaction decision.
> If a screen doesn't follow this document, it doesn't ship.
> The UX gate reviews against the checklists here — in whole-app context, never a lone diff.

---

## For AI agents: how to apply this document

You are generating UI for this product. Before writing any component:

1. Read §0 and hold the mood in mind — every choice (spacing, color weight, copy) either supports "calm and trustworthy" or fights it.
2. Use ONLY token classes from §1-2. If you are about to type a `#hex`, a font name, or a raw px radius — stop, find the token, or propose a new token in §2 first.
3. Match an existing pattern from §6 before inventing anything. Same problem = same component.
4. Self-check against the §5 checklist before submitting. Every unchecked item is a rejection waiting to happen.
5. When this document and your training-data aesthetic disagree, this document wins. Default Shadcn/Tailwind looks are the "generic AI" feel we explicitly reject.

---

## 0. Visual theme & mood

**The feel:** A calm, confident operations desk. The user is a stressed, non-technical business owner setting up something they don't fully understand — the interface must feel like a competent assistant who has done this a thousand times.

### Signature moves (positive, buildable — this is our point of view)

1. **The agent is always visible.** The live conversation preview — the agent speaking as a real WhatsApp chat — is the product's identity element. Scope: screens that shape agent behavior (wizard steps, agent edit, test, publish). Fallback where no agent exists yet (pre-first-agent, WABA connect, settings, billing): show a next-action prompt, never a bare empty state. No admin template has this; it is the reason our screens can't be mistaken for one.
2. **Navy is the frame, never the field.** `brand-navy` lives in two tiers, not two places (amended 2026-08-06 for the Client Command Bar — see changelog):
   - **Global chrome navy** — the sidebar and the Client Command Bar (§6) are ONE continuous frame system, always paired, always present on every screen. They read as a single navy "frame" wrapping the app (sidebar = vertical edge, Command Bar = horizontal edge directly beneath the topbar), never as two competing surfaces — same visual weight, same `py-2`-scale restraint, no gap/border seam implying they're unrelated elements.
   - **Per-page status band** — a single full-width `bg-brand-navy` strip (max `py-3`, white `text-sm` + status dot) at the top of a detail page showing live/paused/draft state. Content-level, opt-in, **one per page maximum** — this cap is unchanged.
   - Content areas stay quiet (white/card) regardless. Navy anywhere else (a card, a table row, a modal) still dilutes identity into admin-theme and is still a BLOCK. The amendment widens WHERE global chrome is allowed to live (frame ⊃ 2 elements now, not 1) — it does not loosen the content-vs-chrome rule itself.
3. **One sentence of reassurance per screen.** Every screen with consequences carries one plain-language consequence line as a layout slot, not an afterthought: "Nothing goes live until you deploy." Render via the ConsequenceLine pattern (§6). This is the calm made visible.
4. **A named status language.** live / paused / draft render exactly one way everywhere: `brand-green` dot (pulse only for live) + plain sentence ("Live on WhatsApp since Tuesday"). Never badges-of-many-colors.
5. **Chrome whispers, content speaks.** App chrome (nav, headers, toolbars) never exceeds `text-sm` and stays desaturated; exactly one saturated accent (`brand-pink`) per viewport. Density: 4px spacing rhythm, airy but purposeful — Linear's restraint expressed as numbers, not aspiration.

### Anti-patterns — the "AI-generated app" tells (automatic evaluator BLOCK)

- Lucide icon in a rounded gradient/solid square as a "logo" — use the wordmark treatment: "Meta Agents" set in Inter 600 `text-lg tracking-tight text-white`, no icon container; collapsed rail shows "MA" in the same weight, not an icon
- Icon+label sidebar with avatar footer straight from a template, unmodified by the signature moves
- Centered card with a big icon as an empty state (empty states show the agent preview or a next action)
- Breadcrumb chevrons pointing at nothing; decorative separators with no destination
- Default Shadcn look with tokens merely swapped in — if slate→navy is the only difference, it's a BLOCK

**Mood guardrails:**

| Do | Don't |
|---|---|
| Generous whitespace; let one action breathe | Dense dashboards, competing CTAs, decoration |
| Quiet surfaces (white/card), color only for meaning | Gradients, glassmorphism, heavy shadows |
| Plain confident copy ("Your agent is live") | Hype ("Supercharge!"), jargon, exclamation spam |
| Motion only as feedback (≤200ms, ease-out) | Ambient animation, parallax, attention-seeking |
| Familiar patterns (wizard, cards, inline errors) | Novel interactions the user must learn |

Reference bar: Linear's restraint, Stripe's clarity, WhatsApp's familiarity — executed via the signature moves above, never invoked as vibes.

---

## 0.1 Responsive breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile (baseline) | 375px+ | Single column. Sidebar = off-canvas drawer. Every screen MUST work here |
| `md` | 768px+ | Sidebar becomes static rail (collapsible 240px ↔ 64px). Multi-panel layouts allowed |
| `lg` | 1024px+ | Wizard 3-panel (steps / form / preview) fully visible |
| `2xl` cap | 1400px | Container max — content never full-bleed beyond this |

Design mobile-first: the 375px layout is the design; wider screens are the enhancement.

Container max-width remains `max-w-6xl` (1152px) per §4 — the 1400px `2xl` value is a viewport cap for the Tailwind container utility, not a content-width override.

---

## 1. Where design lives in code (change once, changes everywhere)

| What | The ONE place to change it |
|---|---|
| Colors (brand + semantic) | `frontend/tailwind.config.js` (`theme.extend.colors`) + `frontend/src/index.css` (CSS variables for shadcn semantic tokens) |
| Font family | `frontend/tailwind.config.js` (`fontFamily.sans`) + the font import in `frontend/index.html` |
| Radius scale | `frontend/tailwind.config.js` (`borderRadius`) / `--radius` in `index.css` |
| Dark mode | `index.css` `.dark` block (CSS variables only) |

**Hard rule: components NEVER hardcode hex colors, font names, or px radii.**
Use token classes (`bg-brand-pink`, `text-muted-foreground`, `rounded-lg`). A raw `#hex` or `font-[...]` in a component is an automatic EL REJECT.
Only exception: third-party UI mimicry constants, and those must still be named tokens (see `whatsapp.*` group in tailwind.config.js).

---

## 2. Brand tokens (Karix)

| Token | Value | Use |
|---|---|---|
| `brand-navy` | `#160E7A` | Trust surfaces: sidebar, headers, emphasis |
| `brand-pink` | `#E73590` | THE action color. Primary CTA only — one per section |
| `brand-green` | `#1EBA5D` | Success states, "active/live" status |
| `brand-dark` | `#1F1F1F` | Near-black text on light surfaces |
| Font | Inter 400/500/600/700 | Everything. No other family |
| Radius | 12px (`rounded-xl`) standard — buttons, inputs, chips; 16px (`rounded-2xl`) cards, modals, panels | Softer than the old 8px/12px scale — closer to Apple's current visual language. Never sharp corners, never fully-circular except icon-only controls |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` on every interactive element, no exceptions | Not optional, not a nice-to-have — every button, link, row-action, and form control ships with this class. A REJECT-grade gap found repo-wide in the 2026-08-05 acquisition-grade audit; closing it is part of this radius/token pass, not a separate task |
| Shadow | Two tiers only, tied to surface separation — **never decoration**: `.shadow-surface-resting` for cards/panels/dropdowns (a surface resting on the page — pair with `border`, never shadow alone). `.shadow-surface-lifted` for modals/popovers only (a surface floating above the page). Buttons, chips, inputs, badges, nav items: **no shadow, ever** — flat is the floor. Dark mode: elevation reads via a lighter surface tint (`--card` already lighter than `--background` in `.dark`), not via the shadow color — shadow opacity in dark mode drops to near-zero by design, don't compensate by darkening it further. | Named by role (resting/lifted), never raw `shadow-md`/`lg`/`xl` Tailwind defaults in a component — always the named utility, defined once in `index.css`, enforceable by grep the same way `shadow-sm` was |
| Warning | `warning: #B45309` (amber-700, WCAG AA on white/card) | Dot color + inline warning text/icons only, via `StatusIndicator` — never a tinted pill background, same rule as every other status color |

Semantic tokens (`background`, `foreground`, `muted`, `destructive`, `card`, `border`, …) come from shadcn CSS variables in `index.css`. Prefer semantic over brand tokens for anything that isn't identity or CTA.

---

## 3. Typography scale

| Role | Classes |
|---|---|
| Page title | `text-2xl font-bold text-foreground` |
| Section title | `text-lg font-semibold text-foreground` |
| Body | `text-sm text-foreground` |
| Secondary/help | `text-sm text-muted-foreground` |
| Micro (hints, counters) | `text-xs text-muted-foreground` |

Don't invent sizes between these. If a design needs a new level, add it here first.

---

## 4. Spacing & layout conventions

- Page container: content pages `max-w-2xl`–`max-w-6xl` centered; never full-bleed text
- Vertical rhythm: `space-y-5` / `space-y-6` between form groups, `space-y-8` between page sections
- Cards: `rounded-2xl border bg-card p-6 shadow-surface-resting`
- Buttons: `rounded-xl` — softer, Apple-adjacent, never a sharp corner and never a fully-pill shape except icon-only circular controls; **no shadow**
- Inputs: `rounded-xl border bg-background px-3 py-2.5 text-sm` + `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- Modals: max 560px wide on desktop, `rounded-2xl`, `shadow-surface-lifted`, real focus trap + `role="dialog"` + `aria-modal="true"` + Escape-to-close + backdrop-click-dismiss (see the shared `Modal` primitive in §6 — never a bespoke overlay per screen)

---

## 5. Interaction baseline — the testable checklist

Every screen MUST pass all of these before it ships. The UX gate checks each item explicitly.

```
[ ] Loading state for any operation > 300ms (spinner or skeleton — no dead buttons, and NEVER a blank/`null` render while a fetch resolves — a route guard, an auth check, or a gate component showing nothing is the same violation as a dead button, just less visible; found and REJECT-able as of 2026-08-05, `ProtectedRoute.tsx` returning `null` during entitlement checks)
[ ] Empty state with a call to action (never bare "No data")
[ ] Error state inline, next to where it went wrong (not toast-only)
[ ] Disabled controls are always explained (inline validation message — never a silently dead button)
[ ] Primary action obvious in < 2s; exactly one brand-pink CTA per section
[ ] Button labels are verb + noun ("Create agent", not "Submit")
[ ] Works at 375px width (or has an explicit, approved desktop-only justification)
[ ] Transitions and animations ≤200ms ease-out; no ambient/entrance motion
[ ] One saturated accent (brand-pink) per viewport; navy only in the global chrome frame (sidebar + Command Bar, treated as one) plus at most one per-page status band (§0 moves 2, 5)
[ ] Consequence/reassurance line present on any screen with consequences (§0 move 3)
[ ] Keyboard: Escape closes modals, Enter submits, visible focus states
[ ] ARIA: dialogs get role="dialog" aria-modal, toggles get aria-pressed, errors get role="alert"
[ ] Destructive actions require confirmation
[ ] Navigation state visible (active nav item highlighted; sidebar collapsible, state persisted)
[ ] No user-entered text transformed (no capitalize/uppercase on names or user content)
```

---

## 6. Component patterns (consistency over creativity)

- Same pattern = same component. Before building UI, check `frontend/src/components/` and existing pages for the pattern.
- Nav shell: `components/layout/AppShell.tsx` — collapsible sidebar (localStorage `sidebar-collapsed`), brand-navy, topbar with breadcrumb
- Modals: follow `components/waba/ConnectPhoneModal.tsx` (dialog role, Escape-close, step pattern)
- Wizards: follow `pages/CreateAgentPage.tsx` (steps rail | form | live preview 3-panel)
- Data fetching UI: React Query states → `isLoading` skeleton, `isError` inline retry, success render
- ConsequenceLine (§0 move 3): one per screen with consequences — `text-sm text-muted-foreground` line placed directly under the page title or beside the primary CTA; plain language, states what will/won't happen ("Nothing goes live until you deploy"). To be extracted as a shared component at its third use (three-cases rule)
- `StatusIndicator` (dot + plain text, per §0 move 4): the ONLY way status renders anywhere — `<span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-{state}" />{plain label}</span>`. Never a tinted-background pill (`bg-x/10 text-x rounded-full`). Confirmed as of 2026-08-05 to have been independently reinvented wrong in 11+ places before this was written down as one component — treat any new `STATUS_CONFIG`-shaped object as a signal to import this instead of writing a new one
- `Modal` (shared primitive, per §4): every dialog in the app renders through one component with a built-in focus trap, `role="dialog"`, `aria-modal`, Escape-to-close, and backdrop-dismiss wired once. No screen builds its own `fixed inset-0` overlay from scratch
- `ErrorBanner` (shared primitive): every inline error render — `role="alert"`, `text-sm text-destructive`, no shadow (inline, not a separate surface), optional retry action slot. Wraps `extractErrorMessage` from `lib/errors.ts`. Replaces the copy-pasted error-paragraph markup previously duplicated across 10 files
- `IconChip` (shared primitive, scoped use only): a contained icon in a flat tinted square — **never** for empty states (those render the agent-preview/next-action pattern, §0 anti-pattern list) and **never** as a logo/identity mark (wordmark only, §0 anti-pattern list). Legitimate scope: Dashboard/ModuleSelector feature-highlight tiles, Inbox avatar-style icons. Two sizes only (`h-8 w-8` / `h-10 w-10`), flat `bg-{color}/10` tint, no gradient, no shadow
- **Inline review panel — a second, deliberate confirmation pattern (not a Modal violation).** `PendingActionPreview` in `pages/TemplateIrisPage.tsx` renders a pending tool-call's confirmation (template preview, confirm/cancel) as a `border-l` panel docked beside the chat, not a `Modal` overlay. This is intentional, not an oversight: the confirmation needs to stay visible alongside the conversation that produced it (the user is reading Iris's reasoning while deciding), and Iris's layout is already a fixed two-pane chat — overlaying a modal would hide the very context the user needs to confirm against. Scope: this exact case only (an in-context review step beside a persistent chat pane). Any *other* confirm/cancel dialog in the app still goes through the shared `Modal` — this entry exists so a future audit doesn't flag `PendingActionPreview` as a bespoke-overlay violation and force a migration that would be a UX regression.

### Bento panel — scoped, not a universal layout

For **overview/at-a-glance screens only** (confirmed scope: `DashboardPage`, `ModuleSelectorPage` — do not extend elsewhere without a Design Evaluator pass): a grid of varying-size cards (`grid grid-cols-1 md:grid-cols-3 gap-4`, cards spanning 1-2 columns by content weight) replacing same-size tiles-in-a-row. This is a considered exception, not the app's default layout:

- **Tables, forms, chat, and wizards keep their established recipe (Recipe A-G, see `.claude/skills/ui-pattern-classifier.md`).** Bento is for heterogeneous glance-content (a metric, a status narrative, a shortcut) — never for comparable records that need scanning/sorting/filtering. Forcing bento onto a data table is exactly the "trendy pattern applied for its own sake" the Design Evaluator gate exists to BLOCK.
- Card sizes vary by actual content weight (a 3-line status narrative gets more room than a single stat number) — never a uniform grid dressed up with the word "bento."
- Same radius/shadow/border tokens as every other card — bento changes the grid, not the component recipe.
- Card *content* must render through the existing identity primitives — `StatusIndicator` for any state, an agent-preview snippet where an agent exists, a `ConsequenceLine` where relevant — never card-local, one-off UI invented for the grid. Scoping the layout correctly and then filling it with generic content is still a BLOCK; the grid rule alone doesn't guarantee that.
- Define overflow/underflow before building: a single-card state (e.g. only one metric to show) must not look broken, and a narrative card's content must have a defined max (truncate/line-clamp) rather than silently growing past its span.

---

## 7. Voice & copy

Audience: stressed, non-technical business owner. Time-to-first-value under 3 minutes.

- Plain words. "Connect your WhatsApp number", never "Provision WABA integration"
- Explain consequences: "Nothing goes live until you deploy"
- Errors say what to do next, not what failed internally
- No jargon, no Meta API terminology in user-facing copy

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-22 | Initial version — created after founder feedback: design decisions were scattered, tokens undocumented, UX gate reviewed diffs without app context |
| 2026-07-22 | Added agent guide preamble, §0 visual theme & mood, §0.1 breakpoints table — closes the "no vision" gap; inspired by Google Stitch DESIGN.md spec (VoltAgent/awesome-design-md). Design Evaluator persona added as post-UX gate |
| 2026-08-05 | Radius scale softened (8/12px → 12/16px), mandatory `focus-visible:` ring token added (closes a REJECT-grade repo-wide gap found in the acquisition-grade audit), `StatusIndicator` and shared `Modal` primitive named as required components (closing an 11+-instance pill-badge regression and a 9-modal focus-trap gap), Bento panel pattern added — explicitly scoped to Dashboard/ModuleSelector only, not a universal layout. Pending Design Evaluator gate. |
| 2026-08-05 | Roadmap item 41 (misc cleanup): removed tinted icon-in-square from WabasPage/AgentsPage empty states (was the exact §0 anti-pattern despite already having a CTA), Inbox empty state got a "Go to Agents" CTA it was missing, `h-screen`→`h-dvh` on AppShell (mobile viewport-jump fix), global `text-wrap: balance` added for h1/h2/h3. `PendingActionPreview` inline review panel documented in §6 as a deliberate second confirmation pattern beside `Modal`, not a violation — migrating it to an overlay would hide the chat context it needs to be judged against. |
| 2026-08-05 | Shadow rule replaced: flat `shadow-sm` → two named tiers (`shadow-surface-resting`/`shadow-surface-lifted`) tied to surface separation, never decoration — buttons/chips/inputs/badges/nav get no shadow at all. Glassmorphism considered and explicitly rejected this session (stays banned per §0). `warning` color token (`#B45309`) added for `StatusIndicator`'s warning dot, replacing raw `yellow-500`/`amber-*` at 4 sites. Shared `ErrorBanner`, `TableSkeleton`, `TableEmptyState`, `IconChip` primitives added to §6 (IconChip scope-limited: never empty states, never identity marks). UX + Design Evaluator both PASSED (Design Evaluator: cross-screen check found §4's card recipe still hardcoded `shadow-sm` — fixed in the same pass, not left to drift). Dark-mode elevation now reads via `--card` surface-tint step-up, not shadow darkening. |
| 2026-08-06 | §0 move 2 amended for the Client Command Bar (roadmap item 45): navy split into "global chrome navy" (sidebar + Command Bar, one continuous always-present frame, not two competing surfaces) and "per-page status band" (content-level, opt-in, one-per-page cap unchanged). Design Evaluator's first review correctly BLOCKed the original spec for stacking three navy zones (sidebar + bar + a detail page's own band) against the old single-surface rule — this amendment is the founder's explicit, recorded resolution, not a quiet workaround. Content-vs-chrome discipline itself is unchanged: navy still never appears on a card/table/modal. |
