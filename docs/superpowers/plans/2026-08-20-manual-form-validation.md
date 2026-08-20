# Manual Form Validation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the concrete, doc-verified validation gaps in the manual (non-Iris) Template Studio form: enforce lengths that are only shown as counters today, wire an already-computed warning into the submit gate, add missing button/footer/OTP validation, and add a `ConsequenceLine` matching the Iris/bulk-import precedent.

**Architecture:** Pure frontend change across 5 existing files, no new components. Each editor gains inline `maxLength`/counter/warning treatment consistent with `BodyEditor.tsx`'s existing pattern; `useTemplateBuilder.ts`'s `canSubmit` gains the corresponding gates.

**Tech Stack:** React 19, TypeScript, existing Tailwind tokens.

**Spec:** `docs/superpowers/specs/2026-08-20-manual-form-validation-design.md`

**Testing note:** No test runner exists in this codebase (confirmed during the prior CAROUSEL task). Manual dev-server smoke test only.

---

### Task 1: `builder/BodyEditor.tsx` and `useTemplateBuilder.ts` — enforce body length, wire leading/trailing-variable gate

**Files:**
- Modify: `frontend/src/components/templatestudio/builder/BodyEditor.tsx`
- Modify: `frontend/src/components/templatestudio/useTemplateBuilder.ts`

- [ ] **Step 1: Enforce `BODY_MAX` on the textarea**

In `BodyEditor.tsx`, add `maxLength={BODY_MAX}` to the `<textarea>` element (currently has no `maxLength` at all — only the counter shows overage, nothing stops typing past it):

```typescript
      <textarea
        rows={4}
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Hi {{1}}, your order has shipped."
        maxLength={BODY_MAX}
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      />
```

- [ ] **Step 2: Export the leading/trailing-variable check as a reusable function**

`BodyEditor.tsx` currently computes `startsWithVar`/`endsWithVar` locally for display only. Add an exported function above the component (so `useTemplateBuilder.ts` can reuse the exact same rule instead of duplicating the regex):

```typescript
export function bodyLeadingTrailingVariable(bodyText: string): boolean {
  const trimmed = bodyText.trim()
  const startsWithVar = /^\{\{\s*\w+\s*\}\}/.test(trimmed)
  const endsWithVar = /\{\{\s*\w+\s*\}\}$/.test(trimmed)
  return startsWithVar || endsWithVar
}
```

Then update the component body to use it instead of its own inline regexes:

```typescript
export default function BodyEditor({ bodyText, setBodyText, bodyExamples, setBodyExamples }: {
  bodyText: string
  setBodyText: (t: string) => void
  bodyExamples: Record<string, string>
  setBodyExamples: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const hasLeadingOrTrailingVar = bodyLeadingTrailingVariable(bodyText)
  const overMax = bodyText.length > BODY_MAX

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-foreground">Body text</label>
        <span className={cn('text-[11px] tabular-nums', overMax ? 'text-destructive' : 'text-muted-foreground')}>
          {bodyText.length}/{BODY_MAX}
        </span>
      </div>
      <textarea
        rows={4}
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Hi {{1}}, your order has shipped."
        maxLength={BODY_MAX}
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      />
      {hasLeadingOrTrailingVar && (
        <p className="mt-1 text-xs text-warning">
          Meta rejects bodies that start or end with a variable — add real text before and after.
        </p>
      )}
      {extractVariables(bodyText).map((v) => (
        <div key={v} className="mt-2 flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">{'{{' + v + '}}'} =</span>
          <input
            type="text"
            value={bodyExamples[v] || ''}
            onChange={(e) => setBodyExamples((prev) => ({ ...prev, [v]: e.target.value }))}
            placeholder="Example value (required by Meta)"
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wire the check into `canSubmit`**

In `useTemplateBuilder.ts`, import `bodyLeadingTrailingVariable` from `./builder/BodyEditor` (note: this creates an import from `useTemplateBuilder.ts`, which lives in `templatestudio/`, into `templatestudio/builder/BodyEditor.tsx` — use the relative path `./builder/BodyEditor`). Add the import near the top:

```typescript
import { bodyLeadingTrailingVariable } from './builder/BodyEditor'
```

In the `canSubmit` computation, add a new term. Find the existing `bodyLenOk` line and add a sibling:

```typescript
  const bodyLenOk = isAuthentication || bodyText.length <= BODY_MAX
  const bodyVarPositionOk = isAuthentication || !bodyLeadingTrailingVariable(bodyText)
