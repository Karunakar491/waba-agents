// Shared between TemplateSettingsPage's Advanced audit panel and
// TemplateDebugPage (2026-08-12, V2 rebrand slice 4f) — one redaction
// implementation, not two copies of security-sensitive logic that could
// drift out of sync. Client-side belt only: the server (api_call_logger.py)
// already redacts before writing to api_call_log; this is a second layer,
// never the only one.
export function redactSecrets(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    return JSON.stringify(redactValue(parsed), null, 2)
  } catch {
    return raw
      .replace(/(api[_-]?key|client_secret|authorization|bearer)\s*[:=]\s*["']?[^"'&\s,}]+/gi, '$1=[REDACTED]')
  }
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key|client_secret|authorization|password|token/i.test(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redactValue(v)
      }
    }
    return out
  }
  return value
}
