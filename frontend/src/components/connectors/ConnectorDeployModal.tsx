import { useState } from 'react'
import { Loader2, Rocket } from 'lucide-react'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'
import ConsequenceLine from '../shared/ConsequenceLine'
import { requiredSecretFields, type LibraryConnector } from './connectorLibrary'

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

export interface DeployTargetAgent {
  id: string
  displayName: string
  phoneNumberId: string | null
}

/**
 * Screen: Connector Library — deploy to an agent.
 *
 * 1. USER GOAL: Put a connector they already defined onto a real agent.
 * 2. EMOTIONAL STATE: This is the one moment secrets are typed — they need to
 *    know where those go.
 * 3. POSSIBLE ACTIONS: pick an agent, enter this deployment's credentials,
 *    deploy, or cancel.
 * 4. HOW WE HELP: the panel states plainly that the values are sent to Meta
 *    and not kept by us, so nobody has to guess whether we became a second
 *    credential store.
 *
 * A Modal, not an inline panel: unlike editing a definition, this is a
 * one-decision commitment that reaches a live agent, and it must not be
 * half-completed while the operator scrolls elsewhere (DESIGN.md §6).
 */
export default function ConnectorDeployModal({
  connector,
  agents,
  deploying,
  error,
  onDeploy,
  onClose,
}: {
  connector: LibraryConnector
  agents: DeployTargetAgent[]
  deploying: boolean
  error: string | null
  onDeploy: (agentId: string, secrets: Record<string, string>) => void
  onClose: () => void
}) {
  // Pre-selected when there is only one possible target — the wizard passes
  // just the agent being created, and making the operator "choose" from a
  // list of one is a click that teaches nothing.
  const [agentId, setAgentId] = useState(
    agents.length === 1 && agents[0].phoneNumberId ? agents[0].id : '',
  )
  const [secrets, setSecrets] = useState<Record<string, string>>({})

  const secretFields = requiredSecretFields(connector)
  const alreadyOn = new Set(connector.deployments.filter((d) => d.deployedAt).map((d) => d.agentId))
  const missingSecret = secretFields.some((f) => !(secrets[f.key] ?? '').trim())

  return (
    <Modal
      title={`Deploy “${connector.name}”`}
      onClose={onClose}
      preventClose={deploying}
      maxWidthClassName="max-w-lg"
    >
      <div className="space-y-4">
        {error && <ErrorBanner error={error} />}

        <ConsequenceLine>
          This creates the connector on the chosen agent's phone number at Meta. The credentials below are
          sent to Meta with that call and are not saved by us — you'll enter them again for the next agent.
        </ConsequenceLine>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-foreground">Agent</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputCls}>
            <option value="">Choose an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.phoneNumberId}>
                {a.displayName}
                {!a.phoneNumberId ? ' — no phone number yet' : alreadyOn.has(a.id) ? ' — already deployed (redeploys)' : ''}
              </option>
            ))}
          </select>
        </label>

        {secretFields.map((field) => (
          <label key={field.key} className="block space-y-1.5">
            <span className="block text-xs font-medium text-foreground">{field.label}</span>
            <input
              type="password"
              autoComplete="off"
              value={secrets[field.key] ?? ''}
              onChange={(e) => setSecrets((s) => ({ ...s, [field.key]: e.target.value }))}
              className={inputCls}
            />
          </label>
        ))}

        {connector.requiresCertificate && (
          <>
            <p className="text-xs text-muted-foreground">
              This connector uses mTLS. Paste the PEM material to send it with the deploy, or leave it blank
              and upload it later from the agent's Connectors tab — Meta will report the connector as not
              connected until it has one.
            </p>
            {(
              [
                ['client_certificate', 'Client certificate (PEM)'],
                ['client_key', 'Client key (PEM)'],
                ['ca_certificate', 'CA certificate (PEM, optional)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-1.5">
                <span className="block text-xs font-medium text-foreground">{label}</span>
                <textarea
                  rows={2}
                  value={secrets[key] ?? ''}
                  onChange={(e) => setSecrets((s) => ({ ...s, [key]: e.target.value }))}
                  className={`${inputCls} resize-none font-mono`}
                />
              </label>
            ))}
          </>
        )}

        {secretFields.length === 0 && !connector.requiresCertificate && (
          <p className="text-xs text-muted-foreground">This connector needs no credentials.</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deploying}
            className="rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDeploy(agentId, secrets)}
            disabled={deploying || !agentId || missingSecret}
            className="flex items-center gap-1.5 rounded-xl bg-accent-teal-solid px-3.5 py-2 text-sm font-semibold
              text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Deploy
          </button>
        </div>
      </div>
    </Modal>
  )
}
