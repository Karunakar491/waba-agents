import { useState } from 'react'
import { Code2, Webhook } from 'lucide-react'
import { cn } from '../lib/utils'
import ApiCallsLog from '../components/debug/ApiCallsLog'
import WebhookLogPanel from '../components/debug/WebhookLogPanel'

// New nav section (2026-08-13, "move API calls and webhooks to a new
// section called Debug, 2 sub sections: APIs and Webhooks") — mirrors the
// existing Template Studio module's own /templates/debug page, so this
// isn't a new pattern for the app, just the Agents module's own version of
// one that already exists elsewhere. Webhooks also stays in Inbox (shared
// component, not copy-pasted) for in-context triage of one conversation;
// this page is the general technical view across both APIs and Webhooks.
type DebugTab = 'apis' | 'webhooks'

const TABS: { key: DebugTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'apis',     label: 'APIs',     icon: Code2 },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
]

export default function DebugPage() {
  const [activeTab, setActiveTab] = useState<DebugTab>('apis')

  return (
    <div className="flex h-full flex-col -m-6 overflow-hidden">
      <div className="shrink-0 px-6 pt-6">
        <h1 className="text-2xl font-bold text-foreground">Debug</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw Meta API activity and inbound webhooks, for engineers and support — not a business report.
        </p>
      </div>

      <div className="mt-4 flex shrink-0 gap-1 border-b px-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ApiCallsLog has no built-in padding/scroll of its own (needs a
          wrapper); WebhookLogPanel already renders its own flex-1
          overflow-y-auto root (built to sit directly in a flex column, same
          as it does in Inbox) — wrapping it again here would double-scroll. */}
      {activeTab === 'apis' && (
        <div className="flex-1 overflow-y-auto p-6">
          <ApiCallsLog />
        </div>
      )}
      {activeTab === 'webhooks' && <WebhookLogPanel />}
    </div>
  )
}
