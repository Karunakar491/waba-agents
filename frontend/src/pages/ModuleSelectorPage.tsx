import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useModuleEntitlements } from '../hooks/useModuleEntitlements'
import { MODULES } from '../lib/modules'
import ModuleCard from '../components/shared/ModuleCard'

// Netflix-profile-style feature picker (2026-08-04) — one card per module,
// gated by the same account-level entitlements ProtectedRoute already
// fetches. Only shown when 2+ modules are enabled for the account (see
// App.tsx's "/" redirect logic) — with exactly one enabled, the operator
// skips straight to it. Not wrapped in AppShell: this is account-level
// chrome, not feature navigation.
//
// 2026-08-11 (V2 rebrand slice 2, Figma node 2:2): restyled to DESIGN.md V2
// tokens, cards now use the shared ModuleCard (live-preview snippet + teal
// IconChip) also used by ProtectedRoute's zero-access screen. Greeting bar
// added per the Figma spec's "who am I signed in as" orientation line.

export default function ModuleSelectorPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: entitlements, isLoading } = useModuleEntitlements()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-8">
        <span className="text-sm font-semibold text-ink">karix</span>
        <span className="text-xs text-muted-foreground">
          {user?.name}{user?.email ? ` · ${user.email}` : ''}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
        <div className="space-y-2 text-center">
          <h1 className="text-[28px] font-semibold text-foreground">
            {greeting()}{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick up where you left off, or open a different workspace.
          </p>
        </div>

        {isLoading ? (
          <div className="flex gap-5">
            {MODULES.map((mod) => (
              <div key={mod.key} className="flex w-[340px] flex-col items-start gap-4 rounded-[18px] border bg-card p-6">
                <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
                <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-5">
            {MODULES.map((mod) => {
              const enabled = !!entitlements?.[mod.key]
              return (
                <ModuleCard
                  key={mod.key}
                  module={mod}
                  enabled={enabled}
                  onOpen={() => navigate(mod.homeRoute)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
