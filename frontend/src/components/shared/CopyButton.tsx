import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Shared copy-to-clipboard affordance — per DESIGN.md §5 "same pattern =
 * same component." Founder-caught gap (2026-08-07): API responses, Inbox
 * content, and webhook payloads had no copy affordance anywhere, forcing
 * manual text selection.
 */
export default function CopyButton({
  value,
  label = 'Copy',
  className,
  size = 'sm',
}: {
  value: string
  label?: string
  className?: string
  size?: 'sm' | 'icon'
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail silently
      // rather than throw for a non-critical convenience action.
    }
  }

  if (size === 'icon') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : label}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground',
          className
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-brand-green" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground',
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
