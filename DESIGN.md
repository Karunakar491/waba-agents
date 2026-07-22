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
2. **Navy is the frame, never the field.** `brand-navy` lives in exactly two places: the sidebar, and the *status emphasis band* — a single full-width `bg-brand-navy` strip (max `py-3`, white `text-sm` + status dot) at the top of a detail page showing live/paused/draft state. One per page maximum. Content areas are quiet (white/card). Navy anywhere else dilutes identity into admin-theme.
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
| Radius | 8px (`rounded-lg`) standard, 12px (`rounded-xl`) cards | |
| Shadow | `shadow-sm` only | Subtle. Never heavy drop shadows |

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
- Cards: `rounded-xl border bg-card p-6 shadow-sm`
- Inputs: `rounded-lg border bg-background px-3 py-2.5 text-sm` + focus ring `focus:ring-2 focus:ring-primary/50`
- Modals: max 560px wide on desktop

---

## 5. Interaction baseline — the testable checklist

Every screen MUST pass all of these before it ships. The UX gate checks each item explicitly.

```
[ ] Loading state for any operation > 300ms (spinner or skeleton — no dead buttons)
[ ] Empty state with a call to action (never bare "No data")
[ ] Error state inline, next to where it went wrong (not toast-only)
[ ] Disabled controls are always explained (inline validation message — never a silently dead button)
[ ] Primary action obvious in < 2s; exactly one brand-pink CTA per section
[ ] Button labels are verb + noun ("Create agent", not "Submit")
[ ] Works at 375px width (or has an explicit, approved desktop-only justification)
[ ] Transitions and animations ≤200ms ease-out; no ambient/entrance motion
[ ] One saturated accent (brand-pink) per viewport; navy only in sidebar + status band (§0 moves 2, 5)
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
