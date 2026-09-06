import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * An identifier that is too long to read and only useful pasted somewhere else.
 *
 * Meta's agent id is ~110 characters ("pfbid0827eUTZVLf2C9zGaaVGmjRweT8B…").
 * Printing it in full would take over the row; printing our own internal id
 * instead — which is what the list used to do — gives the operator a number
 * that means nothing to Meta support, which is the one place they need it.
 *
 * So: show enough to recognise it, copy all of it on click. The founder was
 * explicit that clicking the id itself copies, rather than a separate button
 * sitting beside it.
 *
 * Inside a clickable table row, the click must not also open the row — copying
 * an id and being navigated away from the list is a small betrayal that costs
 * the user their place.
 */
export default function CopyableId({
  value,
  label,
  visibleChars = 10,
}: {
  /** Null when the thing has no id yet — renders as an em dash, never as "null". */
  value: string | null
  /** What this identifies, for screen readers: "Meta agent ID for Support Bot". */
  label: string
  visibleChars?: number
}) {
  const [copied, setCopied] = useState(false)

  // Clears itself, and cleans up if the row unmounts first — this list
  // re-renders on every poll, and a timer outliving its component is how this
  // project has produced state-update-after-unmount warnings before.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  if (!value) {
    return (
      <span className="text-muted-foreground" title="This agent has never been deployed to Meta">
        —
      </span>
    )
  }

  const shown = value.length > visibleChars ? `${value.slice(0, visibleChars)}…` : value

  async function copy(event: React.MouseEvent) {
    // The row underneath navigates. Copying must not also move the user.
    event.stopPropagation()
    // Captured before the await: React nulls currentTarget once the handler
    // returns, so reading it in the catch would throw instead of falling back.
    const node = event.currentTarget as HTMLElement
    try {
      await navigator.clipboard.writeText(value!)
      setCopied(true)
    } catch {
      // Clipboard access can be refused outright (insecure context, or the
      // user denied permission). Saying nothing would look like a dead
      // control, so fall back to selecting the text so they can copy it
      // themselves.
      const range = document.createRange()
      range.selectNodeContents(node)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-xs text-muted-foreground
        transition-colors hover:bg-muted hover:text-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
    >
      <span className="truncate">{shown}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-accent-teal-solid" aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      )}
      <span className="sr-only">{copied ? 'Copied' : ''}</span>
    </button>
  )
}
