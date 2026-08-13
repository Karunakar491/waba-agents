# WABA Agents — Design System
### V2 — Modern Minimal

---

## 0. Philosophy — The Feel

Not Apple's HIG. Apple designs consumer OS apps (Mail, Photos) — this is a
multi-tenant B2B tool with account switching, dense tables, and credential
management. Wrong category, wrong bar.

The actual benchmark, one company per dimension:

- **Vercel** — density without clutter
- **Stripe** — clarity
- **Linear** — restraint as confidence
- **WhatsApp** — chat familiarity; don't reinvent what people already know
- **Claude / ChatGPT** — specifically for Iris's navigation pattern (session
  history, new-chat, search)

One saturated accent color, used sparingly, doing double duty as the
positive-status color. Neutral everywhere else. If a screen needs a second
loud color to feel finished, the first one isn't being used with enough
restraint.

### 0.1 Responsive Breakpoints

Deprioritized by explicit decision — users are laptop-based. Build for
desktop; don't spend budget on mobile layouts unless told otherwise.

---

## 1. Tokens — Change Once, Change Everywhere

Every color, spacing value, and font size a screen uses should trace back to
a named token, not a typed-in number. If a value doesn't have a name, it's a
guess, not a decision.

---

## 2. Color Tokens

**One accent hue only.** Not two, not three. The previous version of this
system used navy + pink + purple simultaneously — three saturated colors
competing for attention, and a navy/pink pairing that read as tonally
confused (navy signals enterprise-serious, pink signals consumer-playful).
Replaced entirely.

| Token | Hex | Contrast (vs white) | Role |
|---|---|---|---|
| `ink` | `#0A0A0A` | — | Nav rail / dark chrome only. Never body text. |
| `foreground` | `#18181B` | 17.7:1 | Primary text. |
| `background` | `#FAFAFA` | — | Page background. |
| `card` | `#FFFFFF` | — | Surfaces, table backgrounds. |
| `muted` | `#F4F4F5` | — | Subtle fills — inputs, segmented-control track. |
| `muted-fg` | `#71717A` | 4.83:1 | Secondary/caption text. |
| `border` | `#E4E4E7` | — | Dividers, default borders. |
| `accent-teal` | `#0D9488` | 3.74:1 | Icons, dots, low-opacity tints. **Non-text only.** |
| `accent-teal-solid` | `#0F766E` | 5.47:1 | Text, links, buttons, badges. AA-safe. |
| `destructive` | `#DC2626` | 4.83:1 | Errors, Rejected status. |
| `warning` | `#D97706` | 3.19:1 | Pending status. **Dot only, non-text.** |

**Why teal:** a deliberate, subtle nod to WhatsApp's heritage — not a copy of
its bright `#25D366`, but the same teal-green lineage, tuned for a calmer,
more considered feel.

**Hard rule:** `accent-teal` and `accent-teal-solid` are not interchangeable.
Text and solid-fill-with-white-text situations must use `-solid` — the
lighter shade fails AA at normal text size (4.09:1, below the 4.5:1
threshold). This isn't a style choice, it's a contrast requirement.

Contrast is **computed**, never eyeballed. 4.5:1 for text, 3:1 for
non-text/graphical elements (icons, dots, focus rings).

---

## 3. Spacing — Strict 4px Grid, No Exceptions

Every `padding`, `itemSpacing`, and gap value must be a multiple of 4.

This was audited directly against the built file: 860 of 2,418 checked
spacing values were off-grid (7px, 9px, 5px, 3px, 11px, 13px — hand-picked
to "look about right" instead of snapped to a scale). All fixed. Zero
tolerance going forward — this is exactly the kind of discipline that
separates a considered system from one that was eyeballed, and it's fully
within a static design tool's power to get right every time.

Standard scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

---

## 4. Typography

Inter. A deliberately tight scale — restraint, not variety, is the actual
signal of a considered system (this is what Stripe/Linear are known for).
Two H1 sizes exist on purpose, not by accident:

| Tier | Size / Weight | Usage |
|---|---|---|
| Hero | 28px Semi Bold | Once-per-session greeting only (e.g. Module Selector). |
| Page Title | 24px Semi Bold | Every repeated utility screen — Templates, Settings, Debug. |
| Section Heading | 20px Semi Bold | Empty states, card headings, modal/panel titles. |
| Body | 13px Regular | Default paragraph, table cells, input values. |
| Emphasis / Interactive | 13px Medium | Buttons, links, active nav state. |
| Caption | 11px Medium, +6% tracking, `muted-fg` | Table headers, filter group labels. Always uppercase. |

