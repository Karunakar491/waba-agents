import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useModuleEntitlements } from '../../hooks/useModuleEntitlements'

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data: entitlements, isLoading, isError } = useModuleEntitlements()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Don't flash the locked screen while the first fetch is still in flight.
  if (isLoading) {
    return null
  }

  // Fail closed: a fetch error or a response missing the key must lock,
  // not pass through — undetermined entitlement is never "enabled".
  if (isError || !entitlements?.BUSINESS_AGENTS) {
    return <ModuleLockedScreen />
  }

  return <Outlet />
}

function ModuleLockedScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-foreground">This module isn't enabled for your account</h1>
        <p className="text-sm text-muted-foreground">
          Contact your Karix account manager to enable Business Agents for this account.
        </p>
      </div>
    </div>
  )
}