```

Then add `&& bodyVarPositionOk` to the `canSubmit` expression (find the line starting `const canSubmit = nameOk && bodyLenOk && ...` and insert `bodyVarPositionOk` alongside `bodyLenOk`):

```typescript
  const canSubmit = nameOk && bodyLenOk && bodyVarPositionOk && ltoReady && carouselReady
    && (isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)
    && (!isEdit || seeded) && !submitMutation.isPending
```

- [ ] **Step 4: Manual verification**

Run `cd frontend && npx tsc -b`, confirm zero errors. Start the dev server, open Create Template, type a body starting with `{{1}}` (e.g. `{{1}} shipped your order`), confirm Submit stays disabled with the warning visible; add real text before the variable, confirm Submit re-enables (assuming other fields are also valid). Kill the dev server after.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/components/templatestudio/builder/BodyEditor.tsx" "frontend/src/components/templatestudio/useTemplateBuilder.ts"
git commit -m "$(cat <<'EOF'
Enforce body length and wire leading/trailing-variable gate

BodyEditor's textarea had no maxLength (only a counter), and the
leading/trailing-variable warning was shown but never gated Submit --
a user could submit body text Meta would reject despite seeing the
warning on screen.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `builder/FooterEditor.tsx` — length counter and enforcement

**Files:**
- Modify: `frontend/src/components/templatestudio/builder/FooterEditor.tsx`
- Modify: `frontend/src/components/templatestudio/useTemplateBuilder.ts`

- [ ] **Step 1: Rewrite `FooterEditor.tsx` with a 60-char counter, matching `BodyEditor`'s visual pattern**

Meta's real limit (confirmed in `docs/meta-api/Meta Templates API Documentation/custom_marketing.md` line 93: "Maximum 60 characters") is 60.

```typescript
import { cn } from '../../../lib/utils'

export const FOOTER_MAX = 60

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function FooterEditor({ footerText, setFooterText }: { footerText: string; setFooterText: (t: string) => void }) {
  const overMax = footerText.length > FOOTER_MAX
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-foreground">Footer (optional)</label>
        <span className={cn('text-[11px] tabular-nums', overMax ? 'text-destructive' : 'text-muted-foreground')}>
          {footerText.length}/{FOOTER_MAX}
        </span>
      </div>
      <input
        type="text"
        value={footerText}
        onChange={(e) => setFooterText(e.target.value)}
        placeholder="Footer text"
        maxLength={FOOTER_MAX}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      />
    </div>
  )
}
```

- [ ] **Step 2: Wire into `canSubmit`**

In `useTemplateBuilder.ts`, import `FOOTER_MAX` from `./builder/FooterEditor`:

```typescript
import { FOOTER_MAX } from './builder/FooterEditor'
```

Add a term near `bodyLenOk`:

```typescript
  const footerLenOk = footerText.length <= FOOTER_MAX
```

Add `&& footerLenOk` to the `canSubmit` expression from Task 1 Step 3:

```typescript
  const canSubmit = nameOk && bodyLenOk && bodyVarPositionOk && footerLenOk && ltoReady && carouselReady
    && (isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)
    && (!isEdit || seeded) && !submitMutation.isPending
