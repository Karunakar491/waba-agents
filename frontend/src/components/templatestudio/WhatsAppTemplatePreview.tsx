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
  headerPreviewUrl,
  bodyText,
  footerText,
  buttons,
  isAuthentication,
  carouselEnabled = false,
  cards = [],
}: {
  headerFormat: HeaderFormat
  headerText: string
  headerPreviewUrl?: string
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
          {headerFormat === 'IMAGE' && headerPreviewUrl && !carouselEnabled && (
            <img src={headerPreviewUrl} alt="Header image preview" className="mb-1.5 h-32 w-full rounded-md object-cover" />
          )}
          {headerFormat !== 'NONE' && headerFormat !== 'TEXT' && !carouselEnabled
            && !(headerFormat === 'IMAGE' && headerPreviewUrl) && (
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
