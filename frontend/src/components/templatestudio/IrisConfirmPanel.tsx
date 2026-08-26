import { Check, X } from 'lucide-react'
import Button from '../shared/Button'
import ConsequenceLine from '../shared/ConsequenceLine'
import WhatsAppTemplatePreview from '../templatestudio/WhatsAppTemplatePreview'
import {
  type ButtonDraft,
  type ButtonType,
  type CarouselCardDraft,
  type HeaderFormat,
} from '../templatestudio/templateModel'

interface PreviewComponent {
  type: string
  format?: string
  text?: string
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string; example?: string | string[] }>
  example?: { header_handle?: string[] }
  cards?: Array<{ components: PreviewComponent[] }>
}

export function previewPropsFromArgs(args: Record<string, unknown>) {
  const components = (args.components as PreviewComponent[] | undefined) ?? []
  const header = components.find((c) => c.type === 'HEADER')
  const body = components.find((c) => c.type === 'BODY')
  const footer = components.find((c) => c.type === 'FOOTER')
  const rawButtons = components.find((c) => c.type === 'BUTTONS')?.buttons ?? []
  const category = typeof args.category === 'string' ? args.category : ''
  const isAuthentication = category === 'AUTHENTICATION'
    || rawButtons.some((b) => b.type === 'OTP')
    || body?.text === '{{1}}'

  const buttons: ButtonDraft[] = rawButtons
    .filter((b) => b.type !== 'OTP')
    .map((b) => ({
      type: ((b.type || 'QUICK_REPLY').toUpperCase() as ButtonType),
      text: b.text || '',
      url: b.url || '',
      phoneNumber: b.phone_number || '',
      code: typeof b.example === 'string' ? b.example : (b.example?.[0] || ''),
    }))

  const carouselComponent = components.find((c) => c.type === 'CAROUSEL')
  const cards: CarouselCardDraft[] = (carouselComponent?.cards ?? []).map((card) => {
    const cardComponents = card.components ?? []
    const cardHeader = cardComponents.find((cc) => cc.type === 'HEADER')
    const cardBody = cardComponents.find((cc) => cc.type === 'BODY')
    const cardButtonsComponent = cardComponents.find((cc) => cc.type === 'BUTTONS')
    return {
      headerHandle: cardHeader?.example?.header_handle?.[0] || '',
      mediaError: null,
      bodyText: cardBody?.text || '',
      buttons: (cardButtonsComponent?.buttons || []).map((b) => ({
        type: ((b.type || 'QUICK_REPLY').toUpperCase() as ButtonType),
        text: b.text || '',
        url: b.url || '',
        phoneNumber: b.phone_number || '',
        code: typeof b.example === 'string' ? b.example : (b.example?.[0] || ''),
      })),
    }
  })

  return {
    headerFormat: (header?.format as HeaderFormat) || 'NONE',
    headerText: header?.text || '',
    headerHandleFilename: header?.example?.header_handle?.[0] || '',
    bodyText: body?.text || '',
    footerText: footer?.text || '',
    buttons: isAuthentication ? [] : buttons,
    isAuthentication,
    carouselEnabled: !!carouselComponent,
    cards,
  }
}

function humanToolTitle(toolName: string): string {
  if (toolName === 'create_template') return 'Submit template to Meta'
  if (toolName === 'edit_template') return 'Submit template edit to Meta'
  if (toolName === 'send_test_template') return 'Send test template'
  return toolName.replace(/_/g, ' ')
}

function confirmLabel(toolName: string): string {
  if (toolName === 'send_test_template') return 'Send test'
  return 'Submit to Meta'
}

function NonTemplateSummary({ toolName, args }: { toolName: string; args: Record<string, unknown> }) {
  const rows: Array<{ label: string; value: string }> = []
  if (typeof args.templateName === 'string') rows.push({ label: 'Template', value: args.templateName })
  if (typeof args.wabaId === 'string' || typeof args.wabaId === 'number') {
    rows.push({ label: 'WABA', value: String(args.wabaId) })
  }
  if (typeof args.to === 'string') rows.push({ label: 'Recipient', value: args.to })
  if (typeof args.phoneNumber === 'string') rows.push({ label: 'Recipient', value: args.phoneNumber })
  if (Array.isArray(args.parameterValues) && args.parameterValues.length > 0) {
    rows.push({ label: 'Variables', value: args.parameterValues.map(String).join(', ') })
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Review the details Iris drafted for <span className="font-medium text-foreground">{humanToolTitle(toolName)}</span>, then confirm.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg border bg-background px-3 py-1.5 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</p>
          <p className="text-foreground">{r.value}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * Docked confirm pane (not Modal) — DESIGN.md §6: must stay visible beside
 * Iris's reasoning. Reuses WhatsAppTemplatePreview + ConsequenceLine.
 */
export default function IrisConfirmPanel({
  toolName,
  args,
  attachmentPreviews,
  onConfirm,
  onCancel,
  confirming,
  cancelling,
}: {
  toolName: string
  args: Record<string, unknown>
  /** filename -> local object URL, for rendering a real thumbnail instead of a placeholder. */
  attachmentPreviews?: Map<string, string>
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
  cancelling: boolean
}) {
  const isTemplateAction = toolName === 'create_template' || toolName === 'edit_template'
  const busy = confirming || cancelling
  const preview = isTemplateAction ? previewPropsFromArgs(args) : null
  const headerPreviewUrl = preview?.headerHandleFilename
    ? attachmentPreviews?.get(preview.headerHandleFilename)
    : undefined

  return (
    <div className="flex h-full flex-col border-l bg-muted/20">
      <div className="border-b px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Review before submitting
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-foreground">{humanToolTitle(toolName)}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Compare with Iris&apos;s reply on the left — this is exactly what gets submitted.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isTemplateAction && preview ? (
          <>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {typeof args.templateName === 'string' && (
                <MetaChip label="Name" value={args.templateName} />
              )}
              {typeof args.category === 'string' && (
                <MetaChip label="Category" value={args.category} />
              )}
              {typeof args.language === 'string' && (
                <MetaChip label="Language" value={args.language} />
              )}
            </div>
            <WhatsAppTemplatePreview {...preview} headerPreviewUrl={headerPreviewUrl} />
          </>
        ) : (
          <NonTemplateSummary toolName={toolName} args={args} />
        )}
      </div>

      <div className="space-y-3 border-t p-4">
        <ConsequenceLine tone="warning">
          Submitting sends this exact content to Meta / Karix — this cannot be undone from here.
        </ConsequenceLine>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" fullWidth disabled={busy} loading={confirming} onClick={onConfirm}>
            {!confirming && <Check className="h-4 w-4" />}
            {confirmLabel(toolName)}
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-foreground" title={value}>{value}</p>
    </div>
  )
}
