/**
 * Makes a tool-run result readable.
 *
 * Meta wraps a tool response three deep and JSON-encodes at each level, so the
 * Run panel used to print this at an operator:
 *
 *   {"status":{"code":1},"body":"{\"output\":{\"status\":200,\"data\":\"<?xml version=…
 *
 * Every `<` arrives as `<`. The response is genuinely in there and genuinely
 * unreadable (docs/e2e-test-runs/2026-09-04-xml-tool-run.png). Since Run is the
 * only place anyone finds out whether a connector works, that made the one
 * verification step in the product useless.
 *
 * Meta is content-type aware: a JSON response arrives already parsed, anything
 * else (XML, CSV, plain text) arrives as a string. Both are handled here — a
 * string is shown as-is, an object is pretty-printed.
 */
export interface ToolRunView {
  /** true when the tool itself ran; false for a connector/transport failure. */
  ok: boolean
  /** HTTP status the partner API returned, when Meta reported one. */
  httpStatus: number | null
  /** The response body, ready to display. */
  body: string
  /** Response headers, if Meta included them. */
  headers: Record<string, string> | null
  /** Set when the run failed, in the clearest words available. */
  error: string | null
  /** Always kept so an operator can fall back to the envelope. */
  raw: string
}

function parseMaybe(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function display(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function describeToolRun(rawOutput: string | undefined | null): ToolRunView {
  const raw = rawOutput ?? ''
  const empty: ToolRunView = { ok: false, httpStatus: null, body: '', headers: null, error: null, raw }
  if (!raw.trim()) return { ...empty, error: 'The tool returned nothing at all.' }

  const envelope = asRecord(parseMaybe(raw))
  if (!envelope) return { ...empty, ok: true, body: raw }

  // status.code === 1 is Meta's success marker; anything else is a failure whose
  // message sits alongside it.
  const status = asRecord(envelope.status)
  const code = typeof status?.code === 'number' ? status.code : null
  const metaMessage = typeof status?.message === 'string' ? status.message : null

  const inner = asRecord(parseMaybe(envelope.body))
  const output = asRecord(inner?.output) ?? asRecord(envelope.output)

  const httpStatus = typeof output?.status === 'number' ? output.status : null
  const headers = asRecord(output?.headers) as Record<string, string> | null

  // The API's own body sits at output.data; when Meta gave us no envelope to
  // unwrap, fall back to whatever we did get rather than showing nothing.
  const data = output && 'data' in output ? output.data : (inner ?? envelope.body ?? envelope)
  const body = display(data)

  const failed = code !== null && code !== 1
  const httpFailed = httpStatus !== null && httpStatus >= 400

  let error: string | null = null
  if (failed) {
    error = metaMessage
      ? `Meta could not run this tool: ${metaMessage}`
      : 'Meta could not run this tool.'
  } else if (httpFailed) {
    error = `The API answered with HTTP ${httpStatus}.`
  }

  return { ok: !failed, httpStatus, body, headers, error, raw }
}
