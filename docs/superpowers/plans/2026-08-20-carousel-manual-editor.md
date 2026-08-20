# CAROUSEL Manual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CAROUSEL create/edit/preview support to the manual (non-Iris) Template Studio editor, closing the data-loss risk where opening and saving an existing CAROUSEL template silently strips its cards. Add per-button-type icons to the shared WhatsApp preview component.

**Architecture:** Pure frontend change. `templateModel.ts` gains a `cards` field on `KarixComponent` and a `CarouselCardDraft` type; `seedFromComponents`/`useTemplateBuilder` gain carousel state, a per-card media-upload mutation, and CAROUSEL component construction; a new `CarouselEditor.tsx` renders the toggle + card-1-defines-shape + stacked card panels; `WhatsAppTemplatePreview.tsx` gets a CAROUSEL render branch (shared with Iris's draft-confirm card) plus per-button-type icons. No backend changes — `TemplateRequest.components` already passes through arbitrary component shapes, and Iris already builds valid CAROUSEL components server-side.

**Tech Stack:** React 19, TypeScript, TanStack Query (`useMutation`), existing `lib/api.ts` axios client, Tailwind + existing design tokens, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-20-carousel-manual-editor-design.md`

**Testing note:** This frontend codebase has no test runner configured anywhere (no vitest/jest, zero existing `.test.tsx` files). Per founder decision, this plan uses manual smoke-testing against the dev server only — no new test framework is introduced as a side effect of this feature.

---

### Task 1: `templateModel.ts` — types and seed/round-trip logic

**Files:**
- Modify: `frontend/src/components/templatestudio/templateModel.ts`

- [ ] **Step 1: Add the `cards` field to `KarixComponent` and the `CarouselCardDraft` type**

Add `cards` to the `KarixComponent` interface (around line 32-43) and a new exported type right after it:

```typescript
export interface KarixComponent {
  type: string
  format?: string
  text?: string
  example?: {
    header_handle?: string[]
    body_text?: string[][]
    body_text_named_params?: Array<{ param_name: string; example: string }>
  }
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string; example?: string | string[] }>
  limited_time_offer?: { text?: string; has_expiration?: boolean }
  cards?: Array<{ components: KarixComponent[] }>
}

export type CarouselHeaderFormat = 'IMAGE' | 'VIDEO'

