import type { FillMode } from './toolRequestDefinition'

/**
 * "Who fills this in" choices, shared by the parameter editor and the body editor.
 * One list, because Meta backs path/query/header params and body fields with the same
 * ParameterBinding (`docs/meta-api/connector-tools.md`) — two copies would drift, and an
 * option missing from one editor reads to the operator as "not supported here".
 */
export const FILL_OPTIONS: { value: FillMode; label: string }[] = [
  { value: 'agent', label: 'Agent fills this in' },
  { value: 'fixed', label: 'Fixed value' },
]

export const ADVANCED_FILL_OPTIONS: { value: FillMode; label: string }[] = [
  { value: 'WHATSAPP_PHONE_NUMBER', label: "Customer's WhatsApp number" },
  { value: 'WHATSAPP_IDENTITY_HASH', label: 'WhatsApp identity hash (advanced)' },
  { value: 'WHATSAPP_CURRENT_STATUS_ID', label: 'Current conversation status ID (advanced)' },
]
