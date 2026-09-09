import PropertyTable, { type PropertyRow } from './PropertyTable'
import type { ConnectorFormValues } from '../connectorLibrary'

/**
 * A connector that does not exist yet, built to `design/NewConnector.dc.html`.
 *
 * The same property table as the saved connector, the same Actions heading, the
 * same Agents strip — the screen does not change shape when the object comes
 * into being. What differs is that everything is empty and Publish is greyed,
 * which is the artboard's own answer to "what does this look like with nothing
 * in it": not a different screen, the same screen with placeholders.
 *
 * Actions and Agents are shown but inert, and say why. Meta needs a connector
 * before it can hold an action, so a table that accepted rows here would be
 * collecting them for something with no id. Naming the reason beats hiding the
 * sections and having them appear from nowhere a moment later.
 */
export default function NewConnectorPane({
  form,
  saving,
  error,
  onChange,
  onCreate,
  onCancel,
}: {
  form: ConnectorFormValues
  saving: boolean
  error: string | null
  onChange: (form: ConnectorFormValues) => void
  onCreate: () => void
  onCancel: () => void
}) {
  const rows: PropertyRow[] = [
    {
      label: 'Name',
      value: form.name,
      placeholder: 'what this connector is called',
      onChange: (value) => onChange({ ...form, name: value }),
    },
    {
      label: 'Description',
      value: form.description,
      placeholder: 'what this API is for',
      multiline: true,
      onChange: (value) => onChange({ ...form, description: value }),
    },
    {
      label: 'Tags',
      value: form.tags,
      placeholder: 'none yet',
      onChange: (value) => onChange({ ...form, tags: value }),
    },
    {
      label: 'Base URL',
      value: form.baseUrl,
      placeholder: 'https://api.example.com',
      mono: true,
      onChange: (value) => onChange({ ...form, baseUrl: value }),
    },
  ]

  // Meta rejects a connector without these, so they are asked for here rather
  // than accepted and refused on the way out.
  const missing = [
    !form.name.trim() && 'a name',
    !form.description.trim() && 'a description',
    !form.baseUrl.trim() && 'a base URL',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <PropertyTable rows={rows} disabled={saving} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCreate}
          disabled={missing.length > 0 || saving}
          className="flex min-h-11 items-center rounded-lg bg-accent-teal-solid px-4 text-sm
            font-semibold text-white transition-opacity hover:opacity-90
            disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create connector'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        {missing.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Still needed: <span className="text-foreground">{missing.join(', ')}</span>
          </span>
        )}
      </div>

      {error && <p className="max-w-[820px] text-xs text-destructive">{error}</p>}

      <section aria-label="Actions" className="space-y-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actions
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">0</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Available once this connector exists — an action belongs to a connector, so there is
          nothing to attach one to yet.
        </p>
      </section>

      <section aria-label="Agents" className="max-w-[980px]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Agents
          </h2>
          <span className="text-sm text-muted-foreground">Not on any agent</span>
          <span
            title="Create it and add an action first"
            className="ml-auto flex min-h-11 items-center rounded-lg border px-3.5 text-xs
              font-semibold text-muted-foreground"
          >
            Publish
          </span>
        </div>
      </section>
    </div>
  )
}