export interface CarouselCardDraft {
  headerHandle: string
  mediaError: string | null
  bodyText: string
  buttons: ButtonDraft[]
}
```

- [ ] **Step 2: Extend the `seedFromComponents` return shape and add the CAROUSEL branch**

Modify the `seed` object literal (around line 129-140) to add the new fields, and add a new `else if` branch to the `for (const c of components)` loop (around line 141-171):

```typescript
export function seedFromComponents(components: KarixComponent[]) {
  const seed = {
    headerFormat: 'NONE' as HeaderFormat,
    headerText: '',
    headerHandle: '',
    bodyText: '',
    bodyExamples: {} as Record<string, string>,
    footerText: '',
    buttons: [] as ButtonDraft[],
    ltoEnabled: false,
    ltoText: '',
    ltoHasExpiration: false,
    carouselEnabled: false,
    carouselHeaderFormat: 'IMAGE' as CarouselHeaderFormat,
    carouselHasBody: true,
    carouselHasButtons: true,
    cards: [] as CarouselCardDraft[],
  }
  for (const c of components) {
    if (c.type === 'HEADER') {
      seed.headerFormat = (c.format as HeaderFormat) || 'TEXT'
      if (c.format === 'TEXT') seed.headerText = c.text || ''
      else if (c.format !== 'LOCATION') seed.headerHandle = c.example?.header_handle?.[0] || ''
    } else if (c.type === 'BODY') {
      seed.bodyText = c.text || ''
      if (c.example?.body_text_named_params) {
        for (const p of c.example.body_text_named_params) seed.bodyExamples[p.param_name] = p.example
      } else {
        const vars = extractVariables(seed.bodyText)
        const examples = c.example?.body_text?.[0] || []
        vars.forEach((v, i) => { seed.bodyExamples[v] = examples[i] || '' })
      }
    } else if (c.type === 'FOOTER') {
      seed.footerText = c.text || ''
    } else if (c.type === 'LIMITED_TIME_OFFER') {
      seed.ltoEnabled = true
      seed.ltoText = c.limited_time_offer?.text || ''
      seed.ltoHasExpiration = !!c.limited_time_offer?.has_expiration
    } else if (c.type === 'BUTTONS') {
      seed.buttons = (c.buttons || []).map((b) => ({
        type: ((b.type || 'QUICK_REPLY').toUpperCase() as ButtonType),
        text: b.text || '',
        url: b.url || '',
        phoneNumber: b.phone_number || '',
        code: typeof b.example === 'string' ? b.example : (b.example?.[0] || ''),
      }))
    } else if (c.type === 'CAROUSEL') {
      seed.carouselEnabled = true
      const firstCardComponents = c.cards?.[0]?.components ?? []
      const firstHeader = firstCardComponents.find((cc) => cc.type === 'HEADER')
      seed.carouselHeaderFormat = (firstHeader?.format as CarouselHeaderFormat) || 'IMAGE'
      seed.carouselHasBody = firstCardComponents.some((cc) => cc.type === 'BODY')
      seed.carouselHasButtons = firstCardComponents.some((cc) => cc.type === 'BUTTONS')
      seed.cards = (c.cards ?? []).map((card) => {
        const cardComponents = card.components ?? []
        const header = cardComponents.find((cc) => cc.type === 'HEADER')
        const body = cardComponents.find((cc) => cc.type === 'BODY')
        const buttonsComponent = cardComponents.find((cc) => cc.type === 'BUTTONS')
        return {
          headerHandle: header?.example?.header_handle?.[0] || '',
          mediaError: null,
          bodyText: body?.text || '',
          buttons: (buttonsComponent?.buttons || []).map((b) => ({
            type: ((b.type || 'QUICK_REPLY').toUpperCase() as ButtonType),
            text: b.text || '',
            url: b.url || '',
            phoneNumber: '',
            code: '',
          })),
        }
      })
    }
  }
  return seed
}
```

- [ ] **Step 3: Manual verification — no test runner exists, so verify by reading**

Re-read the full modified `seedFromComponents` function and confirm: every existing branch (HEADER/BODY/FOOTER/LIMITED_TIME_OFFER/BUTTONS) is byte-for-byte unchanged, and the new CAROUSEL branch is the only addition. This is a pure-function change with no side effects, so a read-through is the correct verification given no test runner exists.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/templateModel.ts"
git commit -m "$(cat <<'EOF'
Add CAROUSEL types and seed round-trip to templateModel

KarixComponent gains a cards field and CarouselCardDraft is introduced
so seedFromComponents no longer silently drops an existing template's
CAROUSEL component when loading it into the manual editor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `useTemplateBuilder.ts` — carousel state, per-card upload, build/submit

**Files:**
- Modify: `frontend/src/components/templatestudio/useTemplateBuilder.ts`

- [ ] **Step 1: Add imports and carousel state**

Add `CarouselCardDraft` and `CarouselHeaderFormat` to the import block at the top (line 6-18):

```typescript
import {
  AUTH_BODY_TEXT,
  BODY_MAX,
  DEFAULT_CODE_EXPIRATION_MINUTES,
  NAME_RE,
  extractVariables,
  seedFromComponents,
  detectVariableFormat,
  type ButtonDraft,
  type HeaderFormat,
  type KarixComponent,
  type VariableFormat,
  type CarouselCardDraft,
  type CarouselHeaderFormat,
} from './templateModel'
```

Add new state right after the existing `ltoHasExpiration` state (after line 48):

```typescript
  const [carouselEnabled, setCarouselEnabled] = useState(false)
  const [carouselHeaderFormat, setCarouselHeaderFormat] = useState<CarouselHeaderFormat>('IMAGE')
  const [carouselHasBody, setCarouselHasBody] = useState(true)
  const [carouselHasButtons, setCarouselHasButtons] = useState(true)
  const [cards, setCards] = useState<CarouselCardDraft[]>([])
