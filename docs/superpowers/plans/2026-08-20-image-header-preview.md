# Real Header Media Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the italic placeholder text for IMAGE/VIDEO/DOCUMENT headers with a real thumbnail/filename preview, in both the manual editor's upload control and the shared live-preview panel.

**Architecture:** Pure frontend change, 4 files. Uses `URL.createObjectURL(file)` on the locally-selected `File` object — no network round-trip, works independent of upload success/failure.

**Tech Stack:** React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-20-image-header-preview-design.md`

**Testing note:** No test runner exists in this codebase. Manual dev-server smoke test only.

---

### Task 1: `useTemplateBuilder.ts` — preview URL state and `selectHeaderFile`

**Files:**
- Modify: `frontend/src/components/templatestudio/useTemplateBuilder.ts`

- [ ] **Step 1: Add state**

Add near the other header-related state (`headerHandle`, `mediaError`):

```typescript
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState('')
  const [headerFileName, setHeaderFileName] = useState('')
```

- [ ] **Step 2: Add `selectHeaderFile`, revoking the previous object URL**

Add this function near `uploadMediaMutation`:

```typescript
  function selectHeaderFile(file: File) {
    if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl)
    setHeaderPreviewUrl(URL.createObjectURL(file))
    setHeaderFileName(file.name)
    uploadMediaMutation.mutate(file)
  }
```

- [ ] **Step 3: Clear preview state when header format changes away from IMAGE/VIDEO/DOCUMENT**

Find where `headerFormat` is set from the format `<select>` (this happens in `HeaderEditor.tsx`'s `onChange`, which currently calls `setMediaError(null)` alongside `setHeaderFormat`). Since the clearing needs to happen wherever `setHeaderFormat` is called from the UI, add a small wrapper in the hook instead of touching call sites individually — add this function and export it in place of the raw `setHeaderFormat` setter for external use:

```typescript
  function changeHeaderFormat(format: HeaderFormat) {
    if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl)
    setHeaderPreviewUrl('')
    setHeaderFileName('')
    setHeaderFormat(format)
  }
```

(Keep the raw `setHeaderFormat` in the returned object too, since the AUTHENTICATION-category effect already calls `setHeaderFormat('NONE')` directly and that internal effect doesn't need the preview-clearing side effect duplicated — only the user-facing format `<select>` in `HeaderEditor.tsx` needs to call `changeHeaderFormat`.)

- [ ] **Step 4: Reset in `resetForCreateAnother`**

Add to the existing reset function:

```typescript
    if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl)
    setHeaderPreviewUrl('')
    setHeaderFileName('')
```

- [ ] **Step 5: Export from the hook's return object**

Add `headerPreviewUrl, headerFileName, selectHeaderFile, changeHeaderFormat,` to the returned object, near the existing `headerHandle, mediaError, setMediaError,` line.

- [ ] **Step 6: Verify**

Run `cd frontend && npx tsc -b`, confirm zero errors (there will be errors until Task 2 updates `HeaderEditor.tsx`'s call sites — if `tsc` fails only because `HeaderEditor.tsx` doesn't yet use the new props/functions, that's expected and will resolve once Task 2 lands; if it fails for any OTHER reason, that's a real problem to fix now). If `HeaderEditor.tsx` isn't modified in this task and `tsc` passes cleanly regardless (likely, since adding new exports doesn't break existing callers), note that in your report.

- [ ] **Step 7: Commit**

```bash
git add "frontend/src/components/templatestudio/useTemplateBuilder.ts"
git commit -m "$(cat <<'EOF'
Add header preview URL state and selectHeaderFile

Uses URL.createObjectURL on the locally-selected File for an instant
thumbnail preview, independent of the Meta upload's own success/
failure -- the upload handle itself is opaque and not fetchable.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `HeaderEditor.tsx` — real thumbnail in the upload control

**Files:**
- Modify: `frontend/src/components/templatestudio/builder/HeaderEditor.tsx`