```

(`maxLength` on the input already prevents typing past 60, so `footerLenOk` is mostly a defense-in-depth belt-and-suspenders check — matches the existing `bodyLenOk` pattern, which does the same for a field that also has `maxLength`.)

- [ ] **Step 3: Manual verification**

Run `cd frontend && npx tsc -b`, confirm zero errors. In the dev server, type into the footer field past 60 characters, confirm typing stops at 60 and the counter turns red at the boundary. Kill dev server after.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/builder/FooterEditor.tsx" "frontend/src/components/templatestudio/useTemplateBuilder.ts"
git commit -m "$(cat <<'EOF'
Add footer length counter and enforcement (Meta's 60-char limit)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `builder/ButtonsEditor.tsx` — text length, button count cap, URL/phone format warnings

**Files:**
- Modify: `frontend/src/components/templatestudio/builder/ButtonsEditor.tsx`
- Modify: `frontend/src/components/templatestudio/useTemplateBuilder.ts`

- [ ] **Step 1: Add `maxLength`, count cap, and format warnings**

Meta's real limits (confirmed in `docs/meta-api/Meta Templates API Documentation/custom_marketing.md` lines 96-102): button label text max 25 characters for every button type. The 3-button combined cap comes from this codebase's own Figma reference sheet already cited in `WhatsAppTemplatePreview.tsx` ("Mixed Buttons: up to 3 buttons combined").

Rewrite `ButtonsEditor.tsx`:

```typescript
import { Plus, Trash2 } from 'lucide-react'
import type { ButtonDraft, ButtonType } from '../templateModel'

export const BUTTON_TEXT_MAX = 25
export const BUTTONS_MAX_COUNT = 3

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7). Added
// focus-visible to every select/input/button below — the original had
// none anywhere in this component, a gap independent of the token swap.
export default function ButtonsEditor({ buttons, setButtons }: {
  buttons: ButtonDraft[]
  setButtons: (updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">Buttons (optional)</label>
        <button
          type="button"
          disabled={buttons.length >= BUTTONS_MAX_COUNT}
          onClick={() => setButtons((prev) => [...prev, { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '', code: '' }])}
          className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" /> Add button ({buttons.length}/{BUTTONS_MAX_COUNT})
        </button>
      </div>
      {buttons.map((b, i) => {
        const urlLooksValid = b.type !== 'URL' || /^https?:\/\//.test(b.url.trim())
        const phoneLooksValid = b.type !== 'PHONE_NUMBER' || b.phoneNumber.trim().startsWith('+')
        return (
        <div key={i} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={b.type}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value as ButtonType } : x)))}
              className="rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              <option value="QUICK_REPLY">Quick reply</option>
              <option value="URL">URL</option>
              <option value="PHONE_NUMBER">Phone</option>
              <option value="COPY_CODE">Copy offer code</option>
            </select>
            <input
              type="text"
              value={b.text}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              placeholder="Button text"
              maxLength={BUTTON_TEXT_MAX}
              className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            />
            {b.type === 'URL' && (
              <input
                type="text"
                value={b.url}
                onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://…"
                className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              />
            )}
            {b.type === 'PHONE_NUMBER' && (
              <input
                type="text"
                value={b.phoneNumber}
                onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, phoneNumber: e.target.value } : x)))}
                placeholder="+911234567890"
                className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              />
            )}
            {b.type === 'COPY_CODE' && (
              <input
                type="text"
                value={b.code}
                onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
                placeholder="Example code, e.g. CARIBE25"
                maxLength={15}
                className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              />
            )}
            <button
              type="button"
              onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
              className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              aria-label="Remove button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {!urlLooksValid && (
            <p className="text-[11px] text-warning">URL buttons need a full address starting with https:// (or http://).</p>
          )}
          {!phoneLooksValid && (
            <p className="text-[11px] text-warning">Phone numbers should start with a + and country code.</p>
          )}
        </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Wire count + format checks into `canSubmit`**

In `useTemplateBuilder.ts`, import the new constants:

```typescript
import { BUTTON_TEXT_MAX, BUTTONS_MAX_COUNT } from './builder/ButtonsEditor'
```

Add a term:

```typescript
  const buttonsOk = buttons.length <= BUTTONS_MAX_COUNT
    && buttons.every((b) => b.text.length <= BUTTON_TEXT_MAX)
    && buttons.every((b) => b.type !== 'URL' || /^https?:\/\//.test(b.url.trim()))
    && buttons.every((b) => b.type !== 'PHONE_NUMBER' || b.phoneNumber.trim().startsWith('+'))
```

