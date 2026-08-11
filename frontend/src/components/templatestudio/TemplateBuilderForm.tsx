import { FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import ErrorBanner from '../shared/ErrorBanner'
import {
  AUTH_BODY_TEXT,
  BODY_MAX,
  NAME_RE,
  extractVariables,
  type ButtonDraft,
  type ButtonType,
  type HeaderFormat,
} from './templateModel'
import { useTemplateBuilder } from './useTemplateBuilder'
import WhatsAppTemplatePreview from './WhatsAppTemplatePreview'

export default function TemplateBuilderForm({
  wabaId, mode, templateId, onDone,
}: {
  wabaId: string
  mode: 'create' | 'edit'
  templateId?: string
  onDone?: () => void
}) {
  const b = useTemplateBuilder({ wabaId, mode, templateId, onDone })

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-surface-resting">
        {!b.isEdit && (
          <TemplateMetaFields
            templateName={b.templateName} setTemplateName={b.setTemplateName}
            language={b.language} setLanguage={b.setLanguage}
            category={b.category} setCategory={b.setCategory}
          />
        )}

        {b.isEdit && !b.seeded && !b.existingTemplateQuery.isError && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {b.isEdit && !b.seeded && b.existingTemplateQuery.isError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <span>Could not load this template&apos;s current content — editing is blocked to avoid submitting a blank replacement.</span>
            <button type="button" onClick={() => b.existingTemplateQuery.refetch()} className="shrink-0 underline">Retry</button>
          </div>
        )}
        {(!b.isEdit || b.seeded) && b.isAuthentication && (
          <AuthenticationEditor
            codeExpirationMinutes={b.codeExpirationMinutes} setCodeExpirationMinutes={b.setCodeExpirationMinutes}
            otpExampleCode={b.otpExampleCode} setOtpExampleCode={b.setOtpExampleCode}
          />
        )}
        {(!b.isEdit || b.seeded) && !b.isAuthentication && (
          <>
            <HeaderEditor
              headerFormat={b.headerFormat} setHeaderFormat={b.setHeaderFormat}
              headerText={b.headerText} setHeaderText={b.setHeaderText}
              headerHandle={b.headerHandle} setMediaError={b.setMediaError} mediaError={b.mediaError}
              uploadMediaMutation={b.uploadMediaMutation}
            />
            <BodyEditor bodyText={b.bodyText} setBodyText={b.setBodyText} bodyExamples={b.bodyExamples} setBodyExamples={b.setBodyExamples} />
            <FooterEditor footerText={b.footerText} setFooterText={b.setFooterText} />
            <ButtonsEditor buttons={b.buttons} setButtons={b.setButtons} />
          </>
        )}

        {b.result && (
          <p className={cn('text-xs', b.result.ok ? 'text-brand-green' : 'text-destructive')}>{b.result.message}</p>
        )}

        <button
          type="button"
          disabled={!b.canSubmit}
          onClick={() => { b.setResult(null); b.submitMutation.mutate() }}
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {b.submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {b.isEdit ? 'Save changes' : 'Submit for approval'}
        </button>
      </div>

      <div className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
        <WhatsAppTemplatePreview
          headerFormat={b.headerFormat}
          headerText={b.headerText}
          bodyText={b.bodyText}
          footerText={b.footerText}
          buttons={b.buttons}
          isAuthentication={b.isAuthentication}
        />
      </div>
    </div>
  )
}

function TemplateMetaFields({ templateName, setTemplateName, language, setLanguage, category, setCategory }: {
  templateName: string; setTemplateName: (v: string) => void
  language: string; setLanguage: (v: string) => void
  category: string; setCategory: (v: string) => void
}) {
  const nameHint = templateName && !NAME_RE.test(templateName)
    ? 'Meta requires lowercase letters, numbers, and underscores only.'
    : templateName.length > 512
      ? 'Meta limits names to 512 characters.'
      : null

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Template name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="order_shipped"
            maxLength={512}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
          {nameHint && <p className="mt-1 text-xs text-warning">{nameHint}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Language</label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="en"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:border-primary transition"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:border-primary transition"
        >
          <option value="UTILITY">Utility</option>
          <option value="MARKETING">Marketing</option>
          <option value="AUTHENTICATION">Authentication</option>
        </select>
      </div>
    </>
  )
}

function HeaderEditor({ headerFormat, setHeaderFormat, headerText, setHeaderText, headerHandle, mediaError, setMediaError, uploadMediaMutation }: {
  headerFormat: HeaderFormat
  setHeaderFormat: (f: HeaderFormat) => void
  headerText: string
  setHeaderText: (t: string) => void
  headerHandle: string
  mediaError: string | null
  setMediaError: (e: string | null) => void
  uploadMediaMutation: { mutate: (f: File) => void; isPending: boolean }
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <label className="block text-xs font-medium text-foreground">Header (optional)</label>
      <select
        value={headerFormat}
        onChange={(e) => { setHeaderFormat(e.target.value as HeaderFormat); setMediaError(null) }}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2"
      >
        <option value="NONE">None</option>
        <option value="TEXT">Text</option>
        <option value="IMAGE">Image</option>
        <option value="VIDEO">Video</option>
        <option value="DOCUMENT">Document</option>
      </select>
      {headerFormat === 'TEXT' && (
        <input
          type="text"
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
          placeholder="Header text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2"
        />
      )}
      {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
        <div className="space-y-1">
          <input
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMediaMutation.mutate(f) }}
            className="text-sm text-foreground"
          />
          {uploadMediaMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {headerHandle && <p className="text-xs text-brand-green">Media uploaded.</p>}
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

function BodyEditor({ bodyText, setBodyText, bodyExamples, setBodyExamples }: {
  bodyText: string
  setBodyText: (t: string) => void
  bodyExamples: Record<string, string>
  setBodyExamples: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const trimmed = bodyText.trim()
  const startsWithVar = /^\{\{\s*\w+\s*\}\}/.test(trimmed)
  const endsWithVar = /\{\{\s*\w+\s*\}\}$/.test(trimmed)
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
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:border-primary transition"
      />
      {(startsWithVar || endsWithVar) && (
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
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2"
          />
        </div>
      ))}
    </div>
  )
}

function AuthenticationEditor({ codeExpirationMinutes, setCodeExpirationMinutes, otpExampleCode, setOtpExampleCode }: {
  codeExpirationMinutes: number
  setCodeExpirationMinutes: (n: number) => void
  otpExampleCode: string
  setOtpExampleCode: (v: string) => void
}) {
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
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:border-primary transition"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Example code (for Meta&apos;s review)</label>
        <input
          type="text"
          value={otpExampleCode}
          onChange={(e) => setOtpExampleCode(e.target.value)}
          placeholder="123456"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:border-primary transition"
        />
      </div>
    </div>
  )
}

function FooterEditor({ footerText, setFooterText }: { footerText: string; setFooterText: (t: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">Footer (optional)</label>
      <input
        type="text"
        value={footerText}
        onChange={(e) => setFooterText(e.target.value)}
        placeholder="Footer text"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2"
      />
    </div>
  )
}

function ButtonsEditor({ buttons, setButtons }: {
  buttons: ButtonDraft[]
  setButtons: (updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">Buttons (optional)</label>
        <button
          type="button"
          onClick={() => setButtons((prev) => [...prev, { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '' }])}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add button
        </button>
      </div>
      {buttons.map((b, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            value={b.type}
            onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value as ButtonType } : x)))}
            className="rounded-lg border bg-background px-2 py-1.5 text-xs"
          >
            <option value="QUICK_REPLY">Quick reply</option>
            <option value="URL">URL</option>
            <option value="PHONE_NUMBER">Phone</option>
          </select>
          <input
            type="text"
            value={b.text}
            onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            placeholder="Button text"
            className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground"
          />
          {b.type === 'URL' && (
            <input
              type="text"
              value={b.url}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://…"
              className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground"
            />
          )}
          {b.type === 'PHONE_NUMBER' && (
            <input
              type="text"
              value={b.phoneNumber}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, phoneNumber: e.target.value } : x)))}
              placeholder="+911234567890"
              className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground"
            />
          )}
          <button
            type="button"
            onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
            className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted"
            aria-label="Remove button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
