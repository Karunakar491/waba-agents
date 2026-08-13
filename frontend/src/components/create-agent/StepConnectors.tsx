import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Library, Plug, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import ConnectorDeployModal from '../connectors/ConnectorDeployModal'
import type { LibraryConnector } from '../connectors/connectorLibrary'
import {
  BottomBar,
  LinkAction,
  SectionCard,
  SelectField,
  StepHeader,
  TextField,
  WizardToggle,
} from './WizardChrome'

interface Connector {
  id: string
  name?: string
  description?: string
  base_url?: string
}

/** The three Figma chips are presets for the same standard shape below. */
const PRESETS: { label: string; base_url: string; description: string }[] = [
  {
    label: 'Shopify',
    base_url: 'https://your-store.myshopify.com/admin/api/2024-01',
    description: 'Checks real order and product status in Shopify.',
  },
  {
    label: 'Zendesk',
    base_url: 'https://your-subdomain.zendesk.com/api/v2',
    description: 'Looks up support tickets in Zendesk.',
  },
  { label: 'Custom API', base_url: '', description: '' },
]

const AUTH_TYPES = [
  { value: 'API_KEY', label: 'API_KEY' },
  { value: 'OAUTH2', label: 'OAUTH2' },
  { value: 'NONE', label: 'NONE' },
]

/**
 * Screen: Create Agent — Step 5, Connectors (Figma node 252:35)
 *
 * 1. USER GOAL: Let the agent reach a real system for things it can't know.
 * 2. EMOTIONAL STATE: This is the most technical step in the wizard — the
 *    copy says plainly that Iris can't invent this part.
 * 3. POSSIBLE ACTIONS: Start from a known system, define a custom one, or
 *    skip and add it later from the agent's settings.
 * 4. HOW WE HELP: One standard shape, with the API field names shown, so a
 *    system nobody pre-built still fits without a new screen.
 */