- [ ] **Step 1: Rewrite the component**

```typescript
import { Loader2 } from 'lucide-react'
import { FileText } from 'lucide-react'
import ErrorBanner from '../../shared/ErrorBanner'
import type { HeaderFormat } from '../templateModel'

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function HeaderEditor({
  headerFormat, setHeaderFormat, headerText, setHeaderText, headerHandle,
  mediaError, setMediaError, uploadMediaMutation,
  headerPreviewUrl, headerFileName, onFileSelected,
}: {
  headerFormat: HeaderFormat
  setHeaderFormat: (f: HeaderFormat) => void
  headerText: string
  setHeaderText: (t: string) => void
  headerHandle: string
  mediaError: string | null
  setMediaError: (e: string | null) => void
  uploadMediaMutation: { mutate: (f: File) => void; isPending: boolean }
  headerPreviewUrl: string
  headerFileName: string
  onFileSelected: (f: File) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <label className="block text-xs font-medium text-foreground">Header (optional)</label>
      <select
        value={headerFormat}
        onChange={(e) => { setHeaderFormat(e.target.value as HeaderFormat); setMediaError(null) }}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      >
        <option value="NONE">None</option>
        <option value="TEXT">Text</option>
        <option value="IMAGE">Image</option>
        <option value="VIDEO">Video</option>
        <option value="DOCUMENT">Document</option>
        <option value="LOCATION">Location</option>
      </select>
      {headerFormat === 'LOCATION' && (
        <p className="text-xs text-muted-foreground">
          No upload needed — this lets the customer see and share a location pin (e.g. your store or a delivery point).
          The actual coordinates are supplied when you send the template, not now.
        </p>
      )}
      {headerFormat === 'TEXT' && (
        <input
          type="text"
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
          placeholder="Header text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
      )}
      {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
        <div className="space-y-1">
          <input
            type="file"
            accept={headerFormat === 'IMAGE' ? 'image/*' : headerFormat === 'VIDEO' ? 'video/*' : undefined}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f) }}
            className="text-sm text-foreground"
          />
          {uploadMediaMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {headerFormat === 'IMAGE' && headerPreviewUrl && (
            <img src={headerPreviewUrl} alt="Header preview" className="h-24 w-24 rounded-lg border object-cover" />
          )}
          {headerFormat === 'VIDEO' && headerPreviewUrl && (
            <video src={headerPreviewUrl} controls className="h-24 w-40 rounded-lg border object-cover" />
          )}
          {headerFormat === 'DOCUMENT' && headerFileName && (
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {headerFileName}
            </div>
          )}
          {headerHandle && <p className="text-xs text-accent-teal-solid">Media uploaded.</p>}
          {mediaError && <ErrorBanner error={mediaError} />}
          {headerFormat === 'IMAGE' && (
            <p className="text-xs text-warning">
              Known Karix issue: image header handles can be rejected by Meta (error 2388084) due to a malformed
              type marker on Karix&apos;s side. If submission fails on an image header, this is likely why — not a bug
              in this form.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

Note: `setHeaderFormat` prop name is unchanged here (still called `setHeaderFormat`, matching every existing call site) — the plan's spec mentions a `changeHeaderFormat` wrapper in the hook, but to keep this component's prop interface stable and avoid touching `TemplateBuilderForm.tsx`'s existing `setHeaderFormat={b.setHeaderFormat}` wiring unnecessarily, wire `TemplateBuilderForm.tsx` to pass `setHeaderFormat={b.changeHeaderFormat}` instead (Task 3, Step 1) rather than renaming the prop here. This keeps `HeaderEditor.tsx`'s own code unchanged in that regard — it doesn't know or care which specific setter function it's given, it just calls whatever `setHeaderFormat` prop it received.

- [ ] **Step 2: Verify**

Run `cd frontend && npx tsc -b` — this will still show an error until Task 3 updates `TemplateBuilderForm.tsx`'s usage of `HeaderEditor` with the 3 new required props (`headerPreviewUrl`, `headerFileName`, `onFileSelected`). Confirm the ONLY errors are "missing prop" type errors on `TemplateBuilderForm.tsx`'s `<HeaderEditor ... />` call site — if there's any other kind of error, that's a real bug to fix now.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/components/templatestudio/builder/HeaderEditor.tsx"
git commit -m "$(cat <<'EOF'
Render real thumbnail/filename previews in HeaderEditor

Image/video headers now show an actual <img>/<video> preview via the
locally-selected file's object URL; documents show their real
filename with an icon, instead of "Media uploaded." text alone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `TemplateBuilderForm.tsx` — wire new props through to both `HeaderEditor` and `WhatsAppTemplatePreview`

**Files:**
- Modify: `frontend/src/components/templatestudio/TemplateBuilderForm.tsx`

- [ ] **Step 1: Update the `HeaderEditor` usage**

Find the existing `<HeaderEditor ... />` call and update it:

```typescript
          <HeaderEditor
            headerFormat={b.headerFormat} setHeaderFormat={b.changeHeaderFormat}
            headerText={b.headerText} setHeaderText={b.setHeaderText}
            headerHandle={b.headerHandle} setMediaError={b.setMediaError} mediaError={b.mediaError}
            uploadMediaMutation={b.uploadMediaMutation}
            headerPreviewUrl={b.headerPreviewUrl} headerFileName={b.headerFileName}
            onFileSelected={b.selectHeaderFile}
          />
