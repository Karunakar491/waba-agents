import { Navigate, Outlet } from 'react-router-dom'
import { Loader2, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useModuleEntitlements } from '../../hooks/useModuleEntitlements'

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
      <div className="flex h-screen w-screen items-center justify-center bg-background">
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
    <div className="flex h-screen w-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Couldn't check your account access</h1>
        <p className="text-sm text-muted-foreground">
          This looks like a connection problem, not a permissions issue — nothing about your account has changed.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-pink px-4 py-2.5 text-sm font-medium
            text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
            disabled:opacity-60"
        >
          {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Try again
        </button>
      </div>
    </div>
  )
}

function ModuleLockedScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-foreground">No features are enabled for this account</h1>
        <p className="text-sm text-muted-foreground">
          Contact your Karix account manager to enable a feature for this account.
        </p>
      </div>
    </div>
  )
}
