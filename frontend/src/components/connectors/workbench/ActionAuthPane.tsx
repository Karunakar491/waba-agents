import { AlertTriangle, Plus, X } from 'lucide-react'
import PropertyTable, { type PropertyRow } from './PropertyTable'
import { AUTH_TYPES, type AuthHeaderField, type ConnectorFormValues } from '../connectorLibrary'

/**
 * An action's Authorization tab, built to `design/ActionAuth.dc.html`.
 *
 * The one screen in the canvas where a connector's own settings are edited:
 * base URL, auth type, the credential fields and the client certificate. Not
 * on the connector's page — "editable here because this is where it is used".
 *
 * Which makes the warning at the top load-bearing rather than decorative. Meta
 * keeps `base_url` and `auth_config` on the connector and a tool cannot carry a
 * credential of its own, so editing any of this from one action changes it for
 * every action on the connector. The line says how many.
 *
 * Credential VALUES are never here and never stored: the Value column says so
 * on every row. They are typed at publish time and go straight to Meta.
 */
export default function ActionAuthPane({
  form,
  actionCount,
  saving,
  onChange,
  onSave,
  dirty,
}: {
  form: ConnectorFormValues
  /** How many actions share this — the whole point of the warning. */
  actionCount: number
  saving: boolean
  onChange: (form: ConnectorFormValues) => void
  onSave: () => void
  dirty: boolean
}) {
  const headers = form.headers.length > 0 ? form.headers : []
  const needsCredentials = form.authType === 'API_KEY'

  function setHeader(index: number, patch: Partial<AuthHeaderField>) {
    const next = headers.map((h, i) => (i === index ? { ...h, ...patch } : h))
    onChange({ ...form, headers: next })
  }

  const rows: PropertyRow[] = [
    {
      label: 'Base URL',
      value: form.baseUrl,
      placeholder: 'https://api.example.com',
      mono: true,
      onChange: (value) => onChange({ ...form, baseUrl: value }),
    },
    {
      label: 'Auth',
      value: form.authType,
      placeholder: 'No auth',
      display: (
        <span className="text-foreground">
          {AUTH_TYPES.find((a) => a.value === form.authType)?.label ?? form.authType}
        </span>
      ),
      options: AUTH_TYPES.map((a) => ({ value: a.value, label: a.label })),
      onChange: (value) => onChange({ ...form, authType: value }),
    },
    {
      label: 'Client certificate',
      value: form.requiresCertificate ? 'required' : '',
      placeholder: 'Not required',
      options: [
        { value: '', label: 'Not required' },
        { value: 'required', label: 'Required (mTLS)' },
      ],
      onChange: (value) => onChange({ ...form, requiresCertificate: value === 'required' }),
    },
  ]

  return (
    <div className="max-w-[900px] space-y-3">
      <p className="flex items-center gap-2.5 text-xs text-warning">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Shared by all {actionCount} {actionCount === 1 ? 'action' : 'actions'} on this connector — a
        change here changes it for every one of them.
      </p>

      <PropertyTable rows={rows} disabled={saving} />

      {needsCredentials && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Credentials
          </h3>
          <div className="overflow-hidden rounded-[10px] border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="w-[180px] px-4 py-2 font-medium">Field</th>
                  <th className="w-[112px] px-4 py-2 font-medium">In</th>
                  <th className="w-[108px] px-4 py-2 font-medium">Prefix</th>
                  <th className="px-4 py-2 font-medium">Value</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {headers.map((header, i) => (
                  <tr key={i} className="h-11 border-b last:border-b-0">
                    <td className="px-4">
                      <input
                        type="text"
                        aria-label={`Credential field ${i + 1}`}
                        value={header.fieldName}
                        disabled={saving}
                        spellCheck={false}
                        onChange={(e) => setHeader(i, { fieldName: e.target.value })}
                        placeholder="e.g. X-API-Key"
                        className="w-full bg-transparent font-mono text-xs focus-visible:outline-none
                          focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </td>
                    <td className="px-4">
                      {/* Meta's api_key config accepts a credential in a header,
                          a query parameter or the body. Only Header is offered
                          because only headers are built today — the backend
                          reads headers and ignores the other two, so offering
                          them would be a control that quietly does nothing. */}
                      <select
                        aria-label={`Where credential ${i + 1} goes`}
                        value="header"
                        disabled
                        title="Query and body credentials are accepted by Meta but not built here yet"
                        className="w-full bg-transparent text-sm text-muted-foreground"
                      >
                        <option value="header">Header</option>
                      </select>
                    </td>
                    <td className="px-4">
                      <input
                        type="text"
                        aria-label={`Prefix for credential ${i + 1}`}
                        value={header.prefix ?? ''}
                        disabled={saving}
                        spellCheck={false}
                        onChange={(e) => setHeader(i, { prefix: e.target.value })}
                        placeholder="Prefix, e.g. Bearer"
                        className="w-full bg-transparent font-mono text-xs focus-visible:outline-none
                          focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </td>
                    <td className="px-4 text-xs text-muted-foreground">
                      Typed at publish — never stored here
                    </td>
                    <td className="px-2">
                      {headers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange({ ...form, headers: headers.filter((_, j) => j !== i) })
                          }
                          aria-label={`Remove credential ${header.fieldName || i + 1}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground
                            transition hover:bg-muted hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onChange({ ...form, headers: [...headers, { fieldName: '', prefix: '' }] })
              }
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-medium text-accent-teal-solid
                transition-colors hover:underline disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another header
            </button>
            <p className="text-xs text-muted-foreground">
              Header, query or body — Meta accepts a credential in all three; we send headers.
            </p>
          </div>
        </div>
      )}

      {/* Explicit, unlike the connector's own table: these rows change every
          action at once, so committing them is worth a deliberate press. */}
      {dirty && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex min-h-11 items-center rounded-lg bg-accent-teal-solid px-4 text-sm
            font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save connector'}
        </button>
      )}

      <p className="max-w-[820px] text-xs text-muted-foreground">
        Editable here because this is where it is used. It cannot be per-action — Meta keeps{' '}
        <code>base_url</code> and <code>auth_config</code> on the connector, and a tool cannot carry
        a credential of its own.
      </p>
    </div>
  )
}
