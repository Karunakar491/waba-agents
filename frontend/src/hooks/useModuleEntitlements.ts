import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

export type ModuleName = 'BUSINESS_AGENTS'

export function useModuleEntitlements() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: ['module-entitlements'],
    queryFn: () =>
      api.get('/modules/entitlements').then((r) => r.data.data as Record<ModuleName, boolean>),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
}
