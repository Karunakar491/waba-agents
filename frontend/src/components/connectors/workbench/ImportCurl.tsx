import { useState } from 'react'
import { AlertTriangle, ClipboardPaste } from 'lucide-react'
import { parseCurl, type ParsedCurl } from './parseCurl'

/**
 * Paste a cURL, get an action.
 *
 * Inline and collapsed, not a dialog. Every field it fills is already on the
 * screen behind it, so a modal would cover the thing it is about — and this
 * product has been told twice that an extra step to reach an obvious action is
 * the wrong shape.
 *
 * It shows what it could not represent BEFORE applying anything. That ordering
 * is the point: a cURL that uses a form post, a cookie or an XML body imports
 * into something that looks correct and never works, and the moment to learn
 * that is while the terminal window is still open — not when a customer's
 * message fails.
 */
export default function ImportCurl({
  connectorOrigin,
  onApply,
  disabled,
}: {
  /** The connector's own scheme and host, to compare against the pasted URL. */
  connectorOrigin: string
  onApply: (parsed: ParsedCurl) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedCurl | null>(null)
  const [unreadable, setUnreadable] = useState(false)

  function check() {
    const result = parseCurl(text)
    setParsed(result)
    setUnreadable(result === null)
  }

  /**
   * A different host is its own kind of problem, and not the parser's to know:
   * the base URL belongs to the connector, so a cURL for another host is a
   * request for a different connector rather than a request to fix.
   */
  const hostMismatch =
    parsed?.origin && connectorOrigin && parsed.origin !== connectorOrigin
      ? `That cURL calls ${parsed.origin}, but this connector's base URL is ${connectorOrigin}. ` +
        'Importing it will keep this connector\'s host, so the path may not exist. ' +
        'A different host needs its own connector.'
      : null

  const problems = [...(parsed?.problems ?? []), ...(hostMismatch ? [hostMismatch] : [])]

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs font-medium text-accent-teal-solid
          transition-colors hover:underline disabled:opacity-50"
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
        Import a cURL command
      </button>
    )
  }

  return (
    <section aria-label="Import a cURL command" className="space-y-2 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Paste the cURL</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setText('')
            setParsed(null)
            setUnreadable(false)
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <textarea
        rows={5}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value)
          setParsed(null)
          setUnreadable(false)
        }}
        placeholder="curl --location 'https://api.example.com/search?q=shoes' \&#10;  --header 'Content-Type: application/json' \&#10;  --data '{ &quot;q&quot;: &quot;shoes&quot; }'"
        spellCheck={false}
        className="w-full rounded-lg border bg-background p-2.5 font-mono text-xs
          placeholder:text-muted-foreground focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-primary"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={check}
          disabled={disabled || !text.trim()}
          className="min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors
            hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Check it
        </button>
        {parsed && (
          <button
            type="button"
            onClick={() => {
              onApply(parsed)
              setOpen(false)
              setText('')
              setParsed(null)
            }}
            className="min-h-11 rounded-lg bg-accent-teal-solid px-3 text-xs font-semibold text-white
              transition-opacity hover:opacity-90"
          >
            {problems.length > 0 ? 'Import anyway' : 'Import'}
          </button>
        )}
      </div>

      {unreadable && (
        <p className="text-xs text-destructive">
          That does not look like a cURL command. It has to start with <code>curl</code>.
        </p>
      )}

      {parsed && (
        <div className="space-y-2">
          {/* What it read, so nothing is applied unseen. */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Method</dt>
            <dd className="font-mono text-foreground">{parsed.method}</dd>
            <dt className="text-muted-foreground">Path</dt>
            <dd className="font-mono text-foreground">{parsed.path || '/'}</dd>
            {parsed.queryParams.length > 0 && (
              <>
                <dt className="text-muted-foreground">Query</dt>
                <dd className="font-mono text-foreground">
                  {parsed.queryParams.map((p) => `${p.key}=${p.value}`).join(', ')}
                </dd>
              </>
            )}
            {parsed.headers.length > 0 && (
              <>
                <dt className="text-muted-foreground">Headers</dt>
                <dd className="font-mono text-foreground">
                  {parsed.headers.map((h) => h.key).join(', ')}
                </dd>
              </>
            )}
            {parsed.credentialHeaders.length > 0 && (
              <>
                <dt className="text-muted-foreground">Credential</dt>
                {/* The name only. The value came off someone's clipboard and is
                    not going on screen, into the action, or into storage. */}
                <dd className="text-foreground">
                  {parsed.credentialHeaders.map((h) => h.key).join(', ')} — set on the connector,
                  and its value is not imported
                </dd>
              </>
            )}
            {parsed.body && (
              <>
                <dt className="text-muted-foreground">Body</dt>
                <dd className="text-foreground">
                  {parsed.body.length.toLocaleString()} characters — becomes the body fields
                </dd>
              </>
            )}
          </dl>

          {problems.length > 0 && (
            <ul className="space-y-1.5 rounded-lg bg-warning/10 p-2.5">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{problem}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
