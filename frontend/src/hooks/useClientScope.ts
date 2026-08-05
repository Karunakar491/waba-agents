import { useSearchParams } from 'react-router-dom'

/**
 * Single source of truth for "which client is the app currently scoped to" —
 * a URL param (`?client=<id>`), not context/store state (EM decision,
 * roadmap item 45, 2026-08-06): an ops person must be able to deep-link
 * "Dashboard scoped to Client X" to a teammate, and back/forward nav must
 * un-scope correctly. Pure in-memory context state does neither.
 */
export function useClientScope() {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientId = searchParams.get('client')

  function setClientId(id: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('client', id)
      else next.delete('client')
      return next
    })
  }

  return { clientId, setClientId }
}