```

- [ ] **Step 2: Add the enable-toggle effect and card-count helpers**

Add this function above `useTemplateBuilder`'s return statement, near the other helper functions (right after the `resetForCreateAnother` function, before line 240's `nameOk` line):

```typescript
  function makeEmptyCard(): CarouselCardDraft {
    return { headerHandle: '', mediaError: null, bodyText: '', buttons: [] }
  }

  function enableCarousel(enabled: boolean) {
    setCarouselEnabled(enabled)
    if (enabled && cards.length < 2) {
      setCards([makeEmptyCard(), makeEmptyCard()])
    }
  }

  function addCard() {
    setCards((prev) => (prev.length >= 10 ? prev : [...prev, makeEmptyCard()]))
  }

  function removeCard(index: number) {
    setCards((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  function setCardBodyText(index: number, text: string) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, bodyText: text } : c)))
  }

  function setCardButtons(index: number, updater: (prev: ButtonDraft[]) => ButtonDraft[]) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, buttons: updater(c.buttons) } : c)))
  }
```

- [ ] **Step 3: Add the per-card media upload mutation**

Add this mutation right after the existing `uploadMediaMutation` (after line 131, before `function buildComponents()`):

```typescript
  const uploadCardMediaMutation = useMutation({
    mutationFn: ({ file }: { file: File; cardIndex: number }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('category', carouselHeaderFormat.toLowerCase())
      return api.post(`/templates/${wabaId}/media`, form, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: (res, variables) => {
      const handle = res.data?.data?.result?.fileHandle || res.data?.data?.result?.file_handle || ''
      setCards((prev) => prev.map((c, i) => (i === variables.cardIndex
        ? { ...c, headerHandle: handle || c.headerHandle, mediaError: handle ? null : 'Upload succeeded but no file handle was returned.' }
        : c)))
    },
    onError: (err, variables) => {
      setCards((prev) => prev.map((c, i) => (i === variables.cardIndex ? { ...c, mediaError: extractErrorMessage(err) } : c)))
    },
  })
```

- [ ] **Step 4: Seed the new fields in the existing-template load effect**

In the `useEffect` that seeds from `existingTemplateQuery.data` (around line 82-115), add the new fields to the setters, right after `setLtoHasExpiration(seed.ltoHasExpiration)` (line 109):

```typescript
    setLtoHasExpiration(seed.ltoHasExpiration)
    setCarouselEnabled(seed.carouselEnabled)
    setCarouselHeaderFormat(seed.carouselHeaderFormat)
    setCarouselHasBody(seed.carouselHasBody)
    setCarouselHasButtons(seed.carouselHasButtons)
    setCards(seed.cards)
```

- [ ] **Step 5: Hide top-level Header/Buttons and add the CAROUSEL component in `buildComponents`**

Modify `buildComponents()` (line 133-184). Guard the existing top-level HEADER push and BUTTONS push with `!carouselEnabled`, and add the CAROUSEL push before the `return components` line:

```typescript
  function buildComponents(): Array<Record<string, unknown>> {
    if (isAuthentication) {
      return [
        { type: 'BODY', text: AUTH_BODY_TEXT },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', example: otpExampleCode }] },
      ]
    }
    const components: Array<Record<string, unknown>> = []
    if (headerFormat !== 'NONE' && !carouselEnabled) {
      if (headerFormat === 'TEXT') {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
      } else if (headerFormat === 'LOCATION') {
        // No handle to upload — the location itself is supplied at send
        // time, not creation time (docs/meta-api/.../location_templates.md).
        components.push({ type: 'HEADER', format: 'LOCATION' })
      } else {
        components.push({ type: 'HEADER', format: headerFormat, example: { header_handle: [headerHandle] } })
      }
    }
    const variables = extractVariables(bodyText)
    const bodyComponent: Record<string, unknown> = { type: 'BODY', text: bodyText }
    if (variables.length > 0) {
      bodyComponent.example = variableFormat === 'NAMED' && !isEdit
        ? { body_text_named_params: variables.map((v) => ({ param_name: v, example: bodyExamples[v] || '' })) }
        : { body_text: [variables.map((v) => bodyExamples[v] || '')] }
    }
    components.push(bodyComponent)
    // LTO.md: "Only templates categorized as MARKETING are supported" and
    // "Footer components are not supported" alongside limited_time_offer —
    // footerText is already force-cleared by the effect above when LTO is
    // on, so no footer push happens here; this mirrors that invariant.
    if (ltoEnabled && category === 'MARKETING' && ltoText.trim()) {
      components.push({
        type: 'LIMITED_TIME_OFFER',
        limited_time_offer: { text: ltoText.trim(), has_expiration: ltoHasExpiration },
      })
    } else if (footerText.trim()) {
      components.push({ type: 'FOOTER', text: footerText })
    }
    if (buttons.length > 0 && !carouselEnabled) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber }
          if (b.type === 'COPY_CODE') return { type: 'copy_code', example: b.code }
          return { type: 'QUICK_REPLY', text: b.text }
        }),
      })
    }
    if (carouselEnabled) {
      components.push({
        type: 'CAROUSEL',
        cards: cards.map((card) => {
          const cardComponents: Array<Record<string, unknown>> = [
            { type: 'HEADER', format: carouselHeaderFormat, example: { header_handle: [card.headerHandle] } },
          ]
          if (carouselHasBody) cardComponents.push({ type: 'BODY', text: card.bodyText })
          if (carouselHasButtons && card.buttons.length > 0) {
            cardComponents.push({
              type: 'BUTTONS',
              buttons: card.buttons.map((b) => (b.type === 'URL'
                ? { type: 'URL', text: b.text, url: b.url }
                : { type: 'QUICK_REPLY', text: b.text })),
            })
          }
          return { components: cardComponents }
        }),
      })
    }
    return components
  }
