import type { StatusTone } from '../shared/StatusIndicator'

export interface TemplateSummary {
  id?: string
  sno?: string
  template_id?: string
  fb_template_id?: string
  template_name?: string
  name?: string
  status?: string
  // Karix's real list-templates field names (confirmed live 2026-08-12 via
  // backend diagnostic logging) — status/rejected_reason above were a
  // guess that never matched, which is why every template showed "Unknown".
  template_create_status?: string
  template_status_reason?: string
  rejected_reason?: string
  reject_reason?: string
  category?: string
  language?: string
  quality_score?: { score?: string } | string
}

export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION'
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'
export interface ButtonDraft { type: ButtonType; text: string; url: string; phoneNumber: string; code: string }

// Named-vs-positional variables (Meta's parameter_format — docs/meta-api/
// .../location_templates.md, LTO.md). Only choosable at creation; Meta
// locks it for the lifetime of the template, so edit mode never shows this.
export type VariableFormat = 'NUMBERED' | 'NAMED'

export interface KarixComponent {
  type: string
  format?: string
  text?: string
  example?: {
    header_handle?: string[]
    body_text?: string[][]
    body_text_named_params?: Array<{ param_name: string; example: string }>
  }
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string; example?: string | string[] }>
  limited_time_offer?: { text?: string; has_expiration?: boolean }
  cards?: Array<{ components: KarixComponent[] }>
}

export type CarouselHeaderFormat = 'IMAGE' | 'VIDEO'

export interface CarouselCardDraft {
  headerHandle: string
  mediaError: string | null
  bodyText: string
  buttons: ButtonDraft[]
}

export const AUTH_BODY_TEXT = '{{1}}'
export const DEFAULT_CODE_EXPIRATION_MINUTES = 10
export const NAME_RE = /^[a-z0-9_]+$/
export const BODY_MAX = 1024
export const PAGE_SIZE = 10

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

// karix-mcp's single-template GET (/api/templates/{id}) only recognizes
// Meta's own template id (fb_template_id) -- confirmed live 2026-08-12 via
// backend diagnostic logging, after passing t.sno there returned
// {errorCode: 1012, errorMessage: "Template Not Found"} on every template.
export function templateId(t: TemplateSummary): string {
  return String(t.fb_template_id ?? t.id ?? t.sno ?? t.template_id ?? '')
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

// karix-mcp's real list-templates response wraps the actual payload one
// level deeper than its own docs suggest: {ok, result: {response: {
// templates: [...], APPROVED: [...], PENDING: [...], ...}}} -- confirmed
// live 2026-08-12 via backend diagnostic logging, after "No templates yet"
// showed for a WABA with real existing templates. `response` is unwrapped
// here if present; falls back to `result` directly for any other shape.
export function extractTemplates(data: unknown): TemplateSummary[] {
  const d = data as { result?: unknown } | null
  if (!d?.result) return []
  if (Array.isArray(d.result)) return d.result as TemplateSummary[]
  const result = d.result as { response?: unknown; templates?: TemplateSummary[]; data?: TemplateSummary[] }
  const response = result.response
  const container = (response && typeof response === 'object' && !Array.isArray(response))
    ? response as { templates?: TemplateSummary[]; data?: TemplateSummary[] }
    : result
  const list = Array.isArray(container) ? container as TemplateSummary[] : (container.templates ?? container.data ?? [])
  return list.map(normalizeTemplate)
}

// Backfills status/rejected_reason from Karix's real field names
// (template_create_status/template_status_reason) so every other call site
// that already reads t.status/t.rejected_reason keeps working unchanged.
function normalizeTemplate(t: TemplateSummary): TemplateSummary {
  return {
    ...t,
    status: t.status ?? t.template_create_status,
    rejected_reason: t.rejected_reason ?? t.template_status_reason,
  }
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
    ltoEnabled: false,
    ltoText: '',
    ltoHasExpiration: false,
    carouselEnabled: false,
    carouselHeaderFormat: 'IMAGE' as CarouselHeaderFormat,
    carouselHasBody: true,
    carouselHasButtons: true,
    cards: [] as CarouselCardDraft[],
  }
  for (const c of components) {
    if (c.type === 'HEADER') {
      seed.headerFormat = (c.format as HeaderFormat) || 'TEXT'
      if (c.format === 'TEXT') seed.headerText = c.text || ''
      else if (c.format !== 'LOCATION') seed.headerHandle = c.example?.header_handle?.[0] || ''
    } else if (c.type === 'BODY') {
      seed.bodyText = c.text || ''
      if (c.example?.body_text_named_params) {
        for (const p of c.example.body_text_named_params) seed.bodyExamples[p.param_name] = p.example
      } else {
        const vars = extractVariables(seed.bodyText)
        const examples = c.example?.body_text?.[0] || []
        vars.forEach((v, i) => { seed.bodyExamples[v] = examples[i] || '' })
      }
    } else if (c.type === 'FOOTER') {
      seed.footerText = c.text || ''
    } else if (c.type === 'LIMITED_TIME_OFFER') {
      seed.ltoEnabled = true
      seed.ltoText = c.limited_time_offer?.text || ''
      seed.ltoHasExpiration = !!c.limited_time_offer?.has_expiration
    } else if (c.type === 'BUTTONS') {
      seed.buttons = (c.buttons || []).map((b) => ({
        type: ((b.type || 'QUICK_REPLY').toUpperCase() as ButtonType),
        text: b.text || '',
        url: b.url || '',
        phoneNumber: b.phone_number || '',
        code: typeof b.example === 'string' ? b.example : (b.example?.[0] || ''),
      }))
    } else if (c.type === 'CAROUSEL') {
      seed.carouselEnabled = true
      const firstCardComponents = c.cards?.[0]?.components ?? []
      const firstHeader = firstCardComponents.find((cc) => cc.type === 'HEADER')
      seed.carouselHeaderFormat = (firstHeader?.format as CarouselHeaderFormat) || 'IMAGE'
      seed.carouselHasBody = firstCardComponents.some((cc) => cc.type === 'BODY')
      seed.carouselHasButtons = firstCardComponents.some((cc) => cc.type === 'BUTTONS')
      seed.cards = (c.cards ?? []).map((card) => {
        const cardComponents = card.components ?? []
        const header = cardComponents.find((cc) => cc.type === 'HEADER')
        const body = cardComponents.find((cc) => cc.type === 'BODY')
        const buttonsComponent = cardComponents.find((cc) => cc.type === 'BUTTONS')
        return {
          headerHandle: header?.example?.header_handle?.[0] || '',
          mediaError: null,
          bodyText: body?.text || '',
          buttons: (buttonsComponent?.buttons || []).map((b) => ({
            type: ((b.type || 'QUICK_REPLY').toUpperCase() as ButtonType),
            text: b.text || '',
            url: b.url || '',
            phoneNumber: b.phone_number || '',
            code: typeof b.example === 'string' ? b.example : (b.example?.[0] || ''),
          })),
        }
      })
    }
  }
  return seed
}

/** Named params use letter-led placeholder names ({{customer_name}}); Meta's
 *  positional style is purely numeric ({{1}}). A body with any non-numeric
 *  variable can only be positional if it was typed by mistake — used to
 *  seed the "Type of variable" selector from existing content on edit-seed
 *  or Iris-authored drafts, not to force a choice the user already made. */
export function detectVariableFormat(bodyText: string): VariableFormat {
  const vars = extractVariables(bodyText)
  if (vars.length === 0) return 'NUMBERED'
  return vars.some((v) => !/^\d+$/.test(v)) ? 'NAMED' : 'NUMBERED'
}
