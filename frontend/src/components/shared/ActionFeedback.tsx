import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'

/**
 * Says that something worked.
 *
 * The product had no way to do this. An audit on 2026-09-06 counted 77
 * mutations in the frontend and exactly one visible success confirmation, while
 * ErrorBanner appeared in 42 files — articulate about failure, mute about
 * success. That teaches the user that silence means nothing happened, which is
 * why a genuinely dead control (the agent page's Disconnect button, an empty
 * handler with a TODO in it) was indistinguishable from a working one.
 *
 * Deliberately not a general-purpose notification system. It does one thing:
 * confirm a completed action. Failures keep going to ErrorBanner, in place,
 * next to the thing that failed — an error that slides away after four seconds
 * is an error the user can miss, and these actions reach live customers.
 *
 * Announced with role="status" and aria-live="polite", so it reaches a screen
 * reader without interrupting whatever is being read.
 */

export interface Confirmation {
  id: number
  message: string
  /** Optional second line: what it affected, e.g. the phone number. */
  detail?: string
}

interface FeedbackApi {
  /**
   * Confirm a finished action. Say what happened and to what — "Skill saved",
   * "Persona published", with the number or name as the detail. Never "Success".
   */
  confirm: (message: string, detail?: string) => void
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

const VISIBLE_MS = 4000

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Confirmation[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const confirm = useCallback((message: string, detail?: string) => {
    const id = nextId.current++
    setItems((prev) => {
      // More than three at once means something is looping, and stacking them
      // would bury the screen rather than inform anyone.
      const next = [...prev, { id, message, detail }]
      return next.slice(-3)
    })
  }, [])

  const api = useMemo(() => ({ confirm }), [confirm])

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        // Fixed, bottom-centre, above everything including modals. pointer-events
        // are off on the container so a confirmation can never swallow a click
        // meant for the page underneath; the dismiss button turns them back on.
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <ConfirmationToast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

function ConfirmationToast({ item, onDismiss }: { item: Confirmation; onDismiss: () => void }) {
  // Cleans itself up if the app navigates away first — a timer outliving its
  // component is how this project has produced update-after-unmount warnings.
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border bg-card px-4 py-3
        shadow-surface-lifted"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-teal/15">
        <Check className="h-3 w-3 text-accent-teal-solid" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.message}</p>
        {item.detail && <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.detail}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground
          transition-colors hover:bg-muted hover:text-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Confirm a finished action.
 *
 * Safe to call outside the provider — it becomes a no-op rather than throwing.
 * A missing confirmation is a flaw; a white screen because a provider was not
 * mounted in some test or storybook is a bug.
 */
export function useActionFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  return ctx ?? NO_OP
}

const NO_OP: FeedbackApi = { confirm: () => {} }
