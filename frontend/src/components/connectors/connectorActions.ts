import type { RequestDefinition } from '../agent-detail/toolRequestDefinition'

/**
 * One thing a connector can do, stored against the library connector rather
 * than against an agent.
 *
 * It lives here because Meta scopes tools to a phone number, so an action for a
 * connector that has not been deployed anywhere has no Meta object to hold it.
 * This is the template; deploying instantiates it per agent.
 */
export interface ConnectorAction {
  id: string
  connectorId: string
  name: string
  description: string
  /** Meta's own request_definition, arriving as real JSON — not a quoted string. */
  requestDefinition: RequestDefinition
  userAuthRequired: boolean
  updatedAt: string | null
}

export interface ActionPayload {
  name: string
  description: string
  requestDefinition: RequestDefinition
  userAuthRequired: boolean
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

/**
 * Only these five. HEAD and OPTIONS are rejected by Meta outright — verified
 * 2026-09-04, see docs/meta-api/connector-tools-capability-matrix.md — so
 * offering them would be offering a save that always fails.
 */
export type HttpMethod = (typeof HTTP_METHODS)[number]

/** A one-line summary for the action list: "POST /  ·  sends query, city". */
export function summariseAction(action: ConnectorAction): string {
  const def = action.requestDefinition ?? { method: 'GET', path: '/' }
  const inputs = [
    ...Object.keys(def.query_parameters ?? {}),
    ...Object.keys(def.body?.params ?? {}),
  ]
  const call = `${def.method ?? 'GET'} ${def.path ?? '/'}`
  return inputs.length ? `${call} · sends ${inputs.join(', ')}` : call
}

/**
 * What the agent has to work out for itself when it calls this. Shown so an
 * operator can see at a glance whether the action asks the agent for too much.
 */
export function agentFilledInputs(action: ConnectorAction): string[] {
  const def = action.requestDefinition
  if (!def) return []
  const nodes = { ...(def.query_parameters ?? {}), ...(def.body?.params ?? {}) }
  return Object.entries(nodes)
    .filter(([, raw]) => {
      const node = raw as { binding?: unknown }
      return !node || typeof node !== 'object' || node.binding === undefined
    })
    .map(([key]) => key)
}
