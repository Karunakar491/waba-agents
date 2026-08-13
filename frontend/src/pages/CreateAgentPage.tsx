import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import ErrorBanner from '../components/shared/ErrorBanner'
import Stepper from '../components/shared/Stepper'
import IrisRail from '../components/create-agent/IrisRail'
import StepBasics from '../components/create-agent/StepBasics'
import StepBusinessPersona from '../components/create-agent/StepBusinessPersona'
import StepKnowledgeBase from '../components/create-agent/StepKnowledgeBase'
import StepSkills from '../components/create-agent/StepSkills'
import StepConnectors from '../components/create-agent/StepConnectors'
import StepEvals from '../components/create-agent/StepEvals'
import StepTestDeploy from '../components/create-agent/StepTestDeploy'
import {
  EMPTY_WIZARD_STATE,
  WIZARD_STEPS,
  type StepNumber,
  type WizardState,
} from '../components/create-agent/wizardTypes'

const DRAFT_KEY = 'create-agent-draft'

/**
 * The 7-step Create Agent wizard (Figma 8.3–8.9). This file owns only the
 * frame — step order, the shared draft state, the two writes every step
 * shares (the agent row and its business profile) and resuming a draft.
 * Every step's content lives in components/create-agent/.
 */
export default function CreateAgentPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<StepNumber>(1)
  const [state, setState] = useState<WizardState>(EMPTY_WIZARD_STATE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrating, setHydrating] = useState(() => !!sessionStorage.getItem(DRAFT_KEY))
  // Lifted out of the Skills step because Figma 8.16 replaces the Iris rail
  // with the Library drawer — one rail slot, two possible occupants.
  const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false)

  const onChange = useCallback(
    (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch })),
    [],
  )

  // Resume a draft if the browser closed mid-wizard. Only agentId + step are
  // held locally; every field value is re-read from the server it was saved
  // to, so a restored wizard never shows progress it can't back up.
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    let draft: { agentId: string | null; step: number }
    try {
      draft = JSON.parse(raw)
    } catch {
      sessionStorage.removeItem(DRAFT_KEY)
      setHydrating(false)
      return
    }
    if (!draft.agentId) {
      setHydrating(false)
      return
    }
    api
      .get(`/agents/${draft.agentId}`)
      .then((r) => {
        const agent = r.data.data
        setState((s) => ({
          ...s,
          agentId: draft.agentId,
          displayName: agent.displayName ?? s.displayName,
          phoneNumberId: agent.phoneNumberId ?? s.phoneNumberId,
          wabaId: agent.wabaId ?? s.wabaId,
          personaPreset: agent.tone ?? s.personaPreset,
          personaSampleReply: agent.personaSampleReply ?? s.personaSampleReply,
          enabled: agent.enabled ?? s.enabled,
        }))
        setStep(Math.min(7, Math.max(1, draft.step)) as StepNumber)
      })
      .catch(() => sessionStorage.removeItem(DRAFT_KEY))
      .finally(() => setHydrating(false))
  }, [])

  useEffect(() => {
    if (!state.agentId) return
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ agentId: state.agentId, step }))
  }, [state.agentId, step])

  // Connector count feeds the Test & Deploy summary row. Cheap, and it must
  // reflect what's live on Meta rather than what this session happens to
  // remember creating.
  const { data: connectors = [] } = useQuery<unknown[]>({
    queryKey: ['agent-connectors', state.agentId],
    queryFn: () => api.get(`/agents/${state.agentId}/connectors`).then((r) => r.data.data ?? []),
    enabled: !!state.agentId && step === 7,
  })

  const agentPayload = () => ({
    displayName: state.displayName.trim(),
    channel: 'whatsapp',
    tone: state.personaPreset || null,
    personaSampleReply: state.personaSampleReply.trim() || null,
    systemPrompt: state.businessInfo.businessDescription.trim() || null,
    handoffEnabled: false,
  })

  /** Creates the agent on first use, binds the chosen number, then advances. */
  async function saveBasicsAndGo() {
    setSaving(true)
    setError(null)
    try {
      let agentId = state.agentId
      if (!agentId) {
        const r = await api.post('/agents', agentPayload())
        agentId = String(r.data.data.id)
        onChange({ agentId })
      } else {
        await api.put(`/agents/${agentId}`, agentPayload())
      }
      await api.put(`/agents/${agentId}/phone`, {
        phoneNumberId: state.phoneNumberId,
        wabaId: state.wabaId,
      })
      setStep(2)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Business Persona writes to two places: the agent row (tone + starting
   * style) and the business profile deployed to this number. They're saved
   * together so leaving the step never persists half of it.
   */
  async function savePersonaAndGo() {
    if (!state.agentId) return
    setSaving(true)
    setError(null)
    try {
      await api.put(`/agents/${state.agentId}`, agentPayload())
      const body = { ...state.businessInfo }
      const r = state.businessProfileId
        ? await api.put(`/business-profiles/draft/${state.businessProfileId}`, body)
        : await api.post('/business-profiles/draft', body)
      const profileId = String(r.data.data.id)
      await api.post(`/business-profiles/draft/${profileId}/deploy`, {
        phoneNumberId: state.phoneNumberId,
      })
      onChange({ businessProfileId: profileId })
      setStep(3)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    if (!state.agentId) return
    setSaving(true)
    setError(null)
    try {
      await api.put(`/agents/${state.agentId}`, agentPayload())
      if (state.enabled) await api.post(`/agents/${state.agentId}/deploy`)
      sessionStorage.removeItem(DRAFT_KEY)
      navigate(`/agents/${state.agentId}`)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (hydrating) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="h-6 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 overflow-x-auto px-8 py-8">
        <div className="mb-8">
          <Stepper steps={[...WIZARD_STEPS]} currentStep={step} />
        </div>

        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} />
          </div>
        )}

        {step === 1 && (
          <StepBasics
            state={state}
            onChange={onChange}
            onCancel={() => navigate('/agents')}
            onNext={() => void saveBasicsAndGo()}
            busy={saving}
          />
        )}
        {step === 2 && (
          <StepBusinessPersona
            state={state}
            onChange={onChange}
            onBack={() => setStep(1)}
            onNext={() => void savePersonaAndGo()}
            busy={saving}
          />
        )}
        {step === 3 && (
          <StepKnowledgeBase
            agentId={state.agentId}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <StepSkills
            agentId={state.agentId}
            wabaId={state.wabaId}
            drawerOpen={skillsDrawerOpen}
            onDrawerOpenChange={setSkillsDrawerOpen}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <StepConnectors
            agentId={state.agentId}
            wabaId={state.wabaId}
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
          />
        )}
        {step === 6 && (
          <StepEvals agentId={state.agentId} onBack={() => setStep(5)} onNext={() => setStep(7)} />
        )}
        {step === 7 && (
          <StepTestDeploy
            state={state}
            onChange={onChange}
            onBack={() => setStep(6)}
            onEditStep={setStep}
            onFinish={() => void finish()}
            busy={saving}
            connectorCount={connectors.length}
          />
        )}
      </div>

      {!(step === 4 && skillsDrawerOpen) && <IrisRail step={step} wabaId={state.wabaId} />}
    </div>
  )
}
