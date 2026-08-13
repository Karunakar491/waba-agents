import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import ConsequenceLine from '../shared/ConsequenceLine'
import {
  AUTH_TYPES,
  isFormComplete,
  type ConnectorFormValues,
} from './connectorLibrary'

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

/**
 * Screen: Connector Library — the definition editor (inline panel, not a Modal).
 *
 * 1. USER GOAL: Describe an integration once so every agent can reuse it.
 * 2. EMOTIONAL STATE: Technical but cautious — "am I about to paste a secret
 *    into something that keeps it?"
 * 3. POSSIBLE ACTIONS: save the definition, cancel. Deploying is a separate,
 *    later decision.
 * 4. HOW WE HELP: the shape is here, the secrets are not. The panel says so
 *    in words, and there is deliberately no field to type a key into — that
 *    only appears at deploy time.
 *
 * DESIGN.md §6: inline panel over Modal, because the operator compares the
 * definition against the library cards behind it (same call as the Persona
 * draft editor).
 */
export default function ConnectorDefinitionEditor({
  isEditing,
  form,
  error,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  isEditing: boolean
  form: ConnectorFormValues
  error: string | null
  saving: boolean
  onChange: (form: ConnectorFormValues) => void
  onSave: () => void
  onCancel: () => void
}) {
  const set = (patch: Partial<ConnectorFormValues>) => onChange({ ...form, ...patch })

  return (
    <div className="rounded-xl border bg-card shadow-surface-resting">
      <div className="border-b px-4 py-3.5">
        <span className="text-sm font-semibold text-foreground">
          {isEditing ? 'Edit connector' : 'New connector'}
        </span>
      </div>

      <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
        {error && <p className="text-xs text-destructive">{error}</p>}

        <ConsequenceLine>
          This saves the definition only — nothing reaches Meta until you deploy it to an agent. API keys,
          client secrets and certificates are never stored here; you type them at deploy time.
        </ConsequenceLine>

        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Shopify Order Management"
            className={inputCls}
          />
        </Field>

        <Field label="Description — the agent reads this to know what it's for">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="e.g. Checks real order and delivery status in Shopify."
            className={cn(inputCls, 'resize-none')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Base URL">
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => set({ baseUrl: e.target.value })}
              placeholder="https://api.example.com"
              className={inputCls}
            />
          </Field>
          <Field label="System (our label — Meta has no such field)">
            <input
              type="text"
              value={form.systemType}
              onChange={(e) => set({ systemType: e.target.value })}
              placeholder="e.g. Shopify"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Auth type">
          <select
            value={form.authType}
            onChange={(e) => set({ authType: e.target.value })}
            className={inputCls}
          >
            {AUTH_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        {form.authType === 'API_KEY' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Header that carries the key">
              <input
                type="text"
                value={form.headerName}
                onChange={(e) => set({ headerName: e.target.value })}
                placeholder="e.g. X-API-Key"
                className={inputCls}
              />
            </Field>
            <Field label="Prefix (optional)">
              <input
                type="text"
                value={form.headerPrefix}
                onChange={(e) => set({ headerPrefix: e.target.value })}
                placeholder="e.g. Bearer "
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {form.authType === 'OAUTH2_CLIENT_CREDENTIALS' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Token URL">
                <input
                  type="url"
                  value={form.tokenUrl}
                  onChange={(e) => set({ tokenUrl: e.target.value })}
                  placeholder="https://api.example.com/oauth/token"
                  className={inputCls}
                />
              </Field>
              <Field label="Client ID">
                <input
                  type="text"
                  value={form.clientId}
                  onChange={(e) => set({ clientId: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Scopes (comma separated)">
              <input
                type="text"
                value={form.scopes}
                onChange={(e) => set({ scopes: e.target.value })}
                placeholder="read_orders, read_products"
                className={inputCls}
              />
            </Field>
          </>
        )}

        <Field label="Tags (comma separated)">
          <input
            type="text"
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder="e-commerce, orders"
            className={inputCls}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.requiresCertificate}
            onChange={(e) => set({ requiresCertificate: e.target.checked })}
            className="h-4 w-4 rounded border"
          />
          Requires a client certificate (mTLS)
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSave}
            disabled={saving || !isFormComplete(form)}
            className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
              text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEditing ? 'Save connector' : 'Create connector'}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
