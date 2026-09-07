import { Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import ConsequenceLine from '../shared/ConsequenceLine'
import {
  AUTH_TYPES,
  missingFields,
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
 *
 * `section` exists because a connector's page is tabbed like a Postman
 * collection: Details holds the identity and `base_url`, Authorization holds
 * `auth_type` and everything under it. Both halves edit ONE form object and
 * share one Save — splitting the state as well would let someone change the
 * auth type on one tab and save a stale base URL from the other. Creating a
 * connector still renders `all`, because there is nothing to tab between
 * before the thing exists.
 */
export default function ConnectorDefinitionEditor({
  isEditing,
  form,
  error,
  saving,
  onChange,
  onSave,
  onCancel,
  section = 'all',
  chrome = true,
}: {
  isEditing: boolean
  form: ConnectorFormValues
  error: string | null
  saving: boolean
  onChange: (form: ConnectorFormValues) => void
  onSave: () => void
  onCancel: () => void
  /** Which half to render. 'all' for the create form. */
  section?: 'all' | 'details' | 'auth'
  /** false inside a tab panel — a bordered card in a tab is card chrome twice. */
  chrome?: boolean
}) {
  const set = (patch: Partial<ConnectorFormValues>) => onChange({ ...form, ...patch })
  const stillNeeded = missingFields(form)
  const show = (part: 'details' | 'auth') => section === 'all' || section === part

  return (
    <div className={chrome ? 'rounded-xl border bg-card shadow-surface-resting' : ''}>
      {chrome && (
        <div className="border-b px-4 py-3.5">
          <span className="text-sm font-semibold text-foreground">
            {isEditing ? 'Edit connector' : 'New connector'}
          </span>
        </div>
      )}

      <div className={chrome ? 'space-y-3 border-t bg-muted/20 px-4 py-4' : 'space-y-3'}>
        {error && <p className="text-xs text-destructive">{error}</p>}

        {show('auth') && (
          <ConsequenceLine>
            This saves the definition only — nothing reaches Meta until you deploy it to an agent. API keys,
            client secrets and certificates are never stored here; you type them at deploy time.
          </ConsequenceLine>
        )}

        {show('details') && (
        <>
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

        {/* "System" used to sit beside this, labelled "our label — Meta has no
            such field", which is the kind of thing a form should never have to
            admit. Its only use anywhere was rendering one more chip in the
            connectors list, next to the free-text Tags field below that already
            does exactly that — so it asked the user to fill in a second tags
            box under a confusing name. The stored column stays (existing values
            still show, and mirrored connectors still get one guessed from their
            URL); we just stopped asking. */}
        <Field label="Base URL">
          <input
            type="url"
            value={form.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="https://api.example.com"
            className={inputCls}
          />
        </Field>

        <Field label="Tags (comma separated)">
          <input
            type="text"
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder="e-commerce, orders"
            className={inputCls}
          />
        </Field>
        </>
        )}

        {show('auth') && (
        <>
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
          <div className="space-y-2">
            <span className="block text-xs font-medium text-foreground">
              Headers that carry a credential
            </span>
            {/* A list, not one pair. Meta's api_key config takes an array and the
                backend has always built one — the form was the only thing
                insisting on a single header, which made an API needing two (a
                key plus an account id, say) impossible to configure at all. */}
            {form.headers.map((header, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="min-w-[10rem] flex-1 space-y-1.5">
                  <span className="sr-only">Header name</span>
                  <input
                    type="text"
                    value={header.fieldName}
                    onChange={(e) =>
                      set({
                        headers: form.headers.map((h, j) =>
                          j === i ? { ...h, fieldName: e.target.value } : h,
                        ),
                      })
                    }
                    placeholder="e.g. X-API-Key"
                    className={inputCls}
                  />
                </label>
                <label className="min-w-[8rem] flex-1 space-y-1.5">
                  <span className="sr-only">Prefix for {header.fieldName || 'this header'}</span>
                  <input
                    type="text"
                    value={header.prefix ?? ''}
                    onChange={(e) =>
                      set({
                        headers: form.headers.map((h, j) =>
                          j === i ? { ...h, prefix: e.target.value } : h,
                        ),
                      })
                    }
                    placeholder="Prefix, e.g. Bearer "
                    className={inputCls}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    set({
                      headers:
                        form.headers.length > 1
                          ? form.headers.filter((_, j) => j !== i)
                          : [{ fieldName: '', prefix: '' }],
                    })
                  }
                  aria-label={`Remove header ${header.fieldName || i + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border
                    text-muted-foreground transition hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ headers: [...form.headers, { fieldName: '', prefix: '' }] })}
              className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-accent-teal-solid
                transition-colors hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another header
            </button>
            <p className="text-xs text-muted-foreground">
              Names only here. You type each value when you deploy the connector to an agent, and
              it goes straight to Meta.
            </p>
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

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.requiresCertificate}
            onChange={(e) => set({ requiresCertificate: e.target.checked })}
            className="h-4 w-4 rounded border"
          />
          Requires a client certificate (mTLS)
        </label>
        </>
        )}

        {/* Says what is still needed instead of leaving a dead button. The
            blocker is usually the auth header, which sits further up and is
            easy to miss once the three obvious fields are filled. */}
        {stillNeeded.length > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            Still needed: <span className="text-foreground">{stillNeeded.join(', ')}</span>
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSave}
            disabled={saving || stillNeeded.length > 0}
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