Add `&& buttonsOk` to `canSubmit`:

```typescript
  const canSubmit = nameOk && bodyLenOk && bodyVarPositionOk && footerLenOk && buttonsOk && ltoReady && carouselReady
    && (isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)
    && (!isEdit || seeded) && !submitMutation.isPending
```

- [ ] **Step 3: Manual verification**

Run `cd frontend && npx tsc -b`, confirm zero errors. In the dev server: add 3 buttons, confirm "Add button" disables at 3/3; set a URL button's URL to `example.com` (no scheme), confirm the warning appears and Submit disables; fix it to `https://example.com`, confirm Submit re-enables.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/builder/ButtonsEditor.tsx" "frontend/src/components/templatestudio/useTemplateBuilder.ts"
git commit -m "$(cat <<'EOF'
Add button text length, count cap, and URL/phone format validation

25-char button text limit and 60-char footer limit both confirmed
against docs/meta-api's custom_marketing.md; 3-button combined cap
matches this codebase's own existing Figma reference sheet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `builder/AuthenticationEditor.tsx` — OTP example code format check

**Files:**
- Modify: `frontend/src/components/templatestudio/builder/AuthenticationEditor.tsx`
- Modify: `frontend/src/components/templatestudio/useTemplateBuilder.ts`

- [ ] **Step 1: Add a light format warning (alphanumeric, 4-15 chars)**

```typescript
import { AUTH_BODY_TEXT } from '../templateModel'

export function otpCodeLooksValid(code: string): boolean {
  return /^[a-zA-Z0-9]{4,15}$/.test(code.trim())
}

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function AuthenticationEditor({ codeExpirationMinutes, setCodeExpirationMinutes, otpExampleCode, setOtpExampleCode }: {
  codeExpirationMinutes: number
  setCodeExpirationMinutes: (n: number) => void
  otpExampleCode: string
  setOtpExampleCode: (v: string) => void
}) {
  const codeFormatOk = !otpExampleCode.trim() || otpCodeLooksValid(otpExampleCode)
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <p className="text-xs text-muted-foreground">
        Authentication templates follow Meta&apos;s OTP rules — body is the code slot only ({AUTH_BODY_TEXT}); no freeform header/footer.
        This form submits COPY_CODE only (ONE_TAP / ZERO_TAP deferred).
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Code expiration (minutes)</label>
        <input
          type="number"
          min={1}
          max={90}
          value={codeExpirationMinutes}
          onChange={(e) => setCodeExpirationMinutes(Number(e.target.value))}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Example code (for Meta&apos;s review)</label>
        <input
          type="text"
          value={otpExampleCode}
          onChange={(e) => setOtpExampleCode(e.target.value)}
          placeholder="123456"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
        {!codeFormatOk && (
          <p className="mt-1 text-xs text-warning">Example code should be 4-15 letters/numbers only.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `canSubmit`**

In `useTemplateBuilder.ts`, import `otpCodeLooksValid` from `./builder/AuthenticationEditor`:

```typescript
import { otpCodeLooksValid } from './builder/AuthenticationEditor'
```

Modify the existing authentication-branch check in `canSubmit` — find `(isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)` and change the authentication side to also require format validity:

```typescript
  const canSubmit = nameOk && bodyLenOk && bodyVarPositionOk && footerLenOk && buttonsOk && ltoReady && carouselReady
    && (isAuthentication ? (!!otpExampleCode.trim() && otpCodeLooksValid(otpExampleCode)) : bodyText.trim() && headerReady)
    && (!isEdit || seeded) && !submitMutation.isPending
