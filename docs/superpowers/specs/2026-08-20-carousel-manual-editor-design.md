# CAROUSEL Support in Manual Template Studio Editor

Status: Approved by founder 2026-08-20. Addresses TASKS.md #12.

## Problem

The manual (non-Iris) Template Studio editor has no CAROUSEL support. `KarixComponent`
has no `cards` field, `seedFromComponents()` silently drops a CAROUSEL component when
loading an existing template into the editor, and the builder/save path can't construct
one. Opening a real CAROUSEL template (e.g. one created via Iris) in the manual editor
and clicking Save silently strips the carousel down to a flat template — a real data-loss
risk for any operator who edits one by hand.

Related, found while auditing the same Figma reference sheet (`4.11 — WhatsApp Preview
Variants`, file `EJ0MBZNIT1xqdE9tnCPSwH`, node `115:2`) against the current
`WhatsAppTemplatePreview.tsx`: button rows render as plain text with no per-type icon,
unlike every button variant shown in Figma. Folded into this round as a small,
presentation-only addition. (A separate gap found in the same audit — WhatsApp Flow
buttons don't exist anywhere in the model or backend tool schema — is explicitly
out of scope; filed as TASKS.md #15 instead.)

## Non-goals

- WhatsApp Flow buttons (TASKS.md #15, new feature, own gate sequence).
- Real IMAGE/VIDEO/DOCUMENT header thumbnails (TASKS.md #13, separate task).
- Any backend change — `TemplateRequest.components` is already a passthrough
  `List<Map<String,Object>>`, and Iris already builds valid CAROUSEL components
  server-side (`TemplateStudioToolProvider`). This is a frontend-only gap.

## Data model (`templateModel.ts`)

- `KarixComponent.cards?: KarixComponent[]` — each card is itself a components list
  (`{components: [...]}`), reusing the existing `KarixComponent` shape recursively.
- New `CarouselCardDraft { headerHandle: string; bodyText: string; buttons: ButtonDraft[] }`.
- `seedFromComponents()` gains a `CAROUSEL` branch:
  - Sets `carouselEnabled = true`.
  - Derives the shared shape from `cards[0].components`: `carouselHasBody` (BODY present),
    `carouselHasButtons` (BUTTONS present), header format (always IMAGE or VIDEO per Meta).
  - Maps every card into a `CarouselCardDraft`.
- Existing non-carousel components no longer trigger this branch; behavior for all
  other template types is unchanged.

## State & save (`useTemplateBuilder.ts`)

New state:
- `carouselEnabled: boolean`
- `carouselHeaderFormat: 'IMAGE' | 'VIDEO'`
- `carouselHasBody: boolean`, `carouselHasButtons: boolean` — set once, from card 1,
  then locked (read-only on cards 2+) for the lifetime of the editing session.
- `cards: CarouselCardDraft[]` — starts at length 2 the moment `carouselEnabled` flips
  true (Meta's minimum), user can add up to 10, remove down to 2.

Behavior:
- Enabling CAROUSEL hides the top-level Header and Buttons sections in the form (their
  state is preserved but not shown or submitted) — the top-level BODY field stays
  required and visible, since Meta requires it as a separate component alongside CAROUSEL.
- `buildComponents()` adds a `{type: 'CAROUSEL', cards: [...]}` component built from the
  locked shape plus each card's own values, in addition to the top-level BODY component.
- `canSubmit` additionally requires: `cards.length` between 2 and 10, and every card's
  `headerHandle` present (IMAGE/VIDEO header is mandatory per card, per Meta).

## New UI — `builder/CarouselEditor.tsx`

- A toggle section ("Add carousel") placed where the Header section sits today, following
  the same pattern as the existing `LimitedTimeOfferEditor` toggle. Turning it on hides
  Header/Buttons per above.
- Card 1 doubles as the shape editor: header format select (Image/Video only), a "Include
  body text" toggle, a "Include buttons" toggle.
- Cards 2-10 render as stacked collapsible panels ("Card 1", "Card 2", ...), each reusing
  `HeaderEditor`'s existing upload control (restricted to Image/Video) for its own image,
  plus body text and buttons *only if* card 1 turned those on — not independently
  toggleable on cards 2+.
- "Add card" (disabled at 10) / remove-card control per panel (disabled at 2 total).

## Preview (`WhatsAppTemplatePreview.tsx`)

- New CAROUSEL branch matching the Figma reference bubble: top-level body text as the
  intro line, followed by a horizontally-scrollable row of card tiles (image thumbnail +
  short text + one button label per card), mirroring node `117:34` in the Figma file.
- This component is shared with `IrisDraftSnapshotCard`, so Iris-authored carousel drafts
  also render correctly in their confirm-panel preview as a side effect — no separate
  change needed there.
- Additionally (folded into this round, presentation-only): every button row gains a
  small icon before its label — `ExternalLink` for URL, `Phone` for PHONE_NUMBER, no icon
  for QUICK_REPLY/COPY_CODE — matching every button variant shown in the same Figma sheet.
  No model or backend change.

## Testing

- Unit tests: `seedFromComponents` CAROUSEL round-trip (components in → draft state out),
  `buildComponents` shape-locked card output, `canSubmit` card-count bounds (1 card fails,
  11 cards fails, missing header handle on any card fails).
- Manual smoke test: open the existing `strawberry_carousel_v5` template (created live via
  Iris, referenced in TASKS.md #12) in the manual editor, confirm cards now populate
  instead of showing "Header: None", confirm Save round-trips without stripping cards.

## Gate sequence

Frontend gate sequence per CLAUDE.md applies in full: PM → EM → Worker → UX →
Design Evaluator → EL → QA automated → QA advisory → commit → knowledge-index update →
memory write.
