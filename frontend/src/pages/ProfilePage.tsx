import { useQuery } from '@tanstack/react-query'
import { Check, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface AgentRow {
  id: string
  status: 'draft' | 'active' | 'paused'
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data: agents = [] } = useQuery<AgentRow[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data),
  })

  const hasAgent = agents.length > 0
  const hasActiveAgent = agents.some((a) => a.status === 'active')

  const steps: {
    n: number
    title: string
    desc: string
    complete: boolean
    actionLabel?: string
    onAction?: () => void
  }[] = [
    {
      n: 1,
      title: 'Connect WhatsApp Business Account',
      desc: 'Link your WABA to start receiving messages.',
      complete: false,
    },
    {
      n: 2,
      title: 'Create your first agent',
      desc: 'Build and configure your AI agent.',
      complete: hasAgent,
      actionLabel: hasAgent ? undefined : 'Create agent',
      onAction: hasAgent ? undefined : () => navigate('/agents/new'),
    },
    {
      n: 3,
      title: 'Publish your agent',
      desc: 'Go live and start handling customer conversations.',
      complete: hasActiveAgent,
      actionLabel: !hasActiveAgent && hasAgent ? 'View agents' : undefined,
      onAction: !hasActiveAgent && hasAgent ? () => navigate('/agents') : undefined,
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account overview and onboarding progress.
        </p>
      </div>

      {/* Getting started */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-foreground">Getting started</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Complete these steps to get your agent live on WhatsApp.
          </p>
        </div>
        <div className="divide-y">
          {steps.map((step) => (
            <div key={step.n} className="flex items-start gap-4 px-5 py-4">
              {/* Step indicator */}
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.complete
                    ? 'bg-brand-green text-white'
                    : 'border-2 border-border text-muted-foreground'
                }`}
              >
                {step.complete ? <Check className="h-3.5 w-3.5" /> : step.n}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.complete ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                {step.actionLabel && step.onAction && (
                  <button
                    onClick={step.onAction}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {step.actionLabel}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Complete badge */}
              {step.complete && (
                <span className="shrink-0 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
                  Done
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Business Info */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-foreground">Business Info</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Email
              </p>
              <p className="mt-1 text-sm text-foreground">{user?.email ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Plan
              </p>
              <span className="mt-1 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Starter Plan
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Business info editing coming soon.</p>
        </div>
      </div>
    </div>
  )
}
