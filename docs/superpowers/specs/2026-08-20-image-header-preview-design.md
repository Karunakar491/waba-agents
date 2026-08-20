# Real Header Media Previews (Manual Editor + Shared Preview)

Status: proceeding without live back-and-forth (explicit "fix them all, don't ask" instruction), same judgment bar as prior tasks this session. Addresses TASKS.md #13's second half.

## Scope decision

TASKS.md #13 has two parts:
1. **Live-test the IMAGE header handle fix (`86559b0`) through the manual UI** — requires a running backend + real Karix/Meta credentials. This sandbox has neither (confirmed on the CAROUSEL task). Cannot be done here. Left open in TASKS.md, unchanged.
2. **Add real thumbnail/file previews for IMAGE/VIDEO/DOCUMENT headers** (currently italic placeholder text only, in both `HeaderEditor.tsx` and `WhatsAppTemplatePreview.tsx`) — a real frontend gap, buildable and verifiable without a live backend, since the preview only needs the locally-selected `File` object, not a round-trip to Meta.

This task does part 2 only.

## Design

The uploaded file's Meta media handle (`fileHandle`) is an opaque server-side reference — not a fetchable URL, so it can't be used to render a thumbnail even after a successful upload. The correct source for a live preview is the **local `File` object** the user just picked, via `URL.createObjectURL(file)` — standard, no network round-trip, works before/independent of upload success or failure.

### `useTemplateBuilder.ts`
- New state: `headerPreviewUrl: string` (object URL or `''`), `headerFileName: string`.
- New function `selectHeaderFile(file: File)`: sets `headerPreviewUrl = URL.createObjectURL(file)`, `headerFileName = file.name`, then calls the existing `uploadMediaMutation.mutate(file)` — replaces the direct `uploadMediaMutation.mutate(f)` call currently made inline in `HeaderEditor.tsx`'s file input `onChange`.
- Reset `headerPreviewUrl`/`headerFileName` to `''` in `resetForCreateAnother()` and whenever `headerFormat` changes (mirrors the existing `setMediaError(null)` on format-change pattern already in `HeaderEditor.tsx`).
- Revoke the previous object URL (`URL.revokeObjectURL`) when replaced or reset, to avoid leaking blob URLs — a real browser resource, not just a style nicety.

### `HeaderEditor.tsx`
- Accept new props `headerPreviewUrl`, `headerFileName`, `onFileSelected` (replacing the direct `uploadMediaMutation.mutate` call in the file input's `onChange`).
- Render an actual `<img>` thumbnail (IMAGE) or `<video>` element (VIDEO) using `headerPreviewUrl` instead of the "Media uploaded." text; for DOCUMENT, render a filename row (icon + `headerFileName`) matching the Figma `DocRow` spec already seen in this codebase's Figma audit (icon + filename text, no thumbnail — Meta's own preview for documents is filename-only too).

### `WhatsAppTemplatePreview.tsx`
- Accept new optional props `headerPreviewUrl?: string`, `headerFileName?: string` (default `''`).
- Replace the current `<p className="italic">[image header]</p>` placeholder with: an `<img>`/`<video>` thumbnail for IMAGE/VIDEO (falling back to the existing italic placeholder text only if `headerPreviewUrl` is empty — e.g. before any file is chosen), and a filename row for DOCUMENT.
- This component is shared with Iris's draft-confirm card (`IrisConfirmPanel.tsx`'s `previewPropsFromArgs`) — Iris never has a local `File` object (it works from already-uploaded handles), so these two new props simply default to empty there and the existing italic-placeholder fallback continues to apply for that consumer. No change needed to `IrisConfirmPanel.tsx`.

### `TemplateBuilderForm.tsx`
- Pass `headerPreviewUrl={b.headerPreviewUrl}` and `headerFileName={b.headerFileName}` through to the existing `WhatsAppTemplatePreview` usage.

## Non-goals
- Does not touch the CAROUSEL card media placeholders (`CarouselEditor.tsx`/`WhatsAppTemplatePreview.tsx`'s carousel branch) — those are a separate, already-shipped feature (TASKS.md #12); scope creep avoided.
- Does not attempt the live Meta API smoke-test — flagged as still requiring real backend access.

## Testing
No test runner exists (confirmed prior tasks). Manual dev-server smoke test: pick an image file for an IMAGE header, confirm a real thumbnail renders in both the editor's own upload area and the live preview panel; switch header format away and back, confirm the preview clears/resets correctly (no stale thumbnail from a previous format).