```

- [ ] **Step 6: Extend `canSubmit` and `resetForCreateAnother`, and expose the new values from the hook**

Modify `canSubmit` (around line 240-253) to add the carousel readiness check:

```typescript
  const nameOk = isEdit || (templateName.trim().length > 0 && templateName.length <= 512 && NAME_RE.test(templateName))
  const bodyLenOk = isAuthentication || bodyText.length <= BODY_MAX
  // LOCATION needs no upload — the coordinates are supplied at send time,
  // not creation time (docs/meta-api/.../location_templates.md).
  const headerReady = headerFormat === 'NONE' || headerFormat === 'TEXT' || headerFormat === 'LOCATION'
    ? true
    : !!headerHandle
  // A toggled-on LTO with no offer text would otherwise submit silently
  // with neither an offer banner nor a footer (footerText is cleared the
  // moment ltoEnabled flips true) — block submit instead of losing content.
  const ltoReady = !ltoEnabled || ltoText.trim().length > 0
  // Meta requires 2-10 cards per carousel, each with its own uploaded
  // image/video handle (HEADER is mandatory per card, unlike the top-level
  // header which stays optional).
  const carouselReady = !carouselEnabled
    || (cards.length >= 2 && cards.length <= 10 && cards.every((c) => !!c.headerHandle))
  const canSubmit = nameOk && bodyLenOk && ltoReady && carouselReady
    && (isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)
    && (!isEdit || seeded) && !submitMutation.isPending
```

Add carousel-state resets to `resetForCreateAnother()` (around line 218-238), right after `setLtoHasExpiration(false)`:

```typescript
    setLtoHasExpiration(false)
    setCarouselEnabled(false)
    setCarouselHeaderFormat('IMAGE')
    setCarouselHasBody(true)
    setCarouselHasButtons(true)
    setCards([])
```

Add the new values/functions to the hook's return object (around line 255-283), right after `ltoHasExpiration, setLtoHasExpiration,`:

```typescript
    ltoHasExpiration, setLtoHasExpiration,
    carouselEnabled, enableCarousel,
    carouselHeaderFormat, setCarouselHeaderFormat,
    carouselHasBody, setCarouselHasBody,
    carouselHasButtons, setCarouselHasButtons,
    cards, addCard, removeCard, setCardBodyText, setCardButtons,
    uploadCardMediaMutation,
```

- [ ] **Step 7: Manual verification — read-through**

Re-read the full modified file. Confirm: (a) `carouselEnabled` correctly suppresses the top-level HEADER and BUTTONS pushes but not BODY, (b) `enableCarousel` seeds exactly 2 cards only when going from `< 2` cards, so re-toggling off/on after removing cards doesn't wipe existing card content, (c) `canSubmit`'s new `carouselReady` term is `true` (a no-op) when `carouselEnabled` is `false`, matching every other optional-feature pattern in this file (`ltoReady`, `headerReady`).

- [ ] **Step 8: Commit**

```bash
git add "frontend/src/components/templatestudio/useTemplateBuilder.ts"
git commit -m "$(cat <<'EOF'
Add carousel state, per-card upload, and build/submit support

