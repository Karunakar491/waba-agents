# Manual Template Form Validation Fixes

Status: proceeding without a live back-and-forth (founder asleep, explicit "fix them all, don't ask" instruction) — scope decisions below are made directly, with rationale, following the same judgment bar as the CAROUSEL task. Addresses TASKS.md #5.

## Scope decision

TASKS.md #5 lists 8 gaps. Splitting them by how safely they can be fixed without live verification:

**In scope now** (mechanical, well-documented Meta limits, no guessing required):
1. Body-length counter not enforced — add `maxLength` to the textarea.
2. Leading/trailing-placeholder warning shown but not wired into `canSubmit` — wire it.
3. Footer has zero length validation — Meta's real limit (confirmed in `docs/meta-api` template-components docs) is 60 characters; add counter + enforcement, matching `BodyEditor`'s pattern.
4. Buttons have zero validation — text length (25 chars quick-reply/URL/phone per Meta docs), max 3 combined buttons (confirmed in `LimitedTimeOfferEditor`'s sibling Figma sheet "Mixed Buttons: up to 3"), URL format (must start `http://`/`https://`), phone number format (must start `+`).
5. AUTHENTICATION's OTP example code — only checks non-empty; Meta requires it be a realistic code sample, add a light format check (alphanumeric, reasonable length) without over-constraining.
6. `ConsequenceLine` extended to the manual form (matches Iris/bulk-import precedent) — one line above the Submit button stating what happens.

**Explicitly deferred, not attempted now:**
- **Mapping backend rejection to field-level messages.** This requires knowing Meta's real rejection error JSON shape per field, which TASKS.md #6 already flags as *unverified* ("Confirm Karix's real `list_templates` response shape in staging" — the same caution applies to submit-rejection shapes, never independently confirmed either). Guessing a field-mapping scheme against an unverified error shape risks building something that silently doesn't work, or worse, misattributes a real error to the wrong field. Left as the generic flat message it already is. Filed as a note in TASKS.md #5's remaining scope rather than guessed at.
- **Bulk import per-row detail.** Existing code comment in `BulkImportPanel.tsx` already frames this as "intentionally deferred" pending a confirmed backend contract (job status is a raw passthrough with no per-row field in the current shape) — not touched here, same reasoning as above.
- **Edit-mode load-failure "Retry only, no manual fallback."** This is a UX decision (should a failed fetch let the user blank-start the fields anyway?) that trades safety (not letting someone submit over a template they can't see) for resilience. Not obviously safe to decide unilaterally without the founder's input on which failure mode is worse — left as-is, flagged as still open in TASKS.md.

## Implementation

### `builder/BodyEditor.tsx`
- Add `maxLength={BODY_MAX}` to the `<textarea>`.
- Export a `bodyValid(bodyText)` — or inline the existing `startsWithVar`/`endsWithVar` checks — so `useTemplateBuilder`'s `canSubmit` can reuse the same leading/trailing-variable rule already computed for display, instead of only showing a warning with no gate.

### `builder/FooterEditor.tsx`
- Add a `x/60` counter (same visual pattern as `BodyEditor`'s counter) and `maxLength={60}` on the input.

### `builder/ButtonsEditor.tsx`
- `maxLength={25}` on the button text input (Meta's real per-button-text limit).
- Cap total buttons at 3 — disable "Add button" once `buttons.length >= 3`, matching Figma's "Mixed Buttons: up to 3" precedent already documented in `WhatsAppTemplatePreview.tsx`'s reference sheet.
- URL field: warn (not hard-block, since a relative path might resolve at Meta's end — but Meta's real docs require an absolute URL) if it doesn't start with `http://` or `https://`.
- Phone field: warn if it doesn't start with `+`.

### `builder/AuthenticationEditor.tsx`
- Light format check on the OTP example code: must be non-empty AND alphanumeric, 4-15 characters (Meta's documented OTP code length range). Warn, don't hard-block beyond what's already required (non-empty).

### `useTemplateBuilder.ts`
- `canSubmit` gains: `!startsWithVar && !endsWithVar` (leading/trailing body variable), footer length ≤ 60, every button's text ≤ 25 chars, button count ≤ 3.

### `TemplateBuilderForm.tsx`
- Add one `<ConsequenceLine>` above the Submit/Save button: "This submits the template to Meta for approval — it won't be usable until approved." (create mode) / "This resubmits the template for Meta review — it won't send until re-approved." (edit mode, matching the existing edit-mode banner text already in the Figma-derived copy at the top of the edit screen).

## Testing

No test runner exists in this codebase (confirmed during the CAROUSEL task) — manual dev-server smoke test only: fill in an over-length footer/button, confirm the counter goes red and Submit disables; fill in a leading-variable body, confirm Submit stays disabled until fixed.

## Gate sequence

Frontend gate sequence applies per CLAUDE.md. Given the founder is unavailable, this session is proceeding through the same rigor (spec → plan → per-task implement/spec-review/code-review, as done for CAROUSEL) rather than skipping gates — the "don't ask" instruction changes who answers clarifying questions, not whether the process runs.
