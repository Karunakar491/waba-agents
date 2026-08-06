import {
  AUTH_BODY_TEXT,
  type ButtonDraft,
  type HeaderFormat,
} from './templateModel'

export default function WhatsAppTemplatePreview({
  headerFormat,
  headerText,
  bodyText,
  footerText,
  buttons,
  isAuthentication,
}: {
  headerFormat: HeaderFormat
  headerText: string
  bodyText: string
  footerText: string
  buttons: ButtonDraft[]
  isAuthentication: boolean
}) {
  const body = isAuthentication ? AUTH_BODY_TEXT : bodyText
  const previewButtons = isAuthentication
    ? [{ type: 'QUICK_REPLY' as const, text: 'Copy code', url: '', phoneNumber: '' }]
    : buttons

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-surface-resting">
      <div className="flex items-center gap-2 bg-whatsapp-header px-3 py-2 text-xs font-semibold text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
        WhatsApp preview
      </div>
      <div className="min-h-[180px] bg-whatsapp-canvas p-4">
        <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-whatsapp-bubble px-3 py-2 text-[13px] leading-relaxed text-whatsapp-ink shadow-sm">
          {headerFormat === 'TEXT' && headerText && (
            <p className="mb-1 font-semibold">{headerText}</p>
          )}
          {headerFormat !== 'NONE' && headerFormat !== 'TEXT' && (
            <p className="mb-1 text-xs italic text-whatsapp-ink/60">[{headerFormat.toLowerCase()} header]</p>
          )}
          <p>
            {body.trim()
              ? body
              : <span className="italic text-whatsapp-ink/40">Body text will appear here…</span>}
          </p>
          {footerText.trim() && !isAuthentication && (
            <p className="mt-1 text-xs text-whatsapp-ink/50">{footerText}</p>
          )}
          {previewButtons.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-px border-t border-whatsapp-ink/10 pt-1">
              {previewButtons.map((b, i) => (
                <span key={i} className="py-1.5 text-center text-xs font-semibold text-whatsapp-header">
                  {b.text || 'Button'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