**Numeric figures**: any number in a scannable list — quality scores, counts,
dates, stats — uses tabular figures so digits align in a column. Prose
numbers stay proportional.

Adding a new size below this table requires a stated reason — same bar as
adding a new component pattern.

---

## 5. Base Layout

### Nav Rail
- Gradient chrome: `ink` fading to near-black, not a flat fill. This is
  where brand identity concentrates, precisely because everything else
  stays restrained.
- **Collapsible, not fixed** — this was already a considered decision in
  the underlying code, kept as-is: defaults to expanded/labeled (discoverable
  for a first-time, non-technical user), collapse is opt-in and persisted.
  Hover-to-peek when collapsed.
- **Override**: the rail always force-expands on the Iris route regardless
  of the collapsed preference — session history must stay visible. The one
  place user preference is overridden by context.
- Expanded width ~260px (full nav items with labels + nested session list on
  Iris). Collapsed width 80px (icon-only).

### Command Bar — Scope Switchers
Client switcher and Module switcher live in the same navy bar as pills,
divided by a 1px hairline, opening the same overlay/search interaction
pattern — one mental model for every cross-cutting scope switch, not one
per switcher. Dropdown rows: colored dot (swatch, never a Badge component) +
plain text + optional status word (Current / New / Not enabled).

---

## 6. Component Patterns

Same pattern = same component. Check this list before building anything new.

**Buttons** — Primary (`accent-teal-solid`, one per section) / Secondary
(outline) / Ghost (text-only, low-emphasis actions) / Destructive (red,
confirm via Modal first). All four need Default/Hover/Pressed/Disabled
states defined, not just Default.

**Cards** — generic container, header/body/footer slots all optional.

**Tables** — caption-style uppercase headers (11px Medium, +6% tracking).
Rows: 13px Regular, 1px border-bottom, no zebra striping. Hover state
required (`muted` tint across the full row) — a table with only a resting
state isn't done.

**Tabs vs. Segmented Control** — two different patterns, not
interchangeable: **Tabs** (underline-style) for switching between full page
sections. **Segmented control** (pill track, `bg-muted` + raised selected
segment) for switching between a small closed set of equivalent options
inline (e.g. AI provider: OpenAI/Claude/NVIDIA). If Meta's own category
tabs (Marketing/Utility/Authentication) ever get rebuilt, they're the
underline Tabs variant, matching how they behave as page-level navigation.

**Form controls** — Select, Toggle, Checkbox, Radio (option card: border
only when unselected, border + subtle tint when selected — never border
alone, that's too weak a signal), Text Input, Textarea (with toolbar +
character counter when it claims to have one — don't describe a feature in
copy without drawing it).

**Filters** — one "Filters" button (with active-count badge), opening a
single panel with grouped sections (Category, Language, Status, Method,
whatever applies) — never scattered individual dropdowns/pills across the
toolbar. Search box stays separate, outside the panel, for free-text fields.
Open-ended data (languages, paths) gets a search+list inside its group;
small fixed enums (category, status, method) get a pill row.

**Modal** — the shared primitive for anything that blocks the whole screen.
Max 640px desktop, focus trap, Escape-to-close, backdrop-dismiss.

**Docked panel — not a Modal.** Anything that needs to stay visible
alongside the content that produced it (Iris's confirm-before-submit,
review steps) docks to one side with a border, full height. This is
deliberate: the user needs to compare the panel against what's still on
screen, which a modal overlay prevents.

**ErrorBanner / ConsequenceLine / Tooltip** — inline error (no shadow,
optional retry), one-line consequence statement per screen with real
stakes, brief hover context for icon-only controls or disabled-state
reasons.

**Badge/Pill vs. StatusIndicator** — distinct. StatusIndicator is always
dot + plain label, no background tint, used for status semantics
(Approved/Pending/etc). Badge/Pill is a separate primitive for counts and
short flags ("New", a count circle) — has its own tinted background because
it isn't describing a status, it's flagging an item.

