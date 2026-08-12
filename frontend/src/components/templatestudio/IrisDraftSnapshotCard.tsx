import { useEffect, useRef, useState } from 'react'
import WhatsAppTemplatePreview from './WhatsAppTemplatePreview'
import { previewPropsFromArgs } from './IrisConfirmPanel'

// "Draft Snapshot" — IRIS-REDESIGN-DIRECTIONS.md Direction 1, phase 2.
// Every create_template/edit_template turn already carries the full
// template state (not a delta) via IrisMessage.toolArgsJson — this renders
// that as a compact inline WhatsApp-preview card under Iris's reply,
// diffing against the PREVIOUS snapshot in the same session client-side to
// know what to highlight. No backend delta computation needed.
//
// Design Evaluator condition (PASS with one hard condition): the highlight
// must be one-shot and purposeful, never ambient/decorative on every
// render — it fires once when this card mounts with a change from the
// prior snapshot, then clears itself and never re-fires on its own.
export default function IrisDraftSnapshotCard({
  args,
  previousArgs,
}: {
  args: Record<string, unknown>
  previousArgs: Record<string, unknown> | null
}) {
  const preview = previewPropsFromArgs(args)
  const changedFields = previousArgs ? diffFields(previewPropsFromArgs(previousArgs), preview) : null
  const [highlighting, setHighlighting] = useState(!!changedFields && changedFields.length > 0)
  const fired = useRef(false)

  useEffect(() => {
    // Runs once per mount (a new snapshot card mounts per turn, it never
    // re-renders in place) — this IS the one-shot firing, not a loop.
    if (fired.current || !highlighting) return
    fired.current = true
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setHighlighting(false), reduceMotion ? 0 : 1800)
    return () => clearTimeout(timer)
  }, [highlighting])

  return (
    <div className="max-w-sm">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {previousArgs ? 'Draft updated' : 'Draft started'}
        {changedFields && changedFields.length > 0 && (
          <span className="text-foreground"> — {changedFields.join(', ')}</span>
        )}
      </p>
      <div
        className={
          highlighting
            ? 'rounded-xl ring-2 ring-accent-teal-solid/60 transition-shadow duration-[1800ms] ease-out'
            : 'rounded-xl ring-2 ring-transparent transition-shadow duration-[1800ms] ease-out'
        }
      >
        <WhatsAppTemplatePreview {...preview} />
      </div>
    </div>
  )
}

function diffFields(
  before: ReturnType<typeof previewPropsFromArgs>,
  after: ReturnType<typeof previewPropsFromArgs>,
): string[] {
  const changed: string[] = []
  if (before.headerText !== after.headerText || before.headerFormat !== after.headerFormat) changed.push('header')
  if (before.bodyText !== after.bodyText) changed.push('body')
  if (before.footerText !== after.footerText) changed.push('footer')
  if (JSON.stringify(before.buttons) !== JSON.stringify(after.buttons)) changed.push('buttons')
  return changed
}
