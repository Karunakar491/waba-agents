import { useState } from 'react'
import { ArrowLeft, ArrowRight, FileText, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTemplateBuilder } from './useTemplateBuilder'
import WhatsAppTemplatePreview from './WhatsAppTemplatePreview'
import TemplateSubmitSuccess from './TemplateSubmitSuccess'
import Stepper from '../shared/Stepper'
import TemplateMetaFields from './builder/TemplateMetaFields'
import VariableTypeSelector from './builder/VariableTypeSelector'
import HeaderEditor from './builder/HeaderEditor'
import BodyEditor from './builder/BodyEditor'
import AuthenticationEditor from './builder/AuthenticationEditor'
import FooterEditor from './builder/FooterEditor'
import LimitedTimeOfferEditor from './builder/LimitedTimeOfferEditor'
import ButtonsEditor from './builder/ButtonsEditor'
import CarouselEditor from './builder/CarouselEditor'
import ReviewSummary from './builder/ReviewSummary'
import ConsequenceLine from '../shared/ConsequenceLine'

const CREATE_STEPS = ['Set up template', 'Edit template', 'Submit for Review']

// Thin composer (V2 rebrand slice 7, restructured for the Create-flow
// Stepper per Figma node 172:41 — founder-approved DESIGN.md amendment).
// Edit mode stays flat (Figma node 93:18 has no stepper — name/category/
// language are locked on edit, so there's nothing to step through).
export default function TemplateBuilderForm({
  wabaId, mode, templateId, onDone,
}: {
  wabaId: string
  mode: 'create' | 'edit'
  templateId?: string
  onDone?: () => void
}) {
  const b = useTemplateBuilder({ wabaId, mode, templateId, onDone })
  const [step, setStep] = useState(1)

  if (b.submittedName !== null) {
    return (
      <TemplateSubmitSuccess
        templateName={b.submittedName}
        onBackToTemplates={() => onDone?.()}
        onCreateAnother={() => { b.resetForCreateAnother(); setStep(1) }}
      />
    )
  }

  const step1Ready = b.templateName.trim().length > 0 && b.language.trim().length > 0
  const ltoReady = !b.ltoEnabled || b.ltoText.trim().length > 0
  const step2Ready = b.isAuthentication ? !!b.otpExampleCode.trim() : b.bodyText.trim().length > 0 && ltoReady

  const fieldsCard = (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-surface-resting">
      {!b.isEdit && step === 1 && (
        <>
          <TemplateMetaFields
            templateName={b.templateName} setTemplateName={b.setTemplateName}
            language={b.language} setLanguage={b.setLanguage}
            category={b.category} setCategory={b.setCategory}
          />
          {!b.isAuthentication && (
            <VariableTypeSelector value={b.variableFormat} onChange={b.setVariableFormat} />
          )}
        </>
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

      {(b.isEdit || step === 2) && (!b.isEdit || b.seeded) && b.isAuthentication && (
        <AuthenticationEditor
          codeExpirationMinutes={b.codeExpirationMinutes} setCodeExpirationMinutes={b.setCodeExpirationMinutes}
          otpExampleCode={b.otpExampleCode} setOtpExampleCode={b.setOtpExampleCode}
        />
      )}
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
          {b.category === 'MARKETING' && (
            <CarouselEditor
              enabled={b.carouselEnabled} onEnabledChange={b.enableCarousel}
              headerFormat={b.carouselHeaderFormat} onHeaderFormatChange={b.setCarouselHeaderFormat}
              hasBody={b.carouselHasBody} onHasBodyChange={b.setCarouselHasBody}
              hasButtons={b.carouselHasButtons} onHasButtonsChange={b.setCarouselHasButtons}
              cards={b.cards} onAddCard={b.addCard} onRemoveCard={b.removeCard}
              onCardBodyTextChange={b.setCardBodyText} onCardButtonsChange={b.setCardButtons}
              uploadCardMediaMutation={b.uploadCardMediaMutation}
            />
          )}
        </>
      )}

      {!b.isEdit && step === 3 && (
        <ReviewSummary
          templateName={b.templateName} language={b.language} category={b.category}
          bodyText={b.bodyText}
        />
      )}

      <ConsequenceLine>
        {b.isEdit
          ? 'This resubmits the template for Meta review — it won’t send until re-approved.'
          : 'This submits the template to Meta for approval — it won’t be usable until approved.'}
      </ConsequenceLine>

      {b.result && (
        <p className={cn('text-xs', b.result.ok ? 'text-accent-teal-solid' : 'text-destructive')}>{b.result.message}</p>
      )}

      {b.isEdit && (
        <button
          type="button"
          disabled={!b.canSubmit}
          onClick={() => { b.setResult(null); b.submitMutation.mutate() }}
          className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          {b.submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Save changes
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {!b.isEdit && <Stepper steps={CREATE_STEPS} currentStep={step} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        {fieldsCard}
        <div className="space-y-2 lg:sticky lg:top-6 lg:self-start">
          <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">LIVE PREVIEW</p>
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
        </div>
      </div>

      {!b.isEdit && (
        <div className="flex items-center justify-between border-t pt-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < 3 ? (
            <div className="flex items-center gap-5">
              <span className="text-sm text-muted-foreground">{CREATE_STEPS[step - 1]}</span>
              <button
                type="button"
                disabled={step === 1 ? !step1Ready : !step2Ready}
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                Next Step
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!b.canSubmit}
              onClick={() => { b.setResult(null); b.submitMutation.mutate() }}
              className="flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              {b.submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Submit for approval
            </button>
          )}
        </div>
      )}
    </div>
  )
}