export default function StepConnectors({
  agentId,
  wabaId,
  onBack,
  onNext,
}: {
  agentId: string | null
  wabaId: string
  onBack: () => void
  onNext: () => void
}) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deployTarget, setDeployTarget] = useState<LibraryConnector | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    base_url: '',
    auth_type: 'API_KEY',
    header_name: '',
    header_value: '',
    requires_certificate: false,
  })

  const enabled = !!agentId
  const onError = (err: unknown) => setError(extractErrorMessage(err))

  const { data: connectors = [] } = useQuery<Connector[]>({
    queryKey: ['agent-connectors', agentId],
    queryFn: () => api.get(`/agents/${agentId}/connectors`).then((r) => r.data.data ?? []),
    enabled,
  })

  // The real Connector Library (V46) — reusable definitions, not the live
  // rollup. Picking one here deploys that definition onto this agent, which
  // records a connector_deployment row; the ad-hoc form below still exists
  // for one-off connectors nobody wants to reuse.
  const { data: libraryConnectors = [] } = useQuery<LibraryConnector[]>({
    queryKey: ['connector-library', wabaId],
    queryFn: () =>
      api.get('/connector-library', { params: { wabaId } }).then((r) => r.data.data ?? []),
    enabled: importOpen && !!wabaId,
  })

  const { data: agents = [] } = useQuery<{ id: string; displayName: string; phoneNumberId: string | null }[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data ?? []),
    enabled: !!agentId,
  })
  const thisAgent = agents.find((a) => a.id === agentId) ?? null

  const createConnector = useMutation({
    mutationFn: () =>
      api.post(`/agents/${agentId}/connectors`, {
        name: form.name.trim(),
        description: form.description.trim(),
        base_url: form.base_url.trim(),
        auth_type: form.auth_type,
        requires_certificate: form.requires_certificate,
        ...(form.auth_type === 'API_KEY' && form.header_name.trim()
          ? {
              auth_config: {
                headers: [{ field_name: form.header_name.trim(), value: form.header_value }],
              },
            }
          : {}),
      }),
    onSuccess: () => {
      setFormOpen(false)
      setForm({
        name: '',
        description: '',
        base_url: '',
        auth_type: 'API_KEY',
        header_name: '',
        header_value: '',
        requires_certificate: false,
      })
      void qc.invalidateQueries({ queryKey: ['agent-connectors', agentId] })
    },
    onError,
  })

  const deployFromLibrary = useMutation({
    mutationFn: ({ id, secrets }: { id: string; secrets: Record<string, string> }) =>
      api.post(`/connector-library/${id}/deploy`, { agentId, secrets }),
    onSuccess: () => {
      setDeployTarget(null)
      setDeployError(null)
      setImportOpen(false)
      void qc.invalidateQueries({ queryKey: ['agent-connectors', agentId] })
      void qc.invalidateQueries({ queryKey: ['connector-library', wabaId] })
    },
    onError: (err) => setDeployError(extractErrorMessage(err)),
  })

  const removeConnector = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${agentId}/connectors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-connectors', agentId] }),
    onError,
  })

  function startFromPreset(p: (typeof PRESETS)[number]) {
    setForm((f) => ({ ...f, name: p.label, base_url: p.base_url, description: p.description }))
    setFormOpen(true)
  }

  return (
    <>
      <StepHeader
        title="What systems does it need?"
        subtitle="For things it can't just know — like checking a real order status. Pick a real system to connect."
      />

      {error && (
        <div className="mb-6">
          <ErrorBanner error={error} />
        </div>
      )}

      <SectionCard
        title="Connect your systems"
        description="For things it can't just know — like checking a real order status. Iris can't invent these; pick a real system to connect."
        footnote="None of these? You can skip this step — add a connector any time from the agent's settings."
        actions={
          // The Connector Library is real now (V46), so this is a live
          // control: it lists reusable definitions and deploys one straight
          // onto this agent. Saving a NEW definition still happens on the
          // Library page — the wizard is where you use the library, not where
          // you curate it.
          <LinkAction
            onClick={() => setImportOpen((o) => !o)}
            icon={<Library className="h-4 w-4" />}
            disabled={!wabaId}
          >
            Import from Library
          </LinkAction>
        }
      >
        <div className="flex flex-wrap gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={!enabled}
              onClick={() => startFromPreset(p)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-foreground transition-colors',
                'hover:border-accent-teal disabled:cursor-not-allowed disabled:text-muted-foreground',
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-teal/10">
                <Plug className="h-4 w-4 text-accent-teal-solid" />
              </span>
              {p.label}
            </button>
          ))}
          <button
            type="button"
            disabled={!enabled}
            onClick={() => setFormOpen(true)}
            className="rounded-lg border border-dashed px-4 py-3 text-sm text-accent-teal-solid transition-colors hover:bg-accent-teal/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            + Add connector
          </button>
        </div>

        {importOpen && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-foreground">Your Connector Library</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reusable definitions. Deploying one here puts it on this agent — you only enter the credentials.
            </p>
            {libraryConnectors.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing saved to the library yet — build one below, or add it in Library → Connectors.
              </p>
            ) : (
              <ul className="mt-3 divide-y">
                {libraryConnectors.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.systemType ? `${c.systemType} · ` : ''}
                        {c.usedByAgentCount === 0
                          ? 'Not deployed yet'
                          : `Used by ${c.usedByAgentCount} agent${c.usedByAgentCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <LinkAction
                      onClick={() => {
                        setDeployError(null)
                        setDeployTarget(c)
                      }}
                    >
                      Deploy here
                    </LinkAction>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {connectors.length > 0 && (
          <ul className="divide-y">
            {connectors.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.name ?? c.id}</p>
                  {c.base_url && (
                    <p className="truncate text-xs text-muted-foreground">{c.base_url}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeConnector.mutate(c.id)}
                  aria-label={`Remove connector: ${c.name ?? c.id}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {formOpen && (
          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">New connector — standard shape</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Any external system your team adds later uses this same shape — no pre-built chip
                required.
              </p>
            </div>
            <TextField
              id="conn-name"
              label="Name"
              apiName="name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Custom Inventory API"
            />
            <TextField
              id="conn-description"
              label="Description"
              apiName="description"
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="e.g. Checks live stock counts for the warehouse system."
            />
            <TextField
              id="conn-base-url"
              label="Base URL"
              apiName="base_url"
              type="url"
              value={form.base_url}
              onChange={(v) => setForm((f) => ({ ...f, base_url: v }))}
              placeholder="e.g. https://api.yourinventory.com"
            />
            <SelectField
              id="conn-auth-type"
              label="Auth type"
              apiName="auth_type"
              value={form.auth_type}
              onChange={(v) => setForm((f) => ({ ...f, auth_type: v }))}
              options={AUTH_TYPES}
            />

            {form.auth_type === 'API_KEY' ? (
              <>
                <p className="text-xs text-muted-foreground">
                  auth_config fields change based on auth_type — API Key shown below.
                </p>
                <TextField
                  id="conn-header-name"
                  label="Header name"
                  apiName="auth_config.headers[].field_name"
                  value={form.header_name}
                  onChange={(v) => setForm((f) => ({ ...f, header_name: v }))}
                  placeholder="e.g. X-API-Key"
                />
                <TextField
                  id="conn-header-value"
                  label="Header value"
                  apiName="auth_config.headers[].value"
                  value={form.header_value}
                  onChange={(v) => setForm((f) => ({ ...f, header_value: v }))}
                  placeholder="e.g. your API key"
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {form.auth_type === 'OAUTH2'
                  ? 'OAuth2 credentials (token_url, client_id, client_secret, scopes) are entered on the connector after it exists — this wizard creates it with no secrets attached.'
                  : 'No credentials needed for this auth type.'}
              </p>
            )}

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-foreground">
                Requires certificate (mTLS){' '}
                <span className="text-xs text-muted-foreground">requires_certificate</span>
              </span>
              <WizardToggle
                checked={form.requires_certificate}
                onChange={(v) => setForm((f) => ({ ...f, requires_certificate: v }))}
                label="Requires certificate"
              />
            </div>

            <button
              type="button"
              disabled={!form.name.trim() || !form.base_url.trim() || createConnector.isPending}
              onClick={() => {
                setError(null)
                createConnector.mutate()
              }}
              className="h-10 w-full rounded-lg bg-accent-teal-solid px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Save & connect
            </button>
          </div>
        )}
      </SectionCard>

      {deployTarget && agentId && (
        <ConnectorDeployModal
          connector={deployTarget}
          agents={[
            {
              id: agentId,
              displayName: thisAgent?.displayName ?? 'This agent',
              phoneNumberId: thisAgent?.phoneNumberId ?? null,
            },
          ]}
          deploying={deployFromLibrary.isPending}
          error={deployError}
          onDeploy={(_agentId, secrets) => deployFromLibrary.mutate({ id: deployTarget.id, secrets })}
          onClose={() => {
            setDeployTarget(null)
            setDeployError(null)
          }}
        />
      )}

      <BottomBar onBack={onBack} onNext={onNext} />
    </>
  )
}
