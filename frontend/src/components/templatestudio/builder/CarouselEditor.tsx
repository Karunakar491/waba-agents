import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import ErrorBanner from '../../shared/ErrorBanner'
import ButtonsEditor from './ButtonsEditor'
import type { ButtonDraft, CarouselCardDraft, CarouselHeaderFormat } from '../templateModel'

// New (TASKS.md #12) — closes the data-loss risk where opening an existing
// CAROUSEL template in the manual editor and saving would silently strip
// its cards, since seedFromComponents had nowhere to put them.
export default function CarouselEditor({
  enabled, onEnabledChange,
  headerFormat, onHeaderFormatChange,
  hasBody, onHasBodyChange,
  hasButtons, onHasButtonsChange,
  cards, onAddCard, onRemoveCard, onCardBodyTextChange, onCardButtonsChange,
  uploadCardMediaMutation,
}: {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  headerFormat: CarouselHeaderFormat
  onHeaderFormatChange: (f: CarouselHeaderFormat) => void
  hasBody: boolean
  onHasBodyChange: (v: boolean) => void
  hasButtons: boolean
  onHasButtonsChange: (v: boolean) => void
  cards: CarouselCardDraft[]
  onAddCard: () => void
  onRemoveCard: (index: number) => void
  onCardBodyTextChange: (index: number, text: string) => void
  onCardButtonsChange: (index: number, updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void
  uploadCardMediaMutation: { mutate: (v: { file: File; cardIndex: number }) => void; isPending: boolean }
}) {
  const [openCard, setOpenCard] = useState(0)

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">Add carousel</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shows a swipeable set of 2-10 cards alongside the body text above. Each card needs its own image or video.
          </p>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} label="Add carousel" />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-foreground">Card media type</label>
              <select
                value={headerFormat}
                onChange={(e) => onHeaderFormatChange(e.target.value as CarouselHeaderFormat)}
                className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={hasBody} onChange={(e) => onHasBodyChange(e.target.checked)} />
              Each card has body text
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={hasButtons} onChange={(e) => onHasButtonsChange(e.target.checked)} />
              Each card has buttons
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            These three choices apply to every card — Meta requires all cards in one carousel to share the same shape.
          </p>

          {cards.map((card, i) => (
            <div key={i} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenCard(openCard === i ? -1 : i)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                <span>Card {i + 1}{card.headerHandle ? ' — media uploaded' : ''}</span>
                <span className="flex items-center gap-2">
                  {cards.length > 2 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onRemoveCard(i) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemoveCard(i) } }}
                      aria-label={`Remove card ${i + 1}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span>{openCard === i ? '−' : '+'}</span>
                </span>
              </button>
              {openCard === i && (
                <div className="space-y-2 border-t p-3">
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept={headerFormat === 'IMAGE' ? 'image/*' : 'video/*'}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCardMediaMutation.mutate({ file: f, cardIndex: i }) }}
                      className="text-xs text-foreground"
                    />
                    {uploadCardMediaMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {card.headerHandle && <p className="text-xs text-accent-teal-solid">Media uploaded.</p>}
                    {card.mediaError && <ErrorBanner error={card.mediaError} />}
                  </div>
                  {hasBody && (
                    <input
                      type="text"
                      value={card.bodyText}
                      onChange={(e) => onCardBodyTextChange(i, e.target.value)}
                      placeholder="Card body text"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
                    />
                  )}
                  {hasButtons && (
                    <ButtonsEditor buttons={card.buttons} setButtons={(updater) => onCardButtonsChange(i, updater)} />
                  )}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            disabled={cards.length >= 10}
            onClick={onAddCard}
            className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add card ({cards.length}/10)
          </button>
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2',
        checked ? 'bg-accent-teal-solid' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-surface-resting transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
