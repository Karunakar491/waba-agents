import { FileText, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTemplateBuilder } from './useTemplateBuilder'
import WhatsAppTemplatePreview from './WhatsAppTemplatePreview'
import TemplateSubmitSuccess from './TemplateSubmitSuccess'
import TemplateMetaFields from './builder/TemplateMetaFields'
import HeaderEditor from './builder/HeaderEditor'
import BodyEditor from './builder/BodyEditor'
import AuthenticationEditor from './builder/AuthenticationEditor'
import FooterEditor from './builder/FooterEditor'
import ButtonsEditor from './builder/ButtonsEditor'

// Thin composer (V2 rebrand slice 7) — sub-editors extracted to builder/
// per an EM-approved decomposition plan; this file was 380 lines, over the
// 200-line component ceiling.
export default function TemplateBuilderForm({
  wabaId, mode, templateId, onDone,
}: {
  wabaId: string
  mode: 'create' | 'edit'
  templateId?: string
  onDone?: () => void
}) {
  const b = useTemplateBuilder({ wabaId, mode, templateId, onDone })

  if (b.submittedName !== null) {
    return (
      <TemplateSubmitSuccess
        templateName={b.submittedName}
        onBackToTemplates={() => onDone?.()}
        onCreateAnother={b.resetForCreateAnother}
      />
    )
  }

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
          <p className={cn('text-xs', b.result.ok ? 'text-accent-teal-solid' : 'text-destructive')}>{b.result.message}</p>
        )}

        <button
          type="button"
          disabled={!b.canSubmit}
          onClick={() => { b.setResult(null); b.submitMutation.mutate() }}
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          {b.submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {b.isEdit ? 'Save changes' : 'Submit for approval'}
        </button>
      </div>

      <div className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">LIVE PREVIEW</p>
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
