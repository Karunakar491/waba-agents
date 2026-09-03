import Modal from '../shared/Modal'
import StatusIndicator from '../shared/StatusIndicator'
import CopyButton from '../shared/CopyButton'
import { formatDateTimeIST, formatEpochSecondsIST } from '../../lib/dateFormat'
import { summarizeWebhookPayload, type WebhookSummary } from '../../lib/webhookSummary'
import type { WebhookRawEntry } from './WebhookLogPanel'

const KIND_LABEL: Record<WebhookSummary['kind'], string> = {
  message: 'Message',
  status: 'Status update',
  echo: 'Outbound reply',
  unrecognized: 'Unrecognized',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground font-mono break-all">{value}</dd>
    </div>
  )
}

export default function WebhookDetailModal({ webhook, onClose }: { webhook: WebhookRawEntry; onClose: () => void }) {
  const summary = summarizeWebhookPayload(webhook.payload)
  let pretty = webhook.payload
  try {
    pretty = JSON.stringify(JSON.parse(webhook.payload), null, 2)
  } catch {
    // leave as-is if somehow not valid JSON
  }

  return (
    <Modal title={`Webhook · ${KIND_LABEL[summary.kind]}`} onClose={onClose} maxWidthClassName="max-w-3xl">
      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 mb-4">
        <Field label="Customer" value={summary.customerNumber} />
        <Field label="Business number" value={summary.businessNumber} />
        <Field label="Agent ID" value={webhook.agentId} />
        <Field label="Phone number ID" value={webhook.phoneNumberId} />
        <Field label="Received at" value={formatDateTimeIST(webhook.receivedAt)} />
        <Field label="Meta timestamp" value={summary.metaTimestamp ? formatEpochSecondsIST(summary.metaTimestamp) : null} />
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Processing</dt>
          <dd className="mt-0.5">
            <StatusIndicator
              label={webhook.status}
              tone={webhook.status === 'PROCESSED' ? 'positive' : webhook.status === 'FAILED' ? 'negative' : 'neutral'}
            />
          </dd>
        </div>
      </dl>

      {webhook.errorMessage && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          Processing error: {webhook.errorMessage}
        </p>
      )}
      {summary.metaError && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          Meta error {summary.metaError.code} — {summary.metaError.title}: {summary.metaError.message}
          {summary.metaError.details && ` (${summary.metaError.details})`}
        </p>
      )}

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">Raw payload</span>
        <CopyButton value={webhook.payload} label="Copy payload" />
      </div>
      <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap break-all">
        {pretty}
      </pre>
    </Modal>
  )
}
