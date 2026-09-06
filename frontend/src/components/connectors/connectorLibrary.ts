/**
 * Connector Library (V46) — the reusable definition layer.
 *
 * Distinct from ConnectorRow (components/connectors/ConnectorsTable), which is
 * a live connector Meta currently reports on one agent's phone number. A
 * LibraryConnector is OUR definition: it exists whether or not Meta has ever
 * heard of it, and can be deployed to many agents.
 *
 * authShape never contains a credential value — only which header carries the
 * key, and the non-secret OAuth settings. Values are typed at deploy time and
 * go straight to Meta.
 */

export const AUTH_TYPES = [
  { value: 'API_KEY', label: 'API key' },
  { value: 'OAUTH2_CLIENT_CREDENTIALS', label: 'OAuth 2.0' },
  { value: 'NONE', label: 'No auth' },
] as const

export interface AuthHeaderField {
  fieldName: string
  prefix?: string | null
}

export interface AuthShape {
  headers?: AuthHeaderField[] | null
  tokenUrl?: string | null
  scopes?: string[] | null
  clientId?: string | null
}

export interface LibraryDeployment {
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
  metaConnectorId: string | null
  deployedAt: string | null
  /** LIVE = matches the current definition. OUT_OF_SYNC = definition edited since. */
  status: 'LIVE' | 'OUT_OF_SYNC' | 'FAILED' | 'PENDING'
  lastError: string | null
}

export interface LibraryConnector {
  id: string
  wabaId: string | null
  name: string
  description: string
  systemType: string | null
  baseUrl: string
  authType: string
  authShape: AuthShape | null
  requiresCertificate: boolean
  tags: string[]
  status: 'DRAFT' | 'PUBLISHED'
  updatedAt: string
  /** Real COUNT(*) over connector_deployment — not the name+base_url guess. */
  usedByAgentCount: number
  deployments: LibraryDeployment[]
}

export interface ConnectorFormValues {
  name: string
  description: string
  systemType: string
  baseUrl: string
  authType: string
  headerName: string
  headerPrefix: string
  tokenUrl: string
  clientId: string
  scopes: string
  requiresCertificate: boolean
  tags: string
}

export const EMPTY_CONNECTOR_FORM: ConnectorFormValues = {
  name: '',
  description: '',
  systemType: '',
  baseUrl: '',
  authType: 'API_KEY',
  headerName: '',
  headerPrefix: '',
  tokenUrl: '',
  clientId: '',
  scopes: '',
  requiresCertificate: false,
  tags: '',
}

export function toFormValues(connector: LibraryConnector): ConnectorFormValues {
  const header = connector.authShape?.headers?.[0]
  return {
    name: connector.name,
    description: connector.description,
    systemType: connector.systemType ?? '',
    baseUrl: connector.baseUrl,
    authType: connector.authType,
    headerName: header?.fieldName ?? '',
    headerPrefix: header?.prefix ?? '',
    tokenUrl: connector.authShape?.tokenUrl ?? '',
    clientId: connector.authShape?.clientId ?? '',
    scopes: (connector.authShape?.scopes ?? []).join(', '),
    requiresCertificate: connector.requiresCertificate,
    tags: connector.tags.join(', '),
  }
}

/** One header is enough for every real API key we've seen; more can be added when a second case exists. */
function buildAuthShape(form: ConnectorFormValues): AuthShape | null {
  if (form.authType === 'API_KEY') {
    if (!form.headerName.trim()) return null
    return {
      headers: [{ fieldName: form.headerName.trim(), prefix: form.headerPrefix.trim() || null }],
    }
  }
  if (form.authType === 'OAUTH2_CLIENT_CREDENTIALS') {
    return {
      tokenUrl: form.tokenUrl.trim(),
      clientId: form.clientId.trim(),
      scopes: form.scopes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
  }
  return null
}

export function toRequestBody(form: ConnectorFormValues) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    systemType: form.systemType.trim() || null,
    baseUrl: form.baseUrl.trim(),
    authType: form.authType,
    authShape: buildAuthShape(form),
    requiresCertificate: form.requiresCertificate,
    tags: form.tags.trim() || null,
  }
}

/** Which credential values this connector needs typed in before it can be deployed. */
export function requiredSecretFields(connector: LibraryConnector): { key: string; label: string }[] {
  if (connector.authType === 'API_KEY') {
    return (connector.authShape?.headers ?? []).map((h) => ({
      key: h.fieldName,
      label: `Value for ${h.fieldName}`,
    }))
  }
  if (connector.authType === 'OAUTH2_CLIENT_CREDENTIALS') {
    return [{ key: 'client_secret', label: 'OAuth client secret' }]
  }
  return []
}

/**
 * What is still missing, in the field's own words.
 *
 * The Save button used to be disabled with nothing explaining why, so a user
 * who had filled in the three obvious fields could sit looking at a dead button
 * — the blocker was usually the auth header, further down and easy to miss.
 * A control that refuses silently is the same failure as one that succeeds
 * silently: the app knows something the user doesn't and won't say it.
 */
export function missingFields(form: ConnectorFormValues): string[] {
  const missing: string[] = []
  if (!form.name.trim()) missing.push('Name')
  if (!form.description.trim()) missing.push('Description')
  if (!form.baseUrl.trim()) missing.push('Base URL')
  if (form.authType === 'API_KEY' && !form.headerName.trim()) {
    missing.push('Header that carries the key')
  }
  if (form.authType === 'OAUTH2_CLIENT_CREDENTIALS') {
    if (!form.tokenUrl.trim()) missing.push('Token URL')
    if (!form.clientId.trim()) missing.push('Client ID')
  }
  return missing
}

export function isFormComplete(form: ConnectorFormValues): boolean {
  return missingFields(form).length === 0
}
