import Button from '../shared/Button'

/**
 * Rail-local confirm card. Template Studio's IrisConfirmPanel is a WhatsApp
 * template preview — do not import it here.
 */
export default function IrisRailConfirmCard({
  toolName,
  args,
  onConfirm,
  onCancel,
  confirming,
  cancelling,
}: {
  toolName: string
  args: Record<string, unknown>
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
  cancelling: boolean
}) {
  const busy = confirming || cancelling
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{toolName.replace(/_/g, ' ')}</p>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
        {JSON.stringify(args, null, 2)}
      </pre>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onConfirm} loading={confirming} disabled={busy}>
          Confirm
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} loading={cancelling} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
