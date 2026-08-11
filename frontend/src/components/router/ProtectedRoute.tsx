import { Navigate, Outlet } from 'react-router-dom'
import { Loader2, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useModuleEntitlements } from '../../hooks/useModuleEntitlements'
import { MODULES } from '../../lib/modules'
import ModuleCard from '../shared/ModuleCard'

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data: entitlements, isLoading, isError, refetch, isRefetching } = useModuleEntitlements()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Real loading feedback, not a blank frame — a `null` return here reads as a
  // broken page for however long the entitlement fetch takes (2026-08-05 audit).
  if (isLoading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // A fetch failure is a system fault (retry fixes it) — it is NOT the same
  // fact as "this account has zero modules enabled" (contact your account
  // manager fixes it). Conflating the two sent a real user down a support
  // ticket for a problem that didn't exist (2026-08-04 production incident).
  if (isError) {
    return <EntitlementsErrorScreen onRetry={() => refetch()} isRetrying={isRefetching} />
  }

  // Fail closed: an account with literally zero modules enabled must lock —
  // undetermined entitlement is never "enabled". Not hardcoded to
  // BUSINESS_AGENTS (2026-08-04) — a Template-Studio-only account must not be
  // wrongly locked out of the whole app.
  const hasAnyModule = entitlements ? Object.values(entitlements).some(Boolean) : false
  if (!hasAnyModule) {
    return <ModuleLockedScreen />
  }

  return <Outlet />
}

function EntitlementsErrorScreen({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Couldn't check your account access</h1>
        <p className="text-sm text-muted-foreground">
          This looks like a connection problem, not a permissions issue — nothing about your account has changed.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-teal-solid px-4 py-2.5 text-sm font-medium
            text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2
            disabled:opacity-60"
        >
          {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Try again
        </button>
      </div>
    </div>
  )
}

// Asymmetric empty state (DESIGN.md §6/§9: left accent bar, left-aligned
// copy, a real primary CTA, and a locked/muted preview of what's coming) —
// replaces the old centered-heading-only screen, per Figma node 4:24. The
// locked ModuleCard row is the same component ModuleSelectorPage's enabled
// cards use, just rendered with enabled={false} for every module.
function ModuleLockedScreen() {
  return (
    <div className="flex h-dvh w-screen flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center border-b bg-card px-8">
        <span className="text-sm font-semibold text-ink">karix</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-7 px-[120px]">
        <div className="flex gap-4">
          <div className="h-14 w-[3px] shrink-0 bg-accent-teal" />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Your workspace isn't set up yet</h1>
            <p className="max-w-[440px] text-sm text-muted-foreground">
              No features are enabled on this account yet — that just means setup hasn't started.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="mailto:support@karix.io"
            className="rounded-[10px] bg-accent-teal-solid px-5 py-3 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            Contact your account manager
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-[10px] px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            Already have access? Refresh
          </button>
        </div>

        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          What you'll get access to
        </p>

        <div className="flex flex-wrap gap-5">
          {MODULES.map((mod) => (
            <ModuleCard key={mod.key} module={mod} enabled={false} />
          ))}
        </div>
      </div>
    </div>
  )
}