**Stepper** — numbered circles + connecting line, for genuine multi-step
flows only. Don't invent a wizard where a flat form is correct.

*Revised mid-project, 2026-08.* The template **Create** flow uses a 3-step
Stepper (Set up template / Edit template / Submit for Review). This is not
a free reskin of the old single-page form — Figma's redesign is making a
real structural argument: name+category+language, the editable content,
and the final review-before-submit are three genuinely distinct decisions,
each with its own point of no return, and collapsing them into one scroll
hid that. The **Edit** flow stays a flat single-page form with a live side
preview, deliberately — once a template exists, Meta locks name, category,
and language for its lifetime (see Authentication's fixed body/button
shape, which is similarly locked and never offered a stepper), so there is
nothing left to sequence. A stepper on Edit would manufacture steps where
none exist.

*Second real use, 2026-08.* The **Create Agent** flow is a 7-step Stepper
(Basics / Business Persona / Knowledge Base / Skills / Connectors / Evals /
Test & Deploy). It qualifies under the same test the template Create flow
did, not by analogy to it: each step is a genuinely different decision with
its own point of no return — which number this agent owns (binding is
exclusive), how it sounds, what it knows, what it's allowed to do, what
real systems it can reach, whether it actually performs, and whether it
goes live. Collapsing them into one form would hide those boundaries, and
the last one — the enable toggle — is the only irreversible-feeling moment
in the product. Edits to an existing agent stay flat tabs on the agent
detail page, for the same reason template Edit does: once the agent exists
there is nothing left to sequence.

This is the rule now, not a one-off exception bolted on top of the old
blanket rule. When a Figma redesign changes how a pattern in this document
should be used, that change gets written into the document itself, in the
same pass as the code that implements it — not left as a footnote appended
after the fact, and not left for someone to notice the drift later and ask
why the code and the doc disagree.

**IconChip** — flat tinted square (`bg-accent-teal` at ~14% opacity), icon on
top at full color. Two sizes. Never a gradient, never a shadow. **Never for
empty states** — an empty state renders a live-preview/next-action instead
of a centered icon. This was already the rule before this rewrite; it just
wasn't being followed.