```

- [ ] **Step 3: Manual verification**

Run `cd frontend && npx tsc -b`, confirm zero errors. In the dev server, create an AUTHENTICATION-category template, type `ab` (too short) into the example code field, confirm the warning appears and Submit stays disabled; type `123456`, confirm it clears and Submit enables (assuming other fields valid).

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/components/templatestudio/builder/AuthenticationEditor.tsx" "frontend/src/components/templatestudio/useTemplateBuilder.ts"
git commit -m "$(cat <<'EOF'
Add OTP example-code format validation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `TemplateBuilderForm.tsx` — add `ConsequenceLine`

**Files:**
- Modify: `frontend/src/components/templatestudio/TemplateBuilderForm.tsx`

- [ ] **Step 1: Import `ConsequenceLine` and add it above the Submit/Save button**

Add the import near the top:

```typescript
import ConsequenceLine from '../shared/ConsequenceLine'
```

In the `fieldsCard` JSX, find where `b.result` is rendered (the `{b.result && (...)}`  block) and add a `ConsequenceLine` right before the edit-mode Save button block AND right before the create-mode step-3 Submit button — the cleanest single insertion point is directly above the `{b.result && (...)}` block, since both the edit-mode Save button and the create-mode Submit button render below it in the existing layout, and this message applies to both:

```typescript
      <ConsequenceLine>
        {b.isEdit
          ? 'This resubmits the template for Meta review — it won’t send until re-approved.'
          : 'This submits the template to Meta for approval — it won’t be usable until approved.'}
      </ConsequenceLine>

      {b.result && (
        <p className={cn('text-xs', b.result.ok ? 'text-accent-teal-solid' : 'text-destructive')}>{b.result.message}</p>
      )}
```

- [ ] **Step 2: Manual verification**

Run `cd frontend && npx tsc -b`, confirm zero errors. In the dev server, open both Create Template and Edit Template flows, confirm the consequence line appears above the result/submit area with the correct wording for each mode.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/components/templatestudio/TemplateBuilderForm.tsx"
git commit -m "$(cat <<'EOF'
Add ConsequenceLine to the manual template form

Matches the existing Iris/bulk-import precedent -- the manual form
was the only creation path without a "here's what happens" line.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Close out TASKS.md #5 (partially)

**Files:**
- Modify: `TASKS.md`

- [ ] **Step 1: Update the #5 entry**

Since 6 of 8 sub-items are fixed and 2 are deliberately deferred (not guessed at), do NOT move #5 to Resolved — update its **Status** and **Plan** fields in place under `## Open` to reflect what's done and what remains:

Replace the existing `### 5. Manual (non-Iris) template create/edit form has weak validation and generic error surfacing` entry's `- **Status**` and `- **Plan**` lines (keep the `- **Why**` bullet list as historical record of the original findings) with:

```markdown
- **Status**: Partially resolved 2026-08-20. 6 of 8 sub-findings fixed: body length now enforced (was counter-only), leading/trailing-variable warning now gates Submit, footer gained a 60-char counter+enforcement (Meta's real limit, confirmed in docs/meta-api), buttons gained a 25-char text limit + 3-button combined cap + URL/phone format warnings, OTP example code gained a format check, and `ConsequenceLine` is now wired into the manual form matching the Iris/bulk-import precedent.
- **Plan**: 2 sub-findings remain deliberately deferred, not fixed: (1) mapping backend rejection to field-level messages — requires knowing Meta's real per-field rejection error shape, which has never been independently verified (same caution as open item #6's list_templates shape); guessing a mapping scheme risks silently not working or misattributing errors. (2) Bulk-import per-row detail — `BulkImportPanel.tsx`'s existing code comment already frames this as intentionally deferred pending a confirmed backend contract, unchanged. (3) Edit-mode load-failure Retry-only UX — a real founder tradeoff decision (safety vs. resilience), not decided unilaterally.
```

- [ ] **Step 2: Commit**

```bash
git add TASKS.md
git commit -m "$(cat <<'EOF'
Update TASKS.md #5 -- 6 of 8 validation gaps fixed, 2 deferred

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Post-plan gate sequence (per CLAUDE.md)

Full frontend gate sequence still applies: UX review, Design Evaluator (taste check on the new counters/warnings — low risk, matches existing `BodyEditor` pattern exactly), EL review, QA automated checks, memory write documenting the two deliberately-deferred items and why.
