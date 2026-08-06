import type { StatusTone } from '../shared/StatusIndicator'

export interface TemplateSummary {
  id?: string
  sno?: string
  template_id?: string
  template_name?: string
  name?: string
  status?: string
  rejected_reason?: string
  reject_reason?: string
  category?: string
  language?: string
  quality_score?: { score?: string } | string
}

export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
export interface ButtonDraft { type: ButtonType; text: string; url: string; phoneNumber: string }

export interface KarixComponent {
  type: string
  format?: string
  text?: string
  example?: { header_handle?: string[]; body_text?: string[][] }
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string }>
}

export const AUTH_BODY_TEXT = '{{1}}'
export const DEFAULT_CODE_EXPIRATION_MINUTES = 10
export const NAME_RE = /^[a-z0-9_]+$/
export const BODY_MAX = 1024
export const PAGE_SIZE = 10

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

export function templateId(t: TemplateSummary): string {
  return String(t.id ?? t.sno ?? t.template_id ?? '')
}

export function qualityLabel(t: TemplateSummary): string | null {
  const q = t.quality_score
  if (!q) return null
  return typeof q === 'string' ? q : q.score ?? null
}

export function classifyStatus(status: string | undefined): 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'OTHER' {
  const s = status || ''
  if (/approved/i.test(s)) return 'APPROVED'
  if (/rejected/i.test(s)) return 'REJECTED'
  if (/pending|submitted/i.test(s)) return 'PENDING'
  if (/paused/i.test(s)) return 'PAUSED'
  return 'OTHER'
}

/** Meta: only APPROVED, REJECTED, or PAUSED can be edited. */
export function canEditStatus(status: string | undefined): boolean {
  const c = classifyStatus(status)
  return c === 'APPROVED' || c === 'REJECTED' || c === 'PAUSED'
}

export const TEMPLATE_STATUS_TONE: Record<ReturnType<typeof classifyStatus>, StatusTone> = {
  APPROVED: 'positive',
  REJECTED: 'negative',
  PENDING: 'warning',
  PAUSED: 'neutral',
  OTHER: 'neutral',
}

export function extractTemplates(data: unknown): TemplateSummary[] {
  const d = data as { result?: { templates?: TemplateSummary[]; data?: TemplateSummary[] } | TemplateSummary[] } | null
  if (!d?.result) return []
  if (Array.isArray(d.result)) return d.result
  return d.result.templates ?? d.result.data ?? []
}

export function extractVariables(text: string): string[] {
  const found = new Set<string>()
  let m
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) found.add(m[1])
  return Array.from(found)
}

export function seedFromComponents(components: KarixComponent[]) {
  const seed = {
    headerFormat: 'NONE' as HeaderFormat,
    headerText: '',
    headerHandle: '',
    bodyText: '',
    bodyExamples: {} as Record<string, string>,
    footerText: '',
    buttons: [] as ButtonDraft[],
  }
  for (const c of components) {
    if (c.type === 'HEADER') {
      seed.headerFormat = (c.format as HeaderFormat) || 'TEXT'
      if (c.format === 'TEXT') seed.headerText = c.text || ''
      else seed.headerHandle = c.example?.header_handle?.[0] || ''
    } else if (c.type === 'BODY') {
      seed.bodyText = c.text || ''
      const vars = extractVariables(seed.bodyText)
      const examples = c.example?.body_text?.[0] || []
      vars.forEach((v, i) => { seed.bodyExamples[v] = examples[i] || '' })
    } else if (c.type === 'FOOTER') {
      seed.footerText = c.text || ''
    } else if (c.type === 'BUTTONS') {
      seed.buttons = (c.buttons || []).map((b) => ({
        type: (b.type as ButtonType) || 'QUICK_REPLY',
        text: b.text || '',
        url: b.url || '',
        phoneNumber: b.phone_number || '',
      }))
    }
  }
  return seed
}
