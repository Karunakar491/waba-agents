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
  detectVariableFormat,
  type ButtonDraft,
  type HeaderFormat,
  type KarixComponent,
  type VariableFormat,
  type CarouselCardDraft,
  type CarouselHeaderFormat,
} from './templateModel'
import { bodyLeadingTrailingVariable } from './builder/BodyEditor'
import { otpCodeLooksValid } from './builder/AuthenticationEditor'
import { FOOTER_MAX } from './builder/FooterEditor'
import { BUTTON_TEXT_MAX, BUTTONS_MAX_COUNT } from './builder/ButtonsEditor'

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
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [bodyText, setBodyText] = useState('')
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({})
  const [footerText, setFooterText] = useState('')
  const [buttons, setButtons] = useState<ButtonDraft[]>([])
  const [variableFormat, setVariableFormat] = useState<VariableFormat>('NUMBERED')
  const [ltoEnabled, setLtoEnabled] = useState(false)
  const [ltoText, setLtoText] = useState('')
  const [ltoHasExpiration, setLtoHasExpiration] = useState(false)
  const [carouselEnabled, setCarouselEnabled] = useState(false)
  const [carouselHeaderFormat, setCarouselHeaderFormat] = useState<CarouselHeaderFormat>('IMAGE')
  const [carouselHasBody, setCarouselHasBody] = useState(true)
  const [carouselHasButtons, setCarouselHasButtons] = useState(true)
  const [cards, setCards] = useState<CarouselCardDraft[]>([])
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

  // LTO.md limitation: "Only templates categorized as MARKETING are
  // supported" and "Footer components are not supported" alongside LTO.
  useEffect(() => {
    if (category !== 'MARKETING' && ltoEnabled) setLtoEnabled(false)
  }, [category, ltoEnabled])
  // media_carousel.md: "carousel cards are only available for marketing
  // template messages" — force off if category changes away from MARKETING.
  useEffect(() => {
    if (category !== 'MARKETING' && carouselEnabled) setCarouselEnabled(false)
  }, [category, carouselEnabled])
  useEffect(() => {
    if (ltoEnabled && footerText) setFooterText('')
  }, [ltoEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const existingTemplateQuery = useQuery({
    queryKey: ['template-detail', wabaId, templateId],
    queryFn: () => api.get(`/templates/${wabaId}/${templateId}`).then((r) => r.data.data),
    enabled: isEdit && !!templateId,
  })

  useEffect(() => {
    if (!isEdit || seeded || !existingTemplateQuery.data?.result) return
    // karix-mcp wraps the single-template payload under `response`, same as
    // listTemplates (see templateModel.ts's extractTemplates) -- confirmed
    // live 2026-08-12 after the body/header seeded as empty despite a
    // successful fetch with real component data.
    const result = existingTemplateQuery.data.result as {
      response?: Record<string, unknown>
      components?: KarixComponent[]
      template?: { components?: KarixComponent[] }
      template_name?: string
      name?: string
      language?: string
      category?: string
    }
    const raw = (result.response ?? result) as typeof result
    const components: KarixComponent[] = raw.components ?? raw.template?.components ?? []
    const seed = seedFromComponents(components)
    setHeaderFormat(seed.headerFormat)
    setHeaderText(seed.headerText)
    setHeaderHandle(seed.headerHandle)
    setBodyText(seed.bodyText)
    setBodyExamples(seed.bodyExamples)
    setFooterText(seed.footerText)
    setButtons(seed.buttons)
    setLtoEnabled(seed.ltoEnabled)
    setLtoText(seed.ltoText)
    setLtoHasExpiration(seed.ltoHasExpiration)
    setCarouselEnabled(seed.carouselEnabled)
    setCarouselHeaderFormat(seed.carouselHeaderFormat)
    setCarouselHasBody(seed.carouselHasBody)
    setCarouselHasButtons(seed.carouselHasButtons)
    setCards(seed.cards)
    setVariableFormat(detectVariableFormat(seed.bodyText))
    if (raw.template_name || raw.name) setTemplateName(raw.template_name || raw.name || '')
    if (raw.language) setLanguage(raw.language)
    if (raw.category) setCategory(raw.category)
    setSeeded(true)
  }, [isEdit, seeded, existingTemplateQuery.data])

  // Revokes the previous object URL whenever it's replaced or the component unmounts,
  // so we don't leak a blob URL per file the operator picks.
  useEffect(() => {
    return () => { if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl) }
  }, [headerPreviewUrl])

  const uploadMediaMutation = useMutation({
    mutationFn: (file: File) => {
      if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl)
      setHeaderPreviewUrl(URL.createObjectURL(file))
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

  const uploadCardMediaMutation = useMutation({
    mutationFn: ({ file }: { file: File; cardIndex: number }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('category', carouselHeaderFormat.toLowerCase())
      return api.post(`/templates/${wabaId}/media`, form, { headers: { 'Content-Type': undefined } })
    },
    onSuccess: (res, variables) => {
      const handle = res.data?.data?.result?.fileHandle || res.data?.data?.result?.file_handle || ''
      setCards((prev) => prev.map((c, i) => (i === variables.cardIndex
        ? { ...c, headerHandle: handle || c.headerHandle, mediaError: handle ? null : 'Upload succeeded but no file handle was returned.' }
        : c)))
    },
    onError: (err, variables) => {
      setCards((prev) => prev.map((c, i) => (i === variables.cardIndex ? { ...c, mediaError: extractErrorMessage(err) } : c)))
    },
  })

  function buildComponents(): Array<Record<string, unknown>> {
    if (isAuthentication) {
      return [
        { type: 'BODY', text: AUTH_BODY_TEXT },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', example: otpExampleCode }] },
      ]
    }
    const components: Array<Record<string, unknown>> = []
    if (headerFormat !== 'NONE' && !carouselEnabled) {
      if (headerFormat === 'TEXT') {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
      } else if (headerFormat === 'LOCATION') {
        // No handle to upload — the location itself is supplied at send
        // time, not creation time (docs/meta-api/.../location_templates.md).
        components.push({ type: 'HEADER', format: 'LOCATION' })
      } else {
        components.push({ type: 'HEADER', format: headerFormat, example: { header_handle: [headerHandle] } })
      }
    }
    const variables = extractVariables(bodyText)
    const bodyComponent: Record<string, unknown> = { type: 'BODY', text: bodyText }
    if (variables.length > 0) {
      bodyComponent.example = variableFormat === 'NAMED' && !isEdit
        ? { body_text_named_params: variables.map((v) => ({ param_name: v, example: bodyExamples[v] || '' })) }
        : { body_text: [variables.map((v) => bodyExamples[v] || '')] }
    }
    components.push(bodyComponent)
    // LTO.md: "Only templates categorized as MARKETING are supported" and
    // "Footer components are not supported" alongside limited_time_offer —
    // footerText is already force-cleared by the effect above when LTO is
    // on, so no footer push happens here; this mirrors that invariant.
    if (ltoEnabled && category === 'MARKETING' && ltoText.trim()) {
      components.push({
        type: 'LIMITED_TIME_OFFER',
        limited_time_offer: { text: ltoText.trim(), has_expiration: ltoHasExpiration },
      })
    } else if (footerText.trim()) {
      components.push({ type: 'FOOTER', text: footerText })
    }
    if (buttons.length > 0 && !carouselEnabled) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber }
          if (b.type === 'COPY_CODE') return { type: 'copy_code', example: b.code }
          return { type: 'QUICK_REPLY', text: b.text }
        }),
      })
    }
    if (carouselEnabled) {
      components.push({
        type: 'CAROUSEL',
        cards: cards.map((card) => {
          const cardComponents: Array<Record<string, unknown>> = [
            { type: 'HEADER', format: carouselHeaderFormat, example: { header_handle: [card.headerHandle] } },
          ]
          if (carouselHasBody) cardComponents.push({ type: 'BODY', text: card.bodyText })
          if (carouselHasButtons && card.buttons.length > 0) {
            cardComponents.push({
              type: 'BUTTONS',
              buttons: card.buttons.map((b) => {
                if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
                if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber }
                return { type: 'QUICK_REPLY', text: b.text }
              }),
            })
          }
          return { components: cardComponents }
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
      // parameter_format is locked by Meta for a template's lifetime — only
      // ever sent at creation, never on edit.
      const parameterFormat = variableFormat === 'NAMED' && extractVariables(bodyText).length > 0 ? 'named' : undefined
      return api.post(`/templates/${wabaId}`, { templateName, language, category, components, parameterFormat, ...authFields })
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
    setHeaderPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return '' })
    setMediaError(null)
    setBodyText('')
    setBodyExamples({})
    setFooterText('')
    setButtons([])
    setVariableFormat('NUMBERED')
    setLtoEnabled(false)
    setLtoText('')
    setLtoHasExpiration(false)
    setCarouselEnabled(false)
    setCarouselHeaderFormat('IMAGE')
    setCarouselHasBody(true)
    setCarouselHasButtons(true)
    setCards([])
    setCodeExpirationMinutes(DEFAULT_CODE_EXPIRATION_MINUTES)
    setOtpExampleCode('')
    setResult(null)
    setSubmittedName(null)
  }

  function makeEmptyCard(): CarouselCardDraft {
    return { headerHandle: '', mediaError: null, bodyText: '', buttons: [] }
  }

  function enableCarousel(enabled: boolean) {
    setCarouselEnabled(enabled)
    if (enabled && cards.length < 2) {
      setCards([makeEmptyCard(), makeEmptyCard()])
    }
  }

  function addCard() {
    setCards((prev) => (prev.length >= 10 ? prev : [...prev, makeEmptyCard()]))
  }

  function removeCard(index: number) {
    setCards((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  function setCardBodyText(index: number, text: string) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, bodyText: text } : c)))
  }

  function setCardButtons(index: number, updater: (prev: ButtonDraft[]) => ButtonDraft[]) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, buttons: updater(c.buttons) } : c)))
  }

  const nameOk = isEdit || (templateName.trim().length > 0 && templateName.length <= 512 && NAME_RE.test(templateName))
  const bodyLenOk = isAuthentication || bodyText.length <= BODY_MAX
  const bodyVarPositionOk = isAuthentication || !bodyLeadingTrailingVariable(bodyText)
  const footerLenOk = footerText.length <= FOOTER_MAX
  const buttonsOk = carouselEnabled
    || (buttons.length <= BUTTONS_MAX_COUNT
      && buttons.every((b) => b.text.length <= BUTTON_TEXT_MAX)
      && buttons.every((b) => b.type !== 'URL' || /^https?:\/\//.test(b.url.trim()))
      && buttons.every((b) => b.type !== 'PHONE_NUMBER' || b.phoneNumber.trim().startsWith('+')))
  // LOCATION needs no upload — the coordinates are supplied at send time,
  // not creation time (docs/meta-api/.../location_templates.md).
  const headerReady = headerFormat === 'NONE' || headerFormat === 'TEXT' || headerFormat === 'LOCATION'
    ? true
    : !!headerHandle
  // A toggled-on LTO with no offer text would otherwise submit silently
  // with neither an offer banner nor a footer (footerText is cleared the
  // moment ltoEnabled flips true) — block submit instead of losing content.
  const ltoReady = !ltoEnabled || ltoText.trim().length > 0
  // Meta requires 2-10 cards per carousel, each with its own uploaded
  // image/video handle (HEADER is mandatory per card, unlike the top-level
  // header which stays optional).
  const carouselReady = !carouselEnabled
    || (cards.length >= 2 && cards.length <= 10 && cards.every((c) => !!c.headerHandle))
  const canSubmit = nameOk && bodyLenOk && bodyVarPositionOk && footerLenOk && buttonsOk && ltoReady && carouselReady
    && (isAuthentication ? (!!otpExampleCode.trim() && otpCodeLooksValid(otpExampleCode)) : bodyText.trim() && headerReady)
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
    headerPreviewUrl,
    mediaError, setMediaError,
    bodyText, setBodyText,
    bodyExamples, setBodyExamples,
    footerText, setFooterText,
    buttons, setButtons,
    variableFormat, setVariableFormat,
    ltoEnabled, setLtoEnabled,
    ltoText, setLtoText,
    ltoHasExpiration, setLtoHasExpiration,
    carouselEnabled, enableCarousel,
    carouselHeaderFormat, setCarouselHeaderFormat,
    carouselHasBody, setCarouselHasBody,
    carouselHasButtons, setCarouselHasButtons,
    cards, addCard, removeCard, setCardBodyText, setCardButtons,
    uploadCardMediaMutation,
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