**Empty states** — asymmetric, never centered-icon-plus-heading (that's the
generic Shadcn/Tailwind default, and it's on the anti-pattern list). A left
accent bar instead of a centered icon, left-aligned copy, a real primary CTA
plus a locked/muted preview of what's coming if relevant.

**Skeleton loading** — muted-color bars matching the real content's shape
and column widths, not a generic spinner, for anything that takes a
noticeable moment to load (a table, a job status).

**Scroll affordances** — for any list or conversation that can overflow: a
top fade (card-color to transparent) signaling more content above, and a
floating scroll-to-bottom button once the user has scrolled up. Neither
existed before this session; both are now required for any scrollable
message/list surface.

**Live-preview snippet** — a required identity primitive, not decoration.
Any card representing "what a message/template will actually look like"
renders the real preview (chat bubble, WhatsApp bubble), never a decorative
abstraction (dots, gradients standing in for content). If the surrounding
copy says "here's a preview," there must be an actual preview under it.

### WhatsApp Template Preview

The one component every template-adjacent surface reuses: Create/Edit form,
Iris draft cards, Iris confirm panel. Must render all of:

- **Header formats**: None, Text, Image, Video, Document (icon + filename,
  no thumbnail)
- **Button types**: Quick Reply (stacked, divider between each button after
  the first — not just spacing), Call-to-Action/URL, Call Phone Number,
  WhatsApp Flow, Copy Code (Authentication)
- **Mixed buttons** — up to 3 combined (e.g. one CTA + Quick Replies together)
- **Carousel** — horizontally-scrolling cards, each with its own
  image+body+button; the preview must show a genuine partial peek of the
  next card, not exactly-fitting cards with nothing implying more exist
- **Authentication/OTP** — body is the code slot only, no header/footer,
  single Copy Code button

WhatsApp's own header teal (`#075E54`) is used for the phone-preview chrome
specifically — distinct from the product's own `accent-teal-solid`, so the
simulated device never gets confused with the app's own UI.

### Iris-Specific Patterns

**Draft Snapshot Card** — inline in the chat, not a side panel, every time
Iris drafts or updates a template. Compact WhatsApp preview + a
"Draft started" / "Draft updated — [changed fields]" label. One-shot
highlight ring on mount when something changed from the previous snapshot,
then it clears — never an ambient/looping highlight.

**Confirm Panel** — docked right, appears only at the real submission
moment (create_template / edit_template / send_test), never earlier. Full
preview + Name/Category/Language chips + an explicit "this cannot be undone"
warning + Submit/Cancel. This is the actual gate before anything reaches
Meta — a chat message that just says "Submitted" without this panel
appearing first is a broken flow, not a shortcut.

**Session sidebar** — New Chat + Search + **5 most recent sessions** + a
"View all chats" link (only past 5). A dedicated All Chats page groups by
Today / Yesterday / Previous 7 days / Older, with its own search. Showing
every session unfiltered in the rail is not acceptable past 5.

---

## 7. Voice & Copy

Audience: a business owner who is not technical, setting up something they
don't fully understand.

- Plain words. "Connect your number," never "Provision integration."
- Explain consequences. "Nothing goes live until you confirm."
- Errors say what to do next, not what failed internally.
- No jargon, no API terminology in user-facing copy.
- No exclamation marks. Confidence is quiet.
- "You" and "your" — the product is talking to a person.
- Never describe a feature in copy (a toolbar, a counter, a warning) that
  isn't actually drawn on screen. If the words promise it, the screen shows
  it.

---

## 8. Screen Intelligence — The Thinking Layer

Before building any screen, answer in a comment block:

```
/**
 * Screen: [PageName]
 *
 * 1. USER GOAL: What does the user want to accomplish here?
 * 2. EMOTIONAL STATE: What might they be feeling?
 * 3. POSSIBLE ACTIONS: Primary, secondary, escape hatches, undo paths.
 * 4. HOW WE HELP: Reassurance, preview, progress, plain language, smart
 *    defaults, inline validation, next-step suggestion.
 */
```

Anticipate, don't react. State is a story, not a status code. The output is
always present (live preview, not a hidden result). One breath per screen —
don't cram two decisions into one view. Smart defaults, not blank slates.
Progress is visible. Undo is a feature. Contextual help, not documentation.

---

## 9. Definition of Done — The Benchmark

A pass here means *checked*, not *perfect*. The failure mode is skipping the
check, not occasionally missing something the check would've caught.

1. **Consistency** — checked against `wiki/decisions/design-evaluator-anti-patterns.md`
   before shipping. Not a vibe check.
2. **Accessibility** — WCAG contrast actually computed (4.5:1 text, 3:1
   non-text), not eyeballed. Every interactive element has a defined focus
   state.
3. **Defined states** — hover / pressed / focus / disabled / loading /
   error specified for every control. A screen or component with only a
   resting state isn't done.
4. **Stress-tested content** — proven against real data shape: long names,
   zero-state, many-language accounts, large lists (500+ rows), RTL text.
   Not just clean example rows.

Known anti-patterns already caught once in this system, worth never
repeating:
- Centered-icon-and-heading for empty states
- Hardcoded lists for genuinely open-ended data (languages, paths) instead
  of a dynamic, searchable set scoped to what actually exists
- Mixed vocabulary within one column (e.g. "Green" and "High" both meaning
  quality in the same field) — one vocabulary per field, always
- Skeleton-style flat gray bars used as decorative filler instead of an
  actual live-preview snippet

---

## 10. Identity — Karix DNA

Dots, lines, and connection. This shows up in exactly one place with real
weight: the nav rail's gradient + a quiet dots-and-lines mark low in the
rail. Not repeated as decoration elsewhere — concentrating it in the one
piece of chrome that's always visible is what keeps it a signature instead
of noise.

---

## 11. Known Gaps — Not Yet Built

Stated plainly rather than silently skipped:

- **Dark mode** — not designed in this version. First-class in both Stripe
  and Vercel's own products; genuinely absent here.
- **Motion/interaction spec** — hover/press feedback, transition timing,
  none of it is specified. A static design tool can describe intent but
  can't prove the feel.
- **Mobile/responsive** — explicitly out of scope per the laptop-first
  decision, not an oversight.
- **Real device/API behavior** — Meta's exact template validation rules,
  live WhatsApp rendering, actual carousel swipe physics. Everything here
  proves design *intent*; none of it is a substitute for testing against
  the real API and a real device.