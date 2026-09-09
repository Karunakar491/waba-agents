import { Loader2, Play } from 'lucide-react'
import { HTTP_METHODS } from '../connectorActions'
import { MethodBadge } from './WorkbenchSidebar'

/**
 * Method, path, and the button that actually calls the thing.
 *
 * Two departures from Postman, both because of what Meta's runtime does.
 *
 * The base URL is shown but not editable here — it belongs to the connector, so
 * every tool under it shares one. Letting someone type a full URL would imply
 * they could point one tool somewhere else, which needs a second connector.
 *
 * Send makes the call server-side and shows what came back. It said for months
 * that testing was impossible because "Meta makes the call, not us" — which
 * confused Meta calling it at runtime with nobody being able to call it at all.
 * When it is disabled now it is because the request is not complete, and the
 * button says which part.
 */
/** Host of a base URL, falling back to the raw string if it will not parse. */
function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl.replace(/^https?:\/\//, '').split('/')[0]
  }
}

export default function RequestBar({
  method,
  path,
  baseUrl,
  disabled,
  onMethodChange,
  onPathChange,
  onSend,
  sending,
  sendUnavailable,
}: {
  method: string
  path: string
  baseUrl: string
  disabled: boolean
  onMethodChange: (method: string) => void
  onPathChange: (path: string) => void
  onSend: () => void
  sending: boolean
  /** Why the request cannot be sent. Present = the button is disabled. */
  sendUnavailable?: string | null
}) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-primary">
        <label className="sr-only" htmlFor="wb-method">
          Method
        </label>
        <select
          id="wb-method"
          value={method}
          disabled={disabled}
          onChange={(e) => onMethodChange(e.target.value)}
          className="border-r bg-muted/40 px-3 py-2.5 font-mono text-xs font-semibold uppercase
            focus-visible:outline-none disabled:opacity-60"
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* The connector's base URL, stated so the path reads as a path rather
            than as a whole address the user might try to replace.

            Host only. Truncating the whole thing cut a Google Apps Script URL
            mid-token — "script.google.com/macros/s/AKfycbz6VEDS7HQ" — which
            tells you less than the host alone and looks like a rendering bug.
            The full value is on hover. */}
        <span
          className="hidden items-center border-r bg-muted/20 px-2.5 font-mono text-xs
            text-muted-foreground sm:flex"
          title={`${baseUrl} — set on the connector, shared by every action under it`}
        >
          {hostOf(baseUrl)}
        </span>

        <label className="sr-only" htmlFor="wb-path">
          Path
        </label>
        <input
          id="wb-path"
          type="text"
          value={path}
          disabled={disabled}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder="/orders/{order_id}"
          spellCheck={false}
          className="min-w-0 flex-1 bg-background px-3 py-2.5 font-mono text-sm
            placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
        />
      </div>

      <button
        type="button"
        onClick={onSend}
        disabled={disabled || sending || !!sendUnavailable}
        title={sendUnavailable ?? 'Call this endpoint now and show what comes back'}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold
          text-foreground transition-colors hover:bg-muted
          disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Send
      </button>
    </div>
  )
}

export { MethodBadge }
