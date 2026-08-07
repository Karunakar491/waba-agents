import { useNavigate } from 'react-router-dom'
import { Bot, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import { useModuleEntitlements, type ModuleName } from '../hooks/useModuleEntitlements'

// Netflix-profile-style feature picker (2026-08-04) — one card per module,
// gated by the same account-level entitlements ProtectedRoute already
// fetches. Only shown when 2+ modules are enabled for the account (see
// App.tsx's "/" redirect logic) — with exactly one enabled, the operator
// skips straight to it. Not wrapped in AppShell: this is account-level
// chrome, not feature navigation.

interface ModuleDef {
  key: ModuleName
  label: string
  description: string
  icon: typeof Bot
  homeRoute: string
}

const MODULES: ModuleDef[] = [
  {
    key: 'BUSINESS_AGENTS',
    label: 'Business Agents',
    description: 'AI agents on WhatsApp, Messenger, and Instagram — skills, knowledge base, connectors.',
    icon: Bot,
    homeRoute: '/dashboard',
  },
  {
    key: 'TEMPLATE_STUDIO',
    label: 'Template Studio',
    description: 'Create and bulk-import WhatsApp message templates.',
    icon: FileText,
    homeRoute: '/templates',
  },
]

export default function ModuleSelectorPage() {
  const navigate = useNavigate()
  const { data: entitlements, isLoading } = useModuleEntitlements()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Choose a feature</h1>
          <p className="text-sm text-muted-foreground">Only features enabled for your account are available.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MODULES.map((mod) => (
              <div key={mod.key} className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
                <div className="h-12 w-12 rounded-2xl bg-muted animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-full rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODULES.map((mod) => {
            const enabled = !!entitlements?.[mod.key]
            const Icon = mod.icon
            return (
              <button
                key={mod.key}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && navigate(mod.homeRoute)}
                aria-describedby={!enabled ? `${mod.key}-disabled-reason` : undefined}
                className={cn(
                  'flex flex-col items-start gap-3 rounded-xl border bg-card p-6 text-left shadow-surface-resting transition',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  enabled
                    ? 'hover:border-primary hover:shadow-surface-lifted cursor-pointer'
                    : 'opacity-50 cursor-not-allowed',
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{mod.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
                </div>
                {!enabled && (
                  <span id={`${mod.key}-disabled-reason`} className="text-xs font-medium text-muted-foreground">
                    Not enabled for this account
                  </span>
                )}
              </button>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