useTemplateBuilder now tracks carousel-enabled state, a locked
card-1-defines-shape (header format/body/buttons), and a per-card
media-upload mutation. buildComponents constructs a real CAROUSEL
component and suppresses the top-level Header/Buttons components
while carousel mode is on; canSubmit enforces Meta's 2-10 card range
and a required per-card image/video handle.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `builder/CarouselEditor.tsx` — new component

**Files:**
- Create: `frontend/src/components/templatestudio/builder/CarouselEditor.tsx`

- [ ] **Step 1: Write the component**

This follows the same toggle pattern as `LimitedTimeOfferEditor.tsx` (a local `Toggle` button) and reuses `ButtonsEditor` directly for each card's buttons (it already accepts a `buttons`/`setButtons(updater)` pair, which `setCardButtons(index, updater)` matches exactly).

```typescript
import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import ErrorBanner from '../../shared/ErrorBanner'
import ButtonsEditor from './ButtonsEditor'
import type { ButtonDraft, CarouselCardDraft, CarouselHeaderFormat } from '../templateModel'

// New (TASKS.md #12) — closes the data-loss risk where opening an existing
// CAROUSEL template in the manual editor and saving would silently strip
// its cards, since seedFromComponents had nowhere to put them.
export default function CarouselEditor({
  enabled, onEnabledChange,
  headerFormat, onHeaderFormatChange,
  hasBody, onHasBodyChange,
  hasButtons, onHasButtonsChange,
  cards, onAddCard, onRemoveCard, onCardBodyTextChange, onCardButtonsChange,
  uploadCardMediaMutation,
}: {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  headerFormat: CarouselHeaderFormat
  onHeaderFormatChange: (f: CarouselHeaderFormat) => void
  hasBody: boolean
  onHasBodyChange: (v: boolean) => void
  hasButtons: boolean
  onHasButtonsChange: (v: boolean) => void
  cards: CarouselCardDraft[]
  onAddCard: () => void
  onRemoveCard: (index: number) => void
  onCardBodyTextChange: (index: number, text: string) => void
  onCardButtonsChange: (index: number, updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void
  uploadCardMediaMutation: { mutate: (v: { file: File; cardIndex: number }) => void; isPending: boolean }
}) {
  const [openCard, setOpenCard] = useState(0)

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">Add carousel</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shows a swipeable set of 2-10 cards alongside the body text above. Each card needs its own image or video.
          </p>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} label="Add carousel" />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-foreground">Card media type</label>
              <select
                value={headerFormat}
                onChange={(e) => onHeaderFormatChange(e.target.value as CarouselHeaderFormat)}
                className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={hasBody} onChange={(e) => onHasBodyChange(e.target.checked)} />
              Each card has body text
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={hasButtons} onChange={(e) => onHasButtonsChange(e.target.checked)} />
              Each card has buttons
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            These three choices apply to every card — Meta requires all cards in one carousel to share the same shape.
          </p>

          {cards.map((card, i) => (
            <div key={i} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenCard(openCard === i ? -1 : i)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                <span>Card {i + 1}{card.headerHandle ? ' — media uploaded' : ''}</span>
                <span className="flex items-center gap-2">
                  {cards.length > 2 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onRemoveCard(i) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemoveCard(i) } }}
                      aria-label={`Remove card ${i + 1}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span>{openCard === i ? '−' : '+'}</span>
                </span>
              </button>
              {openCard === i && (
                <div className="space-y-2 border-t p-3">
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept={headerFormat === 'IMAGE' ? 'image/*' : 'video/*'}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCardMediaMutation.mutate({ file: f, cardIndex: i }) }}
                      className="text-xs text-foreground"
                    />
                    {uploadCardMediaMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {card.headerHandle && <p className="text-xs text-accent-teal-solid">Media uploaded.</p>}
                    {card.mediaError && <ErrorBanner error={card.mediaError} />}
                  </div>
                  {hasBody && (
                    <input
                      type="text"
                      value={card.bodyText}
                      onChange={(e) => onCardBodyTextChange(i, e.target.value)}
                      placeholder="Card body text"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
                    />
                  )}
                  {hasButtons && (
                    <ButtonsEditor buttons={card.buttons} setButtons={(updater) => onCardButtonsChange(i, updater)} />
                  )}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            disabled={cards.length >= 10}
            onClick={onAddCard}
            className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add card ({cards.length}/10)
          </button>
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2',
        checked ? 'bg-accent-teal-solid' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-surface-resting transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
```

- [ ] **Step 2: Manual verification — read-through**

Confirm `ButtonsEditor`'s prop signature (`{ buttons: ButtonDraft[]; setButtons: (updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void }`, from `frontend/src/components/templatestudio/builder/ButtonsEditor.tsx:7-10`) matches exactly what's passed here (`buttons={card.buttons} setButtons={(updater) => onCardButtonsChange(i, updater)}`).

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/components/templatestudio/builder/CarouselEditor.tsx"
git commit -m "$(cat <<'EOF'
Add CarouselEditor component

Card 1's Media type / body / buttons checkboxes define the shared
shape Meta requires across every card; cards 2-10 render as stacked
collapsible panels reusing ButtonsEditor for their own button set and
a per-card file input for their own image/video upload.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire `CarouselEditor` into `TemplateBuilderForm.tsx`

**Files:**
- Modify: `frontend/src/components/templatestudio/TemplateBuilderForm.tsx`

- [ ] **Step 1: Import the new component**

Add near the other builder imports (after line 15's `ButtonsEditor` import):

```typescript
import CarouselEditor from './builder/CarouselEditor'
```

- [ ] **Step 2: Hide Header/Buttons while carousel is enabled, render CarouselEditor**

Modify the JSX block that renders `HeaderEditor`/`BodyEditor`/`LimitedTimeOfferEditor`/`FooterEditor`/`ButtonsEditor` (lines 80-100). `HeaderEditor` and `ButtonsEditor` become conditional on `!b.carouselEnabled`, and `CarouselEditor` is added after `ButtonsEditor`:

```typescript
      {(b.isEdit || step === 2) && (!b.isEdit || b.seeded) && !b.isAuthentication && (
        <>
          {!b.carouselEnabled && (
            <HeaderEditor
              headerFormat={b.headerFormat} setHeaderFormat={b.setHeaderFormat}
              headerText={b.headerText} setHeaderText={b.setHeaderText}
              headerHandle={b.headerHandle} setMediaError={b.setMediaError} mediaError={b.mediaError}
              uploadMediaMutation={b.uploadMediaMutation}
            />
          )}
          <BodyEditor bodyText={b.bodyText} setBodyText={b.setBodyText} bodyExamples={b.bodyExamples} setBodyExamples={b.setBodyExamples} />
          {b.category === 'MARKETING' ? (
            <LimitedTimeOfferEditor
              enabled={b.ltoEnabled} onEnabledChange={b.setLtoEnabled}
              text={b.ltoText} onTextChange={b.setLtoText}
              hasExpiration={b.ltoHasExpiration} onHasExpirationChange={b.setLtoHasExpiration}
            />
          ) : (
            <FooterEditor footerText={b.footerText} setFooterText={b.setFooterText} />
          )}
          {!b.carouselEnabled && (
            <ButtonsEditor buttons={b.buttons} setButtons={b.setButtons} />
          )}
          <CarouselEditor
            enabled={b.carouselEnabled} onEnabledChange={b.enableCarousel}
            headerFormat={b.carouselHeaderFormat} onHeaderFormatChange={b.setCarouselHeaderFormat}
            hasBody={b.carouselHasBody} onHasBodyChange={b.setCarouselHasBody}
            hasButtons={b.carouselHasButtons} onHasButtonsChange={b.setCarouselHasButtons}
            cards={b.cards} onAddCard={b.addCard} onRemoveCard={b.removeCard}
            onCardBodyTextChange={b.setCardBodyText} onCardButtonsChange={b.setCardButtons}
            uploadCardMediaMutation={b.uploadCardMediaMutation}
          />
        </>
      )}
```

- [ ] **Step 3: Manual verification — run the dev server**

```bash
cd "d:/Meta business agents/frontend" && npm run dev
```

Open the Template Studio "Create Template" flow in a browser, reach step 2, toggle "Add carousel" on. Confirm: Header and Buttons sections disappear, two card panels appear, "Add card" is enabled, removing a card is disabled at 2 cards remaining. Stop the dev server afterward (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/TemplateBuilderForm.tsx"
git commit -m "$(cat <<'EOF'
Wire CarouselEditor into the template builder form

Header and Buttons sections hide while carousel mode is on, since
Meta's CAROUSEL cards carry their own per-card header/buttons instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `WhatsAppTemplatePreview.tsx` — carousel rendering and button icons

**Files:**
- Modify: `frontend/src/components/templatestudio/WhatsAppTemplatePreview.tsx`
- Modify: `frontend/src/components/templatestudio/TemplateBuilderForm.tsx` (pass carousel props to the preview)

- [ ] **Step 1: Rewrite the preview component**

Replace the full file contents:

```typescript
import { ExternalLink, Phone } from 'lucide-react'
import {
  AUTH_BODY_TEXT,
  type ButtonDraft,
  type CarouselCardDraft,
  type HeaderFormat,
} from './templateModel'

function ButtonIcon({ type }: { type: ButtonDraft['type'] }) {
  if (type === 'URL') return <ExternalLink className="h-3 w-3" />
  if (type === 'PHONE_NUMBER') return <Phone className="h-3 w-3" />
  return null
}

function ButtonRow({ buttons }: { buttons: ButtonDraft[] }) {
  if (buttons.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-col gap-px border-t border-whatsapp-ink/10 pt-1">
      {buttons.map((b, i) => (
        <span key={i} className="flex items-center justify-center gap-1.5 py-1.5 text-center text-xs font-semibold text-whatsapp-header">
          <ButtonIcon type={b.type} />
          {b.text || 'Button'}
        </span>
      ))}
    </div>
  )
}

export default function WhatsAppTemplatePreview({
  headerFormat,
  headerText,
  bodyText,
  footerText,
  buttons,
  isAuthentication,
  carouselEnabled = false,
  cards = [],
}: {
  headerFormat: HeaderFormat
  headerText: string
  bodyText: string
  footerText: string
  buttons: ButtonDraft[]
  isAuthentication: boolean
  carouselEnabled?: boolean
  cards?: CarouselCardDraft[]
}) {
  const body = isAuthentication ? AUTH_BODY_TEXT : bodyText
  const previewButtons = isAuthentication
    ? [{ type: 'QUICK_REPLY' as const, text: 'Copy code', url: '', phoneNumber: '', code: '' }]
    : buttons

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-surface-resting">
      <div className="flex items-center gap-2 bg-whatsapp-header px-3 py-2 text-xs font-semibold text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
        WhatsApp preview
      </div>
      <div className="min-h-[180px] bg-whatsapp-canvas p-4">
        <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-whatsapp-bubble px-3 py-2 text-[13px] leading-relaxed text-whatsapp-ink shadow-sm">
          {headerFormat === 'TEXT' && headerText && !carouselEnabled && (
            <p className="mb-1 font-semibold">{headerText}</p>
          )}
          {headerFormat !== 'NONE' && headerFormat !== 'TEXT' && !carouselEnabled && (
            <p className="mb-1 text-xs italic text-whatsapp-ink/60">[{headerFormat.toLowerCase()} header]</p>
          )}
          <p>
            {body.trim()
              ? body
              : <span className="italic text-whatsapp-ink/40">Body text will appear here…</span>}
          </p>
          {footerText.trim() && !isAuthentication && !carouselEnabled && (
            <p className="mt-1 text-xs text-whatsapp-ink/50">{footerText}</p>
          )}
          {carouselEnabled ? (
            <div className="mt-1.5 flex gap-2 overflow-x-auto border-t border-whatsapp-ink/10 pt-1.5">
              {cards.map((card, i) => (
                <div key={i} className="w-24 shrink-0 rounded-md border border-whatsapp-ink/10 bg-white">
                  <div className="flex h-12 items-center justify-center bg-whatsapp-ink/5 text-[10px] italic text-whatsapp-ink/40">
                    {card.headerHandle ? 'media' : 'no media'}
                  </div>
                  <div className="p-1.5">
                    {card.bodyText.trim() && <p className="line-clamp-2 text-[10px]">{card.bodyText}</p>}
                    {card.buttons[0] && (
                      <p className="mt-1 truncate text-center text-[10px] font-semibold text-whatsapp-header">
                        {card.buttons[0].text || 'Button'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ButtonRow buttons={previewButtons} />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Pass the new props from `TemplateBuilderForm.tsx`**

Modify the `WhatsAppTemplatePreview` usage (around line 135-142):

```typescript
          <WhatsAppTemplatePreview
            headerFormat={b.headerFormat}
            headerText={b.headerText}
            bodyText={b.bodyText}
            footerText={b.category === 'MARKETING' && b.ltoEnabled ? '' : b.footerText}
            buttons={b.buttons}
            isAuthentication={b.isAuthentication}
            carouselEnabled={b.carouselEnabled}
            cards={b.cards}
          />
```

- [ ] **Step 3: Manual verification — run the dev server**

```bash
cd "d:/Meta business agents/frontend" && npm run dev
```

In the browser: (a) add a URL button on a non-carousel template, confirm the external-link icon appears next to its label in the live preview; (b) toggle carousel on, add body text to card 1, confirm the card tiles appear in the preview's horizontal row instead of the normal button row. Stop the dev server afterward.

- [ ] **Step 4: Open the real `strawberry_carousel_v5` template in the manual editor (from TASKS.md #12) and confirm the data-loss bug is fixed**

Navigate to Template Studio → Templates → find `strawberry_carousel_v5` (created live via Iris) → Edit. Confirm the form now shows "Card 1", "Card 2" panels with their real content (previously showed "Header: None" with no trace of the cards). Do not click Save during this check unless you intend to actually resubmit the template for review — this is a read/seed verification, not a submit test.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/components/templatestudio/WhatsAppTemplatePreview.tsx" "frontend/src/components/templatestudio/TemplateBuilderForm.tsx"
git commit -m "$(cat <<'EOF'
Render CAROUSEL cards and per-button-type icons in the WhatsApp preview

WhatsAppTemplatePreview is shared with Iris's draft-confirm card
(IrisDraftSnapshotCard), so Iris-authored carousel drafts now render
correctly there too, as a side effect of this same change. Button rows
also gain a small icon per type (URL/phone), matching every button
variant in the Figma reference sheet (node 115:2, file
EJ0MBZNIT1xqdE9tnCPSwH).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Close out TASKS.md #12

**Files:**
- Modify: `TASKS.md`

- [ ] **Step 1: Move #12 from Open to Resolved**

Remove the `### 12. Manual Template Studio editor has no CAROUSEL support at all` entry from the `## Open` section and add this entry under `## Resolved` (as the first entry there, right after the `## Resolved` header):

```markdown
### 12. Manual Template Studio editor has no CAROUSEL support at all
- **Status**: Resolved 2026-08-20. `templateModel.ts`, `useTemplateBuilder.ts`, `builder/CarouselEditor.tsx`, `TemplateBuilderForm.tsx`, and `WhatsAppTemplatePreview.tsx` now support creating, editing, and previewing CAROUSEL templates.
- **Verification**: opened the real `strawberry_carousel_v5` template (created live via Iris, the template that originally surfaced this bug) in the manual editor and confirmed its 2 cards now populate correctly instead of showing "Header: None" — the data-loss risk (Save silently stripping cards) is closed.
- **Design decisions**: card 1 defines the shared shape (media type, has-body, has-buttons) and cards 2-10 inherit it read-only, per Meta's requirement that every card in one carousel share the same component shape. No Figma mockup existed for this editor screen (confirmed by auditing file `EJ0MBZNIT1xqdE9tnCPSwH`); the card-shape-locking and layout decisions were made directly with the founder. See `docs/superpowers/specs/2026-08-20-carousel-manual-editor-design.md` and `docs/superpowers/plans/2026-08-20-carousel-manual-editor.md`.
- **Related**: the same Figma audit surfaced a genuinely unbuilt WhatsApp Flow button (frontend and backend) — filed separately as #15, explicitly out of scope here.
```

- [ ] **Step 2: Commit**

```bash
git add TASKS.md
git commit -m "$(cat <<'EOF'
Close TASKS.md #12 — CAROUSEL manual editor support shipped

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan gate sequence (per CLAUDE.md)

This plan's tasks are the Worker draft. Before this is considered done, the full frontend gate sequence still applies: UX review (brand/tokens/states/mobile/accessibility), Design Evaluator (taste/world-class bar — no Figma mockup existed, so evaluate against this codebase's existing patterns, e.g. `LimitedTimeOfferEditor`'s toggle treatment), EL review (code quality, cold), QA automated checks, QA advisory review, and a memory write documenting the card-shape-locking decision and the "no Figma exists for this screen" finding.