```

- [ ] **Step 2: Update the `WhatsAppTemplatePreview` usage**

Add the two new props to the existing call:

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
            headerPreviewUrl={b.headerPreviewUrl}
            headerFileName={b.headerFileName}
          />
```

- [ ] **Step 3: Verify**

Run `cd frontend && npx tsc -b` — this will still show an error until Task 4 adds the two new optional props to `WhatsAppTemplatePreview`'s props type. Confirm the only remaining error (if any) is about `WhatsAppTemplatePreview` not accepting `headerPreviewUrl`/`headerFileName` yet.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/TemplateBuilderForm.tsx"
git commit -m "$(cat <<'EOF'
Wire header preview props into TemplateBuilderForm

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `WhatsAppTemplatePreview.tsx` — real thumbnail in the live preview panel

**Files:**
- Modify: `frontend/src/components/templatestudio/WhatsAppTemplatePreview.tsx`

- [ ] **Step 1: Add the two new optional props and render logic**

Modify the props type and the header-rendering JSX:

```typescript
import { ExternalLink, Phone, FileText } from 'lucide-react'
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
  headerPreviewUrl = '',
  headerFileName = '',
}: {
  headerFormat: HeaderFormat
  headerText: string
  bodyText: string
  footerText: string
  buttons: ButtonDraft[]
  isAuthentication: boolean
  carouselEnabled?: boolean
  cards?: CarouselCardDraft[]
  headerPreviewUrl?: string
  headerFileName?: string
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
          {headerFormat === 'IMAGE' && !carouselEnabled && (
            headerPreviewUrl
              ? <img src={headerPreviewUrl} alt="Header preview" className="mb-1 h-32 w-full rounded-md object-cover" />
              : <p className="mb-1 text-xs italic text-whatsapp-ink/60">[image header]</p>
          )}
          {headerFormat === 'VIDEO' && !carouselEnabled && (
            headerPreviewUrl
              ? <video src={headerPreviewUrl} controls className="mb-1 h-32 w-full rounded-md object-cover" />
              : <p className="mb-1 text-xs italic text-whatsapp-ink/60">[video header]</p>
          )}
          {headerFormat === 'DOCUMENT' && !carouselEnabled && (
            headerFileName
              ? (
                <div className="mb-1 flex items-center gap-1.5 rounded-md bg-whatsapp-ink/5 px-2 py-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5 text-whatsapp-ink/60" />
                  {headerFileName}
                </div>
              )
              : <p className="mb-1 text-xs italic text-whatsapp-ink/60">[document header]</p>
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
                    {card.buttons.map((btn, bi) => (
                      <p key={bi} className="mt-1 flex items-center justify-center gap-1 truncate text-center text-[10px] font-semibold text-whatsapp-header">
                        <ButtonIcon type={btn.type} />
                        {btn.text || 'Button'}
                      </p>
                    ))}
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

(Note: this replaces the single combined `headerFormat !== 'NONE' && headerFormat !== 'TEXT'` conditional with three separate per-format conditionals, since IMAGE/VIDEO/DOCUMENT each need different rendering now. LOCATION headers still render nothing here, same as before — LOCATION has no upload/preview at all, matching `HeaderEditor.tsx`'s existing LOCATION handling.)

- [ ] **Step 2: Verify**

Run `cd frontend && npx tsc -b`, confirm zero errors — this should be the task that finally makes the whole chain compile clean after Tasks 1-4.

Also confirm `IrisConfirmPanel.tsx`'s existing call to `WhatsAppTemplatePreview` (via `previewPropsFromArgs`, spread `{...preview}`) still compiles — it doesn't set `headerPreviewUrl`/`headerFileName`, so they default to `''`/`''`, and the fallback italic-placeholder branches should still apply for that consumer (Iris never has a local File object). Read `previewPropsFromArgs` briefly to confirm it doesn't need any change — it shouldn't.

- [ ] **Step 3: Manual verification**

Start the dev server, open Create Template, pick an image file for an IMAGE header. Confirm: (a) `HeaderEditor`'s own upload area shows a real thumbnail, not just "Media uploaded." text; (b) the live preview panel on the right also shows the same image, not italic placeholder text. Switch header format to NONE and back to IMAGE, confirm the preview clears and doesn't show a stale thumbnail from before the switch. Kill the dev server after.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/WhatsAppTemplatePreview.tsx"
git commit -m "$(cat <<'EOF'
Render real header thumbnail/filename in the live preview panel

Replaces the italic "[image header]" placeholder with an actual
<img>/<video> element for IMAGE/VIDEO and a real filename row for
DOCUMENT, using the locally-selected file's object URL. Falls back to
the original placeholder text when no local file is available (e.g.
Iris's draft-confirm preview, which only has an already-uploaded
handle, never a local File object).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Update TASKS.md #13

**Files:**
- Modify: `TASKS.md`

- [ ] **Step 1: Update the #13 entry**

Update the `### 13.` entry's Status/Plan to reflect: preview part done, live-smoke-test part still requires real backend access this session doesn't have.

```markdown
- **Status**: Partially resolved 2026-08-20. Real thumbnail/filename previews now render for IMAGE/VIDEO/DOCUMENT headers in both `HeaderEditor.tsx` and `WhatsAppTemplatePreview.tsx`, using the locally-selected file's object URL (no network round-trip needed). The live-test half of this item — confirming commit `86559b0`'s handle fix actually works through the manual UI against real Meta/Karix — still requires a running backend and live credentials this sandboxed session does not have; not performed here, still open.
- **Plan**: whoever next has backend/DB/live-credential access should do the original live-test: create a template with an IMAGE header through the manual UI, confirm Meta accepts it (no error 2388084), then this item can close fully.
```

- [ ] **Step 2: Verify**

Run `cd frontend && npx tsc -b` one final time across the whole feature.

- [ ] **Step 3: Commit**

```bash
git add TASKS.md
git commit -m "$(cat <<'EOF'
Update TASKS.md #13 -- real previews shipped, live smoke-test still open

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Post-plan gate sequence (per CLAUDE.md)

Full frontend gate sequence applies: UX review, Design Evaluator, EL review, QA automated checks, memory write.
