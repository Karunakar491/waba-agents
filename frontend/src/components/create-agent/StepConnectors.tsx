import { useState } from 'react'
import ConnectorWorkbenchPage from '../../pages/ConnectorWorkbenchPage'
import { BottomBar, StepHeader } from './WizardChrome'

/**
 * Screen: Create Agent — Step 5, Connectors (Figma node 252:35). Reuses the
 * exact same editor as the Connectors section and the agent's own tab
 * (R4/R6 slice 4). `agentId` is unused on purpose: publishing picks its
 * target from every agent on this WABA, which already includes the draft.
 */
export default function StepConnectors({
  agentId: _agentId,
  wabaId,
  onBack,
  onNext,
}: {
  agentId: string | null
  wabaId: string
  onBack: () => void
  onNext: () => void
}) {
  const [connectorId, setConnectorId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  return (
    <>
      <StepHeader
        title="What systems does it need?"
        subtitle="For things it can't just know — like checking a real order status. Pick a real system, define what it can do, then publish it here or to any other agent. None of these? Skip — add one later from the agent's settings."
      />

      <div className="h-[560px] overflow-hidden rounded-lg border">
        <ConnectorWorkbenchPage
          embedded={{
            wabaId,
            connectorId,
            actionId,
            onNavigate: (c, a) => {
              setConnectorId(c)
              setActionId(a)
            },
          }}
        />
      </div>

      <BottomBar onBack={onBack} onNext={onNext} />
    </>
  )
}
