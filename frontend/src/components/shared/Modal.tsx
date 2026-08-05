import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The ONE way a dialog renders in this app — per DESIGN.md §4/§6. Every
 * hand-rolled `fixed inset-0` overlay in the codebase (found in 9 places as
 * of the 2026-08-05 acquisition-grade audit) reimplemented this inconsistently:
 * some suppressed Escape during an in-flight mutation but forgot the X button
 * (SkillEditorModal, DeleteFromMetaModal), none had a real focus trap, none
 * had backdrop-click-dismiss consistently wired. This component owns all of
 * it once — focus trap, initial focus, restore focus to the trigger on close,
 * Escape/backdrop/X all gated by the same `preventClose` flag (pass your
 * mutation's `isPending`), `role="dialog"` + `aria-modal` + `aria-labelledby`.
 *
 * Callers own only the CONTENT (title text + body + footer buttons) — never
 * the chrome. Do not add a second backdrop/close-button inside `children`.
 */
export default function Modal({
  title,
  onClose,
  children,
  preventClose = false,
  maxWidthClassName = 'max-w-md',
}: {
  /** Plain string for the common case; a styled node (icon + colored text)
   *  for higher-stakes dialogs that need a distinct visual signal — either
   *  way it's what `aria-labelledby` points at. */
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  /** Suppress Escape/backdrop/X while true — pass your mutation's isPending. */
  preventClose?: boolean
  maxWidthClassName?: string
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerElementRef = useRef<Element | null>(null)

  // `preventClose` legitimately flips mid-lifetime (a mutation going
  // isPending true→false) — that must NOT re-run trigger-capture/initial-
  // focus/restore-on-unmount, or every mutation would yank focus out of the
  // modal and permanently clobber the real trigger reference (EL round-1
  // REJECT, 2026-08-05). Read the latest value via ref inside the listener
  // instead of putting it in the effect's dependency array.
  const preventCloseRef = useRef(preventClose)
  useEffect(() => {
    preventCloseRef.current = preventClose
  }, [preventClose])

  useEffect(() => {
    triggerElementRef.current = document.activeElement
    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (preventCloseRef.current) {
        // Still trap Tab even while a mutation is in flight — only the
        // dismiss actions (Escape/backdrop/X) are suppressed, not navigation.
      } else if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus()
      }
    }
    // Mount/unmount only — deliberately NOT depending on onClose/preventClose,
    // see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => { if (!preventClose) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full rounded-2xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto',
          maxWidthClassName,
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </div>
          <button
            type="button"
            onClick={() => { if (!preventClose) onClose() }}
            disabled={preventClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
