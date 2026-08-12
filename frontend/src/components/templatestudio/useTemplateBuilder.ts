import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { templateQueryKeys } from '../../lib/templateQueryKeys'
import { extractErrorMessage } from '../../lib/errors'
import {
  AUTH_BODY_TEXT,
  BODY_MAX,
  DEFAULT_CODE_EXPIRATION_MINUTES,
  NAME_RE,
  extractVariables,
  seedFromComponents,
  type ButtonDraft,
  type HeaderFormat,
  type KarixComponent,
} from './templateModel'

export function useTemplateBuilder({
  wabaId,
  mode,
  templateId,
  onDone,
}: {
  wabaId: string
  mode: 'create' | 'edit'
  templateId?: string
  onDone?: () => void
}) {
  const queryClient = useQueryClient()
  const isEdit = mode === 'edit'

  const [templateName, setTemplateName] = useState('')
  const [language, setLanguage] = useState('en')
  const [category, setCategory] = useState('UTILITY')
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('NONE')
  const [headerText, setHeaderText] = useState('')
  const [headerHandle, setHeaderHandle] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [bodyText, setBodyText] = useState('')
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({})
  const [footerText, setFooterText] = useState('')
  const [buttons, setButtons] = useState<ButtonDraft[]>([])
  const [seeded, setSeeded] = useState(!isEdit)
  const [codeExpirationMinutes, setCodeExpirationMinutes] = useState(DEFAULT_CODE_EXPIRATION_MINUTES)
  const [otpExampleCode, setOtpExampleCode] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  // Figma node 99:2 "Submit Success" — create-mode only; edit keeps the
  // existing inline-message + auto-return behavior since Figma didn't spec
  // a dedicated success screen for edits.
  const [submittedName, setSubmittedName] = useState<string | null>(null)

  const isAuthentication = category === 'AUTHENTICATION'

  useEffect(() => {
    if (!isAuthentication) return
    setHeaderFormat('NONE')
    setFooterText('')
    setBodyText(AUTH_BODY_TEXT)
  }, [isAuthentication])

  const existingTemplateQuery = useQuery({
    queryKey: ['template-detail', wabaId, templateId],
    queryFn: () => api.get(`/templates/${wabaId}/${templateId}`).then((r) => r.data.data),
    enabled: isEdit && !!templateId,
  })

  useEffect(() => {
    if (!isEdit || seeded || !existingTemplateQuery.data?.result) return
    const raw = existingTemplateQuery.data.result as {
      components?: KarixComponent[]
      template?: { components?: KarixComponent[] }
      template_name?: string
      name?: string
      language?: string
      category?: string
    }
    const components: KarixComponent[] = raw.components ?? raw.template?.components ?? []
    const seed = seedFromComponents(components)
    setHeaderFormat(seed.headerFormat)
    setHeaderText(seed.headerText)
    setHeaderHandle(seed.headerHandle)
    setBodyText(seed.bodyText)
    setBodyExamples(seed.bodyExamples)
    setFooterText(seed.footerText)
    setButtons(seed.buttons)
    if (raw.template_name || raw.name) setTemplateName(raw.template_name || raw.name || '')
    if (raw.language) setLanguage(raw.language)
    if (raw.category) setCategory(raw.category)
    setSeeded(true)
  }, [isEdit, seeded, existingTemplateQuery.data])

  const uploadMediaMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('category', headerFormat.toLowerCase())
      return api.post(`/templates/${wabaId}/media`, form, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: (res) => {
      const handle = res.data?.data?.result?.fileHandle || res.data?.data?.result?.file_handle || ''
      if (!handle) { setMediaError('Upload succeeded but no file handle was returned.'); return }
      setHeaderHandle(handle)
      setMediaError(null)
    },
    onError: (err) => setMediaError(extractErrorMessage(err)),
  })

  function buildComponents(): Array<Record<string, unknown>> {
    if (isAuthentication) {
      return [
        { type: 'BODY', text: AUTH_BODY_TEXT },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', example: otpExampleCode }] },
      ]
    }
    const components: Array<Record<string, unknown>> = []
    if (headerFormat !== 'NONE') {
      if (headerFormat === 'TEXT') {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
      } else {
        components.push({ type: 'HEADER', format: headerFormat, example: { header_handle: [headerHandle] } })
      }
    }
    const variables = extractVariables(bodyText)
    const bodyComponent: Record<string, unknown> = { type: 'BODY', text: bodyText }
    if (variables.length > 0) {
      bodyComponent.example = { body_text: [variables.map((v) => bodyExamples[v] || '')] }
    }
    components.push(bodyComponent)
    if (footerText.trim()) components.push({ type: 'FOOTER', text: footerText })
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber }
          return { type: 'QUICK_REPLY', text: b.text }
        }),
      })
    }
    return components
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const components = buildComponents()
      const authFields = isAuthentication ? { codeExpirationMinutes } : {}
      if (isEdit && templateId) {
        return api.post(`/templates/${wabaId}/${templateId}/edit`, { components, ...authFields })
      }
      return api.post(`/templates/${wabaId}`, { templateName, language, category, components, ...authFields })
    },
    onSuccess: (res) => {
      const ok = res.data?.data?.ok !== false
      setResult({
        ok,
        message: ok
          ? (isEdit ? 'Template edit submitted to Meta.' : 'Template submitted for Meta approval.')
          : res.data?.data?.error || 'Submission failed.',
      })
      if (ok) {
        queryClient.invalidateQueries({ queryKey: templateQueryKeys.list(wabaId) })
        if (isEdit) {
          setTimeout(() => onDone?.(), 1500)
        } else {
          setSubmittedName(templateName)
        }
      }
    },
    onError: (err) => setResult({ ok: false, message: extractErrorMessage(err) }),
  })

  function resetForCreateAnother() {
    setTemplateName('')
    setLanguage('en')
    setCategory('UTILITY')
    setHeaderFormat('NONE')
    setHeaderText('')
    setHeaderHandle('')
    setMediaError(null)
    setBodyText('')
    setBodyExamples({})
    setFooterText('')
    setButtons([])
    setCodeExpirationMinutes(DEFAULT_CODE_EXPIRATION_MINUTES)
    setOtpExampleCode('')
    setResult(null)
    setSubmittedName(null)
  }

  const nameOk = isEdit || (templateName.trim().length > 0 && templateName.length <= 512 && NAME_RE.test(templateName))
  const bodyLenOk = isAuthentication || bodyText.length <= BODY_MAX
  const headerReady = headerFormat === 'NONE' || headerFormat === 'TEXT' ? true : !!headerHandle
  const canSubmit = nameOk && bodyLenOk
    && (isAuthentication ? !!otpExampleCode.trim() : bodyText.trim() && headerReady)
    && (!isEdit || seeded) && !submitMutation.isPending

  return {
    isEdit,
    isAuthentication,
    templateName, setTemplateName,
    language, setLanguage,
    category, setCategory,
    headerFormat, setHeaderFormat,
    headerText, setHeaderText,
    headerHandle,
    mediaError, setMediaError,
    bodyText, setBodyText,
    bodyExamples, setBodyExamples,
    footerText, setFooterText,
    buttons, setButtons,
    seeded,
    codeExpirationMinutes, setCodeExpirationMinutes,
    otpExampleCode, setOtpExampleCode,
    result, setResult,
    submittedName,
    resetForCreateAnother,
    existingTemplateQuery,
    uploadMediaMutation,
    submitMutation,
    canSubmit,
  }
}
